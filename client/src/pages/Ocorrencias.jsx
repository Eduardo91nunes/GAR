import { useEffect, useState } from 'react';
import { api, imagemUrl, fmtData } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import OficiaisSelect from '../components/OficiaisSelect.jsx';

const vazio = { tipo: '', modelo_veiculo: '', descricao: '', oficiais: [], imagem: null };

export default function Ocorrencias() {
  const { user } = useAuth();
  const [dados, setDados] = useState({ ocorrencias: [], tipos: [] });
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState(vazio);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [filtro, setFiltro] = useState('');

  const carregar = () => api('/ocorrencias').then(setDados).catch((e) => setErro(e.message));
  useEffect(() => { carregar(); }, []);

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    if (!form.imagem) return setErro('Anexe a imagem do veículo.');
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append('tipo', form.tipo);
      fd.append('modelo_veiculo', form.modelo_veiculo);
      fd.append('descricao', form.descricao);
      fd.append('oficiais', JSON.stringify(form.oficiais));
      fd.append('imagem', form.imagem);
      await api('/ocorrencias', { method: 'POST', form: fd });
      setForm(vazio);
      setAberto(false);
      carregar();
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function excluir(id) {
    if (!window.confirm('Excluir esta ocorrência?')) return;
    await api(`/ocorrencias/${id}`, { method: 'DELETE' });
    carregar();
  }

  const lista = dados.ocorrencias.filter((o) => !filtro || o.tipo === filtro);

  return (
    <>
      <header className="pagina-topo linha">
        <div>
          <h2>Registro de ocorrência</h2>
          <p>Cada ocorrência registrada vale 3 pontos para todos os oficiais envolvidos.</p>
        </div>
        <button className="btn" onClick={() => setAberto(!aberto)}>{aberto ? 'Fechar' : 'Nova ocorrência'}</button>
      </header>

      {aberto && (
        <form className="card form" onSubmit={enviar}>
          <h3>Nova ocorrência</h3>
          <div className="campos-2">
            <label>Tipo de ocorrência
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} required>
                <option value="">Selecione…</option>
                {dados.tipos.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label>Modelo do veículo
              <input value={form.modelo_veiculo} onChange={(e) => setForm({ ...form, modelo_veiculo: e.target.value })} required />
            </label>
          </div>
          <label>Imagem do veículo
            <input type="file" accept="image/*" onChange={(e) => setForm({ ...form, imagem: e.target.files[0] || null })} required />
          </label>
          <label>Observações (opcional)
            <textarea rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          </label>
          <div>
            <span className="rotulo">Oficiais da unidade na ocorrência</span>
            <OficiaisSelect value={form.oficiais} onChange={(oficiais) => setForm({ ...form, oficiais })} />
          </div>
          {erro && <div className="alerta erro">{erro}</div>}
          <button className="btn" disabled={enviando}>{enviando ? 'Salvando…' : 'Registrar ocorrência'}</button>
        </form>
      )}

      {!aberto && erro && <div className="alerta erro">{erro}</div>}

      <div className="filtros">
        <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="">Todos os tipos</option>
          {dados.tipos.map((t) => <option key={t}>{t}</option>)}
        </select>
        <span>{lista.length} registro(s)</span>
      </div>

      <div className="grade">
        {lista.map((o) => (
          <article key={o.id} className="card ocorrencia">
            {o.imagem_id && <img src={imagemUrl(o.imagem_id)} alt={o.modelo_veiculo} loading="lazy" />}
            <div className="card-topo">
              <h3>{o.tipo}</h3>
              <small>{fmtData(o.criado_em)}</small>
            </div>
            <p><strong>Veículo:</strong> {o.modelo_veiculo}</p>
            <p><strong>Oficiais:</strong> {o.oficiais}</p>
            {o.descricao && <p className="resumo">{o.descricao}</p>}
            <small>Registrado por {o.criado_por}</small>
            {user.role === 'admin' && <button className="btn btn-perigo" onClick={() => excluir(o.id)}>Excluir</button>}
          </article>
        ))}
        {!lista.length && <p className="vazio">Nenhuma ocorrência registrada.</p>}
      </div>
    </>
  );
}
