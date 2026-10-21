import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { Client, GatewayIntentBits, Events } from 'discord.js';

const TIPOS_OCORRENCIA = ['Corrida Ilegal', 'Caixa Eletrônico', 'Tráfico de Drogas', 'Visual Armado', 'Código 5', 'Fuga de Abordagem', 'Roubo de Veículo', 'Roubo a Residência', 'Outros'];
const TIPOS_ACAO = ['Banco Central', 'Banco Paleto', 'Banco Fleca', 'Life Invader', 'Lojinha', 'Joalheria', 'Outros'];
const NOTA_CORTE = 7;
const QTD_QUESTOES = 15;

const SECRET = process.env.JWT_SECRET || 'troque-este-segredo';
if (!process.env.JWT_SECRET) console.warn('⚠ JWT_SECRET não definido no .env — defina um valor seguro.');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });


const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gar',
  waitForConnections: true,
  connectionLimit: 10,
  timezone: 'Z',
  ssl: process.env.DB_SSL_CA
    ? {
      ca: process.env.DB_SSL_CA,
      rejectUnauthorized: true,
    }
    : undefined,
});

// Tudo em UTC no banco; o front converte para o horário local
pool.pool.on('connection', (conn) => conn.query("SET time_zone = '+00:00'"));

// Integração Discord: o token fica exclusivamente no ambiente do backend.
const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN;

// Conexão persistente do bot Discord
const discordClient = DISCORD_TOKEN
  ? new Client({
    intents: [GatewayIntentBits.Guilds],
  })
  : null;

if (discordClient) {
  discordClient.once(Events.ClientReady, (client) => {
    console.log(`[Discord] Bot conectado como ${client.user.tag}`);
  });

  discordClient.login(DISCORD_TOKEN).catch((erro) => {
    console.error('[Discord] Falha ao conectar o bot:', erro.message);
  });
} else {
  console.warn('[Discord] DISCORD_BOT_TOKEN não configurado.');
}

const DISCORD_CHANNELS = {
  ocorrencias: process.env.DISCORD_CHANNEL_QRU || '1559689969386258432',
  acoes: process.env.DISCORD_CHANNEL_ACOES || '1559689783863672924',
  cursos: process.env.DISCORD_CHANNEL_CURSOS || '1562218392029634570',
};
const textoDiscord = (valor, max = 1024) => {
  const texto = valor === null || valor === undefined || valor === '' ? 'Não informado' : String(valor);
  return texto.length > max ? `${texto.slice(0, max - 1)}…` : texto;
};

// `anexo` pode ser um arquivo ou uma lista (até 10). `extras` são embeds adicionais (até 10 no total).
async function enviarEmbedDiscord(channelId, embed, anexo = null, extras = []) {
  if (!DISCORD_TOKEN) {
    console.warn('[Discord] DISCORD_BOT_TOKEN não configurado; notificação ignorada.');
    return;
  }
  try {
    let body;
    const headers = { Authorization: `Bot ${DISCORD_TOKEN}` };
    const embeds = [embed, ...extras].filter(Boolean).slice(0, 10);
    const payload = { embeds, allowed_mentions: { parse: [] } };
    const anexos = (Array.isArray(anexo) ? anexo : [anexo]).filter((a) => a?.dados).slice(0, 10);
    if (anexos.length) {
      const form = new FormData();
      form.append('payload_json', JSON.stringify(payload));
      anexos.forEach((a, i) => {
        form.append(`files[${i}]`, new Blob([a.dados], { type: a.mime || 'application/octet-stream' }), a.nome || `anexo-${i + 1}`);
      });
      body = form;
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(payload);
    }
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST', headers, body,
    });
    if (!response.ok) {
      const detalhe = await response.text();
      console.error(`[Discord] Falha ao enviar para o canal ${channelId}: HTTP ${response.status} ${detalhe.slice(0, 500)}`);
    }
  } catch (erro) {
    console.error('[Discord] Não foi possível enviar a notificação:', erro.message);
  }
}

const campo = (name, value, inline = false) => ({ name: textoDiscord(name, 256), value: textoDiscord(value), inline });
const dataLocal = (valor) => valor ? new Date(valor).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'Não informado';

const h = (fn) => (req, res) =>
  fn(req, res).catch((e) => {
    console.error(e);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  });

