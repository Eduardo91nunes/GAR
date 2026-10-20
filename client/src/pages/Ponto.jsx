import { useEffect, useState } from 'react';
import { api, fmtDuracao, fmtData } from '../api.js';

export default function Ponto() {
  const [status, setStatus] = useState(null);
  const [agora, setAgora] = useState(Date.now());
  const [erro, setErro] = useState('');
  const [busy, setBusy] = useState(false);

  const carregar = () => api('/ponto/status').then(setStatus).catch((e) => setErro(e.message));
  useEffect(() => { carregar(); }, []);
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  async function acao(rota) {
    setErro('');
    setBusy(true);
    try {
      await api(`/ponto/${rota}`, { method: 'POST' });
      await carregar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!status) return <p>Carregando…</p>;

  const sessaoSeg = status.aberto ? (agora - new Date(status.aberto.entrada).getTime()) / 1000 : 0;
  const totalSeg = status.segundos_fechados + sessaoSeg;

  return (
    <>
      <header className="pagina-topo">
        <h2>Bate-ponto</h2>
        <p>A cada hora completa de serviço você ganha 3 pontos no ranking.</p>
      </header>

      <section className="card ponto-card">
        <div className={'ponto-status ' + (status.aberto ? 'ativo' : '')}>{status.aberto ? 'Em serviço' : 'Fora de serviço'}</div>
        <div className="relogio">{fmtDuracao(sessaoSeg)}</div>
        <small>Sessão atual {status.aberto && `· entrada às ${fmtData(status.aberto.entrada)}`}</small>
        {status.aberto ? (
          <button className="btn btn-grande" onClick={() => acao('saida')} disabled={busy}>Bater ponto — saída</button>
        ) : (
          <button className="btn btn-grande" onClick={() => acao('entrada')} disabled={busy}>Bater ponto — entrada</button>
        )}
        {erro && <div className="alerta erro">{erro}</div>}
        <div className="total">Total acumulado: <strong>{fmtDuracao(totalSeg)}</strong></div>
      </section>

      <section className="card">
        <h3>Meus últimos registros</h3>
        {status.historico.length === 0 ? (
          <p className="vazio">Nenhum registro ainda.</p>
        ) : (
          <div className="tabela-wrap">
            <table>
              <thead><tr><th>Entrada</th><th>Saída</th><th>Duração</th></tr></thead>
              <tbody>
                {status.historico.map((p) => (
                  <tr key={p.id}>
                    <td>{fmtData(p.entrada)}</td>
                    <td>{p.saida ? fmtData(p.saida) : 'Em andamento'}</td>
                    <td>{fmtDuracao(p.saida ? p.segundos : (agora - new Date(p.entrada).getTime()) / 1000)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
