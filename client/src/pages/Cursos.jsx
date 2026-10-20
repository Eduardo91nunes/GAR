import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtData } from '../api.js';

export default function Cursos() {
  const [dados, setDados] = useState(null);
  const [provas, setProvas] = useState([]);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api('/cursos').then(setDados).catch((e) => setErro(e.message));
    api('/provas/minhas').then(setProvas).catch(() => {});
  }, []);

  if (erro) return <div className="alerta erro">{erro}</div>;
  if (!dados) return <p>Carregando…</p>;

  return (
    <>
      <header className="pagina-topo">
        <h2>Cursos e provas</h2>
        <p>Cada prova sorteia {dados.qtd_questoes} questões diferentes. Nota de corte: {dados.nota_corte}.</p>
      </header>

      <div className="grade">
        {dados.cursos.map((c) => (
          <section key={c.id} className="card">
            <div className="card-topo">
              <h3>{c.nome}</h3>
              {c.aprovacoes > 0 && <span className="selo ok">Aprovado</span>}
            </div>
            <p className="resumo">{c.resumo || 'O resumo deste curso ainda não foi cadastrado.'}</p>
            <div className="meta">
              <span>Melhor nota: <strong>{c.melhor_nota !== null ? Number(c.melhor_nota).toFixed(2) : '—'}</strong></span>
              <span>Banco: {c.total_questoes} questões</span>
            </div>
            <Link className="btn" to={`/provas/${c.id}`}>Fazer prova</Link>
          </section>
        ))}
      </div>

      <section className="card">
        <h3>Minhas últimas provas</h3>
        {provas.length === 0 ? (
          <p className="vazio">Você ainda não realizou nenhuma prova.</p>
        ) : (
          <div className="tabela-wrap">
            <table>
              <thead><tr><th>Curso</th><th>Nota</th><th>Resultado</th><th>Data</th></tr></thead>
              <tbody>
                {provas.map((p) => (
                  <tr key={p.id}>
                    <td>{p.curso}</td>
                    <td>{Number(p.nota).toFixed(2)}</td>
                    <td><span className={'selo ' + (p.aprovado ? 'ok' : 'falha')}>{p.aprovado ? 'Aprovado' : 'Reprovado'}</span></td>
                    <td>{fmtData(p.finalizada_em)}</td>
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