// ---------- Auth ----------
async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : req.query.token;
    if (!token) return res.status(401).json({ erro: 'Não autenticado.' });
    const payload = jwt.verify(token, SECRET);
    const [rows] = await pool.query('SELECT id, nome, usuario, role FROM usuarios WHERE id = ?', [payload.id]);
    if (!rows.length) return res.status(401).json({ erro: 'Usuário não encontrado.' });
    req.user = rows[0];
    next();
  } catch {
    res.status(401).json({ erro: 'Sessão inválida ou expirada.' });
  }
}
const admin = (req, res, next) =>
  req.user.role === 'admin' ? next() : res.status(403).json({ erro: 'Acesso restrito a administradores.' });

const sign = (u) => jwt.sign({ id: u.id }, SECRET, { expiresIn: '7d' });

app.post('/api/auth/registrar', h(async (req, res) => {
  const { nome, usuario, senha } = req.body;
  if (!nome?.trim() || !usuario?.trim() || !senha) return res.status(400).json({ erro: 'Preencha nome, usuário e senha.' });
  if (senha.length < 6) return res.status(400).json({ erro: 'A senha deve ter ao menos 6 caracteres.' });
  const login = usuario.trim().toLowerCase();
  const [exists] = await pool.query('SELECT id FROM usuarios WHERE usuario = ?', [login]);
  if (exists.length) return res.status(409).json({ erro: 'Este usuário já existe.' });
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM usuarios');
  const role = total === 0 ? 'admin' : 'oficial'; // o primeiro cadastro vira administrador
  const hash = await bcrypt.hash(senha, 10);
  const [r] = await pool.query('INSERT INTO usuarios (nome, usuario, senha_hash, role) VALUES (?,?,?,?)', [nome.trim(), login, hash, role]);
  const user = { id: r.insertId, nome: nome.trim(), usuario: login, role };
  res.json({ token: sign(user), user });
}));

app.post('/api/auth/login', h(async (req, res) => {
  const { usuario, senha } = req.body;
  const [rows] = await pool.query('SELECT * FROM usuarios WHERE usuario = ?', [String(usuario || '').trim().toLowerCase()]);
  if (!rows.length || !(await bcrypt.compare(senha || '', rows[0].senha_hash))) {
    return res.status(401).json({ erro: 'Usuário ou senha incorretos.' });
  }
  const u = rows[0];
  res.json({ token: sign(u), user: { id: u.id, nome: u.nome, usuario: u.usuario, role: u.role } });
}));

app.get('/api/me', auth, (req, res) => res.json(req.user));

// ---------- Usuários ----------
app.get('/api/usuarios', auth, h(async (req, res) => {
  const [rows] = await pool.query('SELECT id, nome, usuario, role FROM usuarios ORDER BY nome');
  res.json(rows);
}));

app.patch('/api/usuarios/:id/role', auth, admin, h(async (req, res) => {
  const { role } = req.body;
  if (!['admin', 'oficial'].includes(role)) return res.status(400).json({ erro: 'Perfil inválido.' });
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ erro: 'Você não pode alterar o seu próprio perfil.' });
  await pool.query('UPDATE usuarios SET role = ? WHERE id = ?', [role, req.params.id]);
  res.json({ ok: true });
}));

// ---------- Senhas ----------
app.patch('/api/me/senha', auth, h(async (req, res) => {
  const { senha_atual, nova_senha } = req.body;
  if (!nova_senha || nova_senha.length < 6) return res.status(400).json({ erro: 'A nova senha deve ter ao menos 6 caracteres.' });
  const [rows] = await pool.query('SELECT senha_hash FROM usuarios WHERE id = ?', [req.user.id]);
  if (!(await bcrypt.compare(senha_atual || '', rows[0].senha_hash))) return res.status(400).json({ erro: 'Senha atual incorreta.' });
  await pool.query('UPDATE usuarios SET senha_hash = ? WHERE id = ?', [await bcrypt.hash(nova_senha, 10), req.user.id]);
  res.json({ ok: true });
}));

app.patch('/api/usuarios/:id/senha', auth, admin, h(async (req, res) => {
  const { nova_senha } = req.body;
  if (!nova_senha || nova_senha.length < 6) return res.status(400).json({ erro: 'A nova senha deve ter ao menos 6 caracteres.' });
  await pool.query('UPDATE usuarios SET senha_hash = ? WHERE id = ?', [await bcrypt.hash(nova_senha, 10), req.params.id]);
  res.json({ ok: true });
}));

