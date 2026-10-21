import { useEffect, useState } from 'react';
import { api, imagemUrl, fmtData } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import OficiaisSelect from '../components/OficiaisSelect.jsx';

const vazio = { descricao: '', tipo: '', resultado: '', oficiais: [], veiculos: [] };

export default function Acoes() {
  const { user } = useAuth();
  const [dados, setDados] = useState({ acoes: [], tipos: [] });
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState(vazio);
  const [formKey, setFormKey] = useState(0); // limpa os campos de arquivo após salvar
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const carregar = () => api('/acoes').then(setDados).catch((e) => setErro(e.message));
  useEffect(() => { carregar(); }, []);

  const addVeiculo = () => setForm({ ...form, veiculos: [...form.veiculos, { modelo: '', situacao: 'preso', arquivo: null }] });
  const setVeiculo = (i, campo, valor) =>
    setForm({ ...form, veiculos: form.veiculos.map((v, idx) => (idx === i ? { ...v, [campo]: valor } : v)) });
  const delVeiculo = (i) => setForm({ ...form, veiculos: form.veiculos.filter((_, idx) => idx !== i) });

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append('dados', JSON.stringify({
        ...form,
        veiculos: form.veiculos.map(({ modelo, situacao }) => ({ modelo, situacao })),
      }));
      form.veiculos.forEach((v, i) => {
        if (v.arquivo) fd.append(`imagem_${i}`, v.arquivo);
      });
      await api('/acoes', { method: 'POST', form: fd });
      setForm(vazio);
      setFormKey((k) => k + 1);
      setAberto(false);
      carregar();
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function excluir(id) {
    if (!window.confirm('Excluir esta ação?')) return;
    await api(`/acoes/${id}`, { method: 'DELETE' });
    carregar();
  }

  return (
    <>
      <header className="pagina-topo linha">
        <div>
          <h2>Registro de ação</h2>
          <p>Cada veículo preso vale 3 pontos e cada vitória vale 10 pontos para todos os oficiais da ação.</p>
        </div>
        <button className="btn" onClick={() => setAberto(!aberto)}>{aberto ? 'Fechar' : 'Nova ação'}</button>
      </header>

      {aberto && (
        <form key={formKey} className="card form" onSubmit={enviar}>
          <h3>Nova ação</h3>
          <div className="campos-2">
            <label>Qual ação
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} required>
                <option value="">Selecione…</option>
                {dados.tipos.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label>Resultado da ação
              <select value={form.resultado} onChange={(e) => setForm({ ...form, resultado: e.target.value })} required>
                <option value="">Selecione…</option>
                <option value="vitoria">Vitória</option>
                <option value="derrota">Derrota</option>
              </select>
            </label>
          </div>
          <label>Descrição da ação
            <textarea rows={4} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} required />
          </label>

          <div>
            <span className="rotulo">Modelos dos veículos</span>
            {form.veiculos.map((v, i) => (
              <div key={i} style={{ marginBottom: 14 }}>
                <div className="veiculo-linha" style={{ marginBottom: 6 }}>
                  <input placeholder="Modelo do veículo" value={v.modelo} onChange={(e) => setVeiculo(i, 'modelo', e.target.value)} required />
                  <select value={v.situacao} onChange={(e) => setVeiculo(i, 'situacao', e.target.value)}>
                    <option value="preso">Preso</option>
                    <option value="fuga">Fuga</option>
                  </select>
                  <button type="button" className="btn btn-sec" onClick={() => delVeiculo(i)}>Remover</button>
                </div>
                <label>Imagem do veículo (opcional)
                  <input type="file" accept="image/*" onChange={(e) => setVeiculo(i, 'arquivo', e.target.files[0] || null)} />
                </label>
              </div>
            ))}
            <button type="button" className="btn btn-sec" onClick={addVeiculo}>+ Adicionar veículo</button>
          </div>

          <div>
            <span className="rotulo">Oficiais da ação</span>
            <OficiaisSelect value={form.oficiais} onChange={(oficiais) => setForm({ ...form, oficiais })} />
          </div>

          {erro && <div className="alerta erro">{erro}</div>}
          <button className="btn" disabled={enviando}>{enviando ? 'Salvando…' : 'Registrar ação'}</button>
        </form>
      )}

      {!aberto && erro && <div className="alerta erro">{erro}</div>}

      <div className="grade">
        {dados.acoes.map((a) => (
          <article key={a.id} className="card">
            <div className="card-topo">
              <h3>{a.tipo}</h3>
              <span className={'selo ' + (a.resultado === 'vitoria' ? 'ok' : 'falha')}>{a.resultado === 'vitoria' ? 'Vitória' : 'Derrota'}</span>
            </div>
            <small>{fmtData(a.criado_em)} · registrado por {a.criado_por}</small>
            <p className="resumo">{a.descricao}</p>
            {a.veiculos.length > 0 && (
              <ul className="lista-simples" style={{ listStyle: 'none', padding: 0 }}>
                {a.veiculos.map((v, i) => (
                  <li key={i} style={{ marginBottom: 10 }}>
                    {v.modelo} — <strong>{v.situacao === 'preso' ? 'Preso' : 'Fuga'}</strong>
                    {v.imagem_id && (
                      <img
                        src={imagemUrl(v.imagem_id)}
                        alt={v.modelo}
                        loading="lazy"
                        style={{ display: 'block', width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 8, border: '1px solid #d3d3cd', marginTop: 6 }}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p><strong>Oficiais:</strong> {a.oficiais.join(', ')}</p>
            {user.role === 'admin' && <button className="btn btn-perigo" onClick={() => excluir(a.id)}>Excluir</button>}
          </article>
        ))}
        {!dados.acoes.length && <p className="vazio">Nenhuma ação registrada.</p>}
      </div>
    </>
  );
}