// ---------- Imagens ----------
app.get('/api/imagens/:id', auth, h(async (req, res) => {
  const [rows] = await pool.query('SELECT mime, dados FROM imagens WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).end();
  res.set('Content-Type', rows[0].mime);
  res.set('Cache-Control', 'private, max-age=86400');
  res.send(rows[0].dados);
}));

// ---------- Cursos / questões ----------
app.get('/api/cursos', auth, h(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT c.id, c.nome, c.resumo,
       (SELECT COUNT(*) FROM questoes q WHERE q.curso_id = c.id) AS total_questoes,
       (SELECT MAX(p.nota) FROM provas p WHERE p.curso_id = c.id AND p.usuario_id = ? AND p.status = 'finalizada') AS melhor_nota,
       (SELECT COUNT(*) FROM provas p WHERE p.curso_id = c.id AND p.usuario_id = ? AND p.aprovado = 1) AS aprovacoes
     FROM cursos c ORDER BY c.id`, [req.user.id, req.user.id]);
  res.json({ cursos: rows, nota_corte: NOTA_CORTE, qtd_questoes: QTD_QUESTOES });
}));

app.put('/api/cursos/:id', auth, admin, h(async (req, res) => {
  const { nome, resumo } = req.body;
  await pool.query('UPDATE cursos SET nome = COALESCE(?, nome), resumo = ? WHERE id = ?', [nome || null, resumo ?? null, req.params.id]);
  res.json({ ok: true });
}));

app.get('/api/cursos/:id/questoes', auth, admin, h(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM questoes WHERE curso_id = ? ORDER BY id DESC', [req.params.id]);
  res.json(rows);
}));

function validarQuestao(q) {
  const ok = q && q.enunciado?.trim() && q.a?.trim() && q.b?.trim() && q.c?.trim() && q.d?.trim() && ['a', 'b', 'c', 'd'].includes(String(q.correta || '').toLowerCase());
  return ok ? [q.enunciado.trim(), q.a.trim(), q.b.trim(), q.c.trim(), q.d.trim(), String(q.correta).toLowerCase()] : null;
}

app.post('/api/questoes', auth, admin, h(async (req, res) => {
  const v = validarQuestao(req.body);
  if (!v || !req.body.curso_id) return res.status(400).json({ erro: 'Preencha enunciado, as 4 alternativas e a correta.' });
  await pool.query('INSERT INTO questoes (curso_id, enunciado, opcao_a, opcao_b, opcao_c, opcao_d, correta) VALUES (?,?,?,?,?,?,?)', [req.body.curso_id, ...v]);
  res.json({ ok: true });
}));

app.post('/api/questoes/importar', auth, admin, h(async (req, res) => {
  const { curso_id, questoes } = req.body;
  if (!curso_id || !Array.isArray(questoes) || !questoes.length) return res.status(400).json({ erro: 'Envie curso_id e uma lista de questões.' });
  const rows = [];
  for (const [i, q] of questoes.entries()) {
    const v = validarQuestao(q);
    if (!v) return res.status(400).json({ erro: `Questão ${i + 1} inválida (precisa de enunciado, a, b, c, d e correta).` });
    rows.push([curso_id, ...v]);
  }
  await pool.query('INSERT INTO questoes (curso_id, enunciado, opcao_a, opcao_b, opcao_c, opcao_d, correta) VALUES ?', [rows]);
  res.json({ ok: true, importadas: rows.length });
}));

app.delete('/api/questoes/:id', auth, admin, h(async (req, res) => {
  await pool.query('DELETE FROM questoes WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));

// ---------- Provas ----------
app.post('/api/provas/iniciar', auth, h(async (req, res) => {
  const { curso_id } = req.body;
  const [cursos] = await pool.query('SELECT id, nome FROM cursos WHERE id = ?', [curso_id]);
  if (!cursos.length) return res.status(404).json({ erro: 'Curso não encontrado.' });
  // 15 questões sorteadas do banco a cada nova prova
  const [qs] = await pool.query(
    'SELECT id, enunciado, opcao_a, opcao_b, opcao_c, opcao_d FROM questoes WHERE curso_id = ? ORDER BY RAND() LIMIT ?',
    [curso_id, QTD_QUESTOES]);
  if (qs.length < QTD_QUESTOES) {
    return res.status(400).json({ erro: `Este curso tem apenas ${qs.length} questões cadastradas (mínimo ${QTD_QUESTOES}). Peça a um administrador para cadastrar mais.` });
  }
  const [r] = await pool.query('INSERT INTO provas (usuario_id, curso_id) VALUES (?,?)', [req.user.id, curso_id]);
  await pool.query('INSERT INTO prova_questoes (prova_id, questao_id) VALUES ?', [qs.map((q) => [r.insertId, q.id])]);
  res.json({ prova_id: r.insertId, curso: cursos[0].nome, nota_corte: NOTA_CORTE, questoes: qs });
}));

app.post('/api/provas/:id/finalizar', auth, h(async (req, res) => {
  const [provas] = await pool.query('SELECT * FROM provas WHERE id = ? AND usuario_id = ?', [req.params.id, req.user.id]);
  if (!provas.length) return res.status(404).json({ erro: 'Prova não encontrada.' });
  if (provas[0].status === 'finalizada') return res.status(400).json({ erro: 'Esta prova já foi finalizada.' });
  const respostas = req.body.respostas || {};
  const [itens] = await pool.query(
    'SELECT pq.id, pq.questao_id, q.enunciado, q.correta FROM prova_questoes pq JOIN questoes q ON q.id = pq.questao_id WHERE pq.prova_id = ?',
    [req.params.id]);
  let acertos = 0;
  const detalhes = [];
  for (const it of itens) {
    const marcada = ['a', 'b', 'c', 'd'].includes(respostas[it.questao_id]) ? respostas[it.questao_id] : null;
    const acertou = marcada === it.correta;
    if (acertou) acertos++;
    await pool.query('UPDATE prova_questoes SET resposta = ? WHERE id = ?', [marcada, it.id]);
    detalhes.push({ questao_id: it.questao_id, enunciado: it.enunciado, marcada, acertou });
  }
  const nota = Math.round((acertos / itens.length) * 10 * 100) / 100;
  const aprovado = nota >= NOTA_CORTE ? 1 : 0;
  await pool.query("UPDATE provas SET status='finalizada', nota=?, aprovado=?, finalizada_em=NOW() WHERE id=?", [nota, aprovado, req.params.id]);
  const [[resultadoProva]] = await pool.query(
    `SELECT p.id, p.nota, p.aprovado, p.finalizada_em, c.nome AS curso, u.nome AS oficial
     FROM provas p JOIN cursos c ON c.id = p.curso_id JOIN usuarios u ON u.id = p.usuario_id WHERE p.id = ?`,
    [req.params.id]);
  if (resultadoProva) {
    await enviarEmbedDiscord(DISCORD_CHANNELS.cursos, {
      title: `${resultadoProva.aprovado ? '🎓' : '📘'} Resultado de prova #${resultadoProva.id}`,
      color: resultadoProva.aprovado ? 0x2ECC71 : 0xE67E22,
      fields: [
        campo('Oficial', resultadoProva.oficial, true),
        campo('Curso', resultadoProva.curso, true),
        campo('Nota', `${Number(resultadoProva.nota).toFixed(2)} / 10`, true),
        campo('Acertos', `${acertos} de ${itens.length}`, true),
        campo('Nota de corte', NOTA_CORTE, true),
        campo('Resultado', resultadoProva.aprovado ? 'APROVADO' : 'REPROVADO', true),
        campo('Finalizada em', dataLocal(resultadoProva.finalizada_em), true),
      ],
      footer: { text: 'Unidade GAR • Cursos e Provas' },
    });
  }
  res.json({ nota, acertos, total: itens.length, aprovado: !!aprovado, nota_corte: NOTA_CORTE, detalhes });
}));

app.get('/api/provas/minhas', auth, h(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT p.id, c.nome AS curso, p.nota, p.aprovado, p.finalizada_em
     FROM provas p JOIN cursos c ON c.id = p.curso_id
     WHERE p.usuario_id = ? AND p.status = 'finalizada' ORDER BY p.finalizada_em DESC LIMIT 30`, [req.user.id]);
  res.json(rows);
}));

// ---------- Ocorrências ----------
app.get('/api/ocorrencias', auth, h(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT o.id, o.tipo, o.modelo_veiculo, o.imagem_id, o.descricao, o.criado_em, cu.nome AS criado_por,
       (SELECT GROUP_CONCAT(u.nome ORDER BY u.nome SEPARATOR ', ') FROM ocorrencia_oficiais oo JOIN usuarios u ON u.id = oo.usuario_id WHERE oo.ocorrencia_id = o.id) AS oficiais
     FROM ocorrencias o JOIN usuarios cu ON cu.id = o.criado_por ORDER BY o.criado_em DESC LIMIT 200`);
  res.json({ ocorrencias: rows, tipos: TIPOS_OCORRENCIA });
}));

app.post('/api/ocorrencias', auth, upload.single('imagem'), h(async (req, res) => {
  const { tipo, modelo_veiculo, descricao } = req.body;
  let oficiais = [];
  try { oficiais = JSON.parse(req.body.oficiais || '[]'); } catch { /* ignora */ }
  if (!TIPOS_OCORRENCIA.includes(tipo)) return res.status(400).json({ erro: 'Tipo de ocorrência inválido.' });
  if (!modelo_veiculo?.trim()) return res.status(400).json({ erro: 'Informe o modelo do veículo.' });
  if (!oficiais.length) return res.status(400).json({ erro: 'Selecione ao menos um oficial.' });
  if (!req.file) return res.status(400).json({ erro: 'Anexe a imagem do veículo.' });
  if (!req.file.mimetype.startsWith('image/')) return res.status(400).json({ erro: 'O arquivo precisa ser uma imagem.' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [img] = await conn.query('INSERT INTO imagens (mime, dados) VALUES (?,?)', [req.file.mimetype, req.file.buffer]);
    const [r] = await conn.query('INSERT INTO ocorrencias (tipo, modelo_veiculo, imagem_id, descricao, criado_por) VALUES (?,?,?,?,?)',
      [tipo, modelo_veiculo.trim(), img.insertId, descricao?.trim() || null, req.user.id]);
    await conn.query('INSERT INTO ocorrencia_oficiais (ocorrencia_id, usuario_id) VALUES ?', [[...new Set(oficiais)].map((id) => [r.insertId, id])]);
    await conn.commit();

    // A notificação é independente do salvamento: falhas no Discord não desfazem o registro.
    const [[registro]] = await pool.query(
      `SELECT o.id, o.tipo, o.modelo_veiculo, o.descricao, o.criado_em, o.imagem_id,
              u.nome AS criado_por,
              (SELECT GROUP_CONCAT(u2.nome ORDER BY u2.nome SEPARATOR ', ')
               FROM ocorrencia_oficiais oo JOIN usuarios u2 ON u2.id = oo.usuario_id
               WHERE oo.ocorrencia_id = o.id) AS oficiais,
              i.mime AS imagem_mime, i.dados AS imagem_dados
       FROM ocorrencias o JOIN usuarios u ON u.id = o.criado_por
       LEFT JOIN imagens i ON i.id = o.imagem_id WHERE o.id = ?`, [r.insertId]);
    if (registro) {
      const embed = {
        title: `🚨 Registro de ocorrência #${registro.id}`,
        color: 0xD83C3E,
        fields: [
          campo('Tipo de ocorrência', registro.tipo, true),
          campo('Modelo do veículo', registro.modelo_veiculo, true),
          campo('Oficiais envolvidos', registro.oficiais),
          campo('Descrição', registro.descricao),
          campo('Registrado por', registro.criado_por, true),
          campo('Data', dataLocal(registro.criado_em), true),
        ],
        footer: { text: 'Unidade GAR • Sistema de registros' },
      };
      let anexo = null;
      if (registro.imagem_dados) {
        const extensao = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' })[registro.imagem_mime] || 'img';
        const nome = `ocorrencia-${registro.id}.${extensao}`;
        embed.image = { url: `attachment://${nome}` };
        anexo = { dados: registro.imagem_dados, mime: registro.imagem_mime, nome };
      }
      await enviarEmbedDiscord(DISCORD_CHANNELS.ocorrencias, embed, anexo);
    }
    res.json({ ok: true, id: r.insertId });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}));

app.delete('/api/ocorrencias/:id', auth, admin, h(async (req, res) => {
  await pool.query('DELETE FROM ocorrencias WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));

// ---------- Ações ----------
app.get('/api/acoes', auth, h(async (req, res) => {
  const [acoes] = await pool.query(
    `SELECT a.id, a.descricao, a.tipo, a.resultado, a.criado_em, cu.nome AS criado_por
     FROM acoes a JOIN usuarios cu ON cu.id = a.criado_por ORDER BY a.criado_em DESC LIMIT 200`);
  if (acoes.length) {
    const ids = acoes.map((a) => a.id);
    const [veic] = await pool.query('SELECT acao_id, modelo, situacao, imagem_id FROM acao_veiculos WHERE acao_id IN (?)', [ids]);
    const [ofs] = await pool.query('SELECT ao.acao_id, u.nome FROM acao_oficiais ao JOIN usuarios u ON u.id = ao.usuario_id WHERE ao.acao_id IN (?) ORDER BY u.nome', [ids]);
    for (const a of acoes) {
      a.veiculos = veic.filter((v) => v.acao_id === a.id);
      a.oficiais = ofs.filter((o) => o.acao_id === a.id).map((o) => o.nome);
    }
  }
  res.json({ acoes, tipos: TIPOS_ACAO });
}));

app.post('/api/acoes', auth, upload.any(), h(async (req, res) => {
  let body = req.body;
  if (typeof req.body.dados === 'string') {
    try { body = JSON.parse(req.body.dados); } catch { return res.status(400).json({ erro: 'Dados inválidos.' }); }
  }
  const { descricao, tipo, resultado, oficiais = [], veiculos = [] } = body;
  if (!descricao?.trim()) return res.status(400).json({ erro: 'Informe a descrição da ação.' });
  if (!TIPOS_ACAO.includes(tipo)) return res.status(400).json({ erro: 'Tipo de ação inválido.' });
  if (!['vitoria', 'derrota'].includes(resultado)) return res.status(400).json({ erro: 'Informe o resultado da ação.' });
  if (!oficiais.length) return res.status(400).json({ erro: 'Selecione ao menos um oficial.' });

  // mantém o índice original para casar cada veículo com o seu arquivo (imagem_0, imagem_1...)
  const veic = veiculos.map((v, i) => ({ ...v, i })).filter((v) => v.modelo?.trim());
  if (veic.some((v) => !['fuga', 'preso'].includes(v.situacao))) return res.status(400).json({ erro: 'Informe se o veículo fugiu ou foi preso.' });

  const arquivos = {};
  for (const f of req.files || []) {
    if (!f.mimetype.startsWith('image/')) return res.status(400).json({ erro: 'Os anexos precisam ser imagens.' });
    arquivos[f.fieldname] = f;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.query('INSERT INTO acoes (descricao, tipo, resultado, criado_por) VALUES (?,?,?,?)', [descricao.trim(), tipo, resultado, req.user.id]);
    await conn.query('INSERT INTO acao_oficiais (acao_id, usuario_id) VALUES ?', [[...new Set(oficiais)].map((id) => [r.insertId, id])]);
    for (const v of veic) {
      let imagemId = null;
      const f = arquivos[`imagem_${v.i}`];
      if (f) {
        const [img] = await conn.query('INSERT INTO imagens (mime, dados) VALUES (?,?)', [f.mimetype, f.buffer]);
        imagemId = img.insertId;
      }
      await conn.query('INSERT INTO acao_veiculos (acao_id, modelo, situacao, imagem_id) VALUES (?,?,?,?)', [r.insertId, v.modelo.trim(), v.situacao, imagemId]);
    }
    await conn.commit();

    // Notificação no Discord (uma falha aqui não desfaz o registro)
    try {
      const [nomes] = await pool.query('SELECT nome FROM usuarios WHERE id IN (?) ORDER BY nome', [[...new Set(oficiais)]]);
      const embed = {
        title: `🎯 Registro de ação #${r.insertId}`,
        color: resultado === 'vitoria' ? 0x2ECC71 : 0xD83C3E,
        fields: [
          campo('Ação', tipo, true),
          campo('Resultado', resultado === 'vitoria' ? 'VITÓRIA' : 'DERROTA', true),
          campo('Descrição', descricao.trim()),
          campo('Veículos', veic.length ? veic.map((v) => `${v.modelo.trim()} — ${v.situacao === 'preso' ? 'Preso' : 'Fuga'}`).join('\n') : 'Nenhum'),
          campo('Oficiais', nomes.map((n) => n.nome).join(', ')),
          campo('Registrado por', req.user.nome, true),
          campo('Data', dataLocal(new Date()), true),
        ],
        footer: { text: 'Unidade GAR • Sistema de registros' },
      };
      // Uma foto por embed, com o modelo do veículo. O Discord limita cada mensagem a
      // 10 embeds e ~10 MB, então as fotos vão em lotes de até 9 fotos / 8 MB.
      const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
      const fotos = veic.filter((v) => arquivos[`imagem_${v.i}`]).map((v, n) => {
        const f = arquivos[`imagem_${v.i}`];
        const nome = `acao-${r.insertId}-${n + 1}.${EXT[f.mimetype] || 'img'}`;
        return {
          anexo: { dados: f.buffer, mime: f.mimetype, nome },
          embed: {
            color: embed.color,
            description: `🚗 ${v.modelo.trim()} — ${v.situacao === 'preso' ? 'Preso' : 'Fuga'}`,
            image: { url: `attachment://${nome}` },
          },
          tamanho: f.buffer.length,
        };
      });
      const lotes = [];
      let atual = [];
      let bytes = 0;
      for (const foto of fotos) {
        if (atual.length >= 9 || (atual.length && bytes + foto.tamanho > 8 * 1024 * 1024)) {
          lotes.push(atual);
          atual = [];
          bytes = 0;
        }
        atual.push(foto);
        bytes += foto.tamanho;
      }
      if (atual.length) lotes.push(atual);

      if (!lotes.length) {
        await enviarEmbedDiscord(DISCORD_CHANNELS.acoes, embed);
      } else {
        for (const [i, lote] of lotes.entries()) {
          await enviarEmbedDiscord(
            DISCORD_CHANNELS.acoes,
            i === 0 ? embed : null, // o resumo da ação vai só na primeira mensagem
            lote.map((l) => l.anexo),
            lote.map((l) => l.embed),
          );
        }
      }
    } catch (e) {
      console.error('[Discord] Falha ao notificar ação:', e.message);
    }

    res.json({ ok: true, id: r.insertId });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}));

app.delete('/api/acoes/:id', auth, admin, h(async (req, res) => {
  await pool.query('DELETE FROM acoes WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));

// ---------- Bate-ponto ----------
app.get('/api/ponto/status', auth, h(async (req, res) => {
  const [aberto] = await pool.query('SELECT id, entrada FROM ponto WHERE usuario_id = ? AND saida IS NULL ORDER BY id DESC LIMIT 1', [req.user.id]);
  const [[tot]] = await pool.query(
    'SELECT COALESCE(SUM(TIMESTAMPDIFF(SECOND, entrada, saida)),0) AS segundos FROM ponto WHERE usuario_id = ? AND saida IS NOT NULL', [req.user.id]);
  const [hist] = await pool.query(
    'SELECT id, entrada, saida, TIMESTAMPDIFF(SECOND, entrada, COALESCE(saida, NOW())) AS segundos FROM ponto WHERE usuario_id = ? ORDER BY entrada DESC LIMIT 30', [req.user.id]);
  res.json({ aberto: aberto[0] || null, segundos_fechados: Number(tot.segundos), historico: hist });
}));

app.post('/api/ponto/entrada', auth, h(async (req, res) => {
  const [aberto] = await pool.query('SELECT id FROM ponto WHERE usuario_id = ? AND saida IS NULL', [req.user.id]);
  if (aberto.length) return res.status(400).json({ erro: 'Você já está com o ponto aberto.' });
  await pool.query('INSERT INTO ponto (usuario_id, entrada) VALUES (?, NOW())', [req.user.id]);
  res.json({ ok: true });
}));

app.post('/api/ponto/saida', auth, h(async (req, res) => {
  const [r] = await pool.query('UPDATE ponto SET saida = NOW() WHERE usuario_id = ? AND saida IS NULL', [req.user.id]);
  if (!r.affectedRows) return res.status(400).json({ erro: 'Você não está com o ponto aberto.' });
  res.json({ ok: true });
}));

// ---------- Ranking ----------
async function calcularRanking() {
  const [rows] = await pool.query(
    `SELECT u.id, u.nome,
       COALESCE((SELECT SUM(TIMESTAMPDIFF(SECOND, p.entrada, COALESCE(p.saida, NOW()))) FROM ponto p WHERE p.usuario_id = u.id), 0) AS segundos,
       (SELECT COUNT(*) FROM ocorrencia_oficiais oo WHERE oo.usuario_id = u.id) AS ocorrencias,
       (SELECT COUNT(*) FROM acao_oficiais ao JOIN acao_veiculos av ON av.acao_id = ao.acao_id AND av.situacao = 'preso' WHERE ao.usuario_id = u.id) AS presos,
       (SELECT COUNT(*) FROM acao_oficiais ao JOIN acoes a ON a.id = ao.acao_id AND a.resultado = 'vitoria' WHERE ao.usuario_id = u.id) AS vitorias
     FROM usuarios u`);
  return rows
    .map((r) => {
      const segundos = Number(r.segundos);
      const horas = Math.floor(segundos / 3600);
      const detalhe = {
        horas: horas * 3,
        ocorrencias: Number(r.ocorrencias) * 3,
        presos: Number(r.presos) * 3,
        vitorias: Number(r.vitorias) * 10,
      };
      return { id: r.id, nome: r.nome, segundos, ocorrencias: Number(r.ocorrencias), presos: Number(r.presos), vitorias: Number(r.vitorias), detalhe, pontos: detalhe.horas + detalhe.ocorrencias + detalhe.presos + detalhe.vitorias };
    })
    .sort((a, b) => b.pontos - a.pontos || b.segundos - a.segundos);
}
app.get('/api/ranking', auth, h(async (req, res) => res.json(await calcularRanking())));

// ---------- Dashboard (admin) ----------
app.get('/api/dashboard', auth, admin, h(async (req, res) => {
  const [[usuarios]] = await pool.query('SELECT COUNT(*) AS total FROM usuarios');
  const [[oc]] = await pool.query('SELECT COUNT(*) AS total, SUM(criado_em >= NOW() - INTERVAL 7 DAY) AS semana FROM ocorrencias');
  const [ocTipos] = await pool.query('SELECT tipo, COUNT(*) AS total FROM ocorrencias GROUP BY tipo ORDER BY total DESC');
  const [[ac]] = await pool.query("SELECT COUNT(*) AS total, SUM(resultado='vitoria') AS vitorias, SUM(resultado='derrota') AS derrotas, SUM(criado_em >= NOW() - INTERVAL 7 DAY) AS semana FROM acoes");
  const [acTipos] = await pool.query("SELECT tipo, COUNT(*) AS total, SUM(resultado='vitoria') AS vitorias, SUM(resultado='derrota') AS derrotas FROM acoes GROUP BY tipo ORDER BY total DESC");
  const [[veic]] = await pool.query("SELECT SUM(situacao='preso') AS presos, SUM(situacao='fuga') AS fugas FROM acao_veiculos");
  const [cursos] = await pool.query(
    `SELECT c.id, c.nome,
       COUNT(p.id) AS provas, COALESCE(SUM(p.aprovado = 1), 0) AS aprovados, COALESCE(SUM(p.aprovado = 0), 0) AS reprovados,
       AVG(p.nota) AS media, COUNT(DISTINCT CASE WHEN p.aprovado = 1 THEN p.usuario_id END) AS oficiais_aprovados
     FROM cursos c LEFT JOIN provas p ON p.curso_id = c.id AND p.status = 'finalizada' GROUP BY c.id ORDER BY c.id`);
  const [[horas]] = await pool.query('SELECT COALESCE(SUM(TIMESTAMPDIFF(SECOND, entrada, COALESCE(saida, NOW()))),0) AS segundos FROM ponto');
  const [[emServico]] = await pool.query('SELECT COUNT(*) AS total FROM ponto WHERE saida IS NULL');
  const ranking = (await calcularRanking()).slice(0, 5);
  res.json({
    usuarios: usuarios.total,
    ocorrencias: { total: oc.total, semana: Number(oc.semana || 0), por_tipo: ocTipos },
    acoes: { total: ac.total, vitorias: Number(ac.vitorias || 0), derrotas: Number(ac.derrotas || 0), semana: Number(ac.semana || 0), por_tipo: acTipos.map((a) => ({ ...a, vitorias: Number(a.vitorias), derrotas: Number(a.derrotas) })), presos: Number(veic.presos || 0), fugas: Number(veic.fugas || 0) },
    cursos: cursos.map((c) => ({ ...c, provas: Number(c.provas), aprovados: Number(c.aprovados), reprovados: Number(c.reprovados), media: c.media === null ? null : Number(c.media) })),
    horas_segundos: Number(horas.segundos),
    em_servico: emServico.total,
    top_ranking: ranking,
  });
}));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API G.A.R rodando em http://localhost:${PORT}`));