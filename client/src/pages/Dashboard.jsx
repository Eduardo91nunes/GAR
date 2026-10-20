import { useEffect, useState } from 'react';
import { api, fmtDuracao } from '../api.js';

function Barras({ itens, rotulo, valor }) {
  const max = Math.max(1, ...itens.map(valor));
  if (!itens.length) return <p className="vazio">Sem dados ainda.</p>;
  return (
    <ul className="barras">
      {itens.map((it) => (
        <li key={rotulo(it)}>
          <span className="barras-rotulo">{rotulo(it)}</span>
          <span className="barras-trilho"><span style={{ width: `${(valor(it) / max) * 100}%` }} /></span>
          <strong>{valor(it)}</strong>
        </li>
      ))}
    </ul>
  );
}

export default function Dashboard() {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api('/dashboard').then(setD).catch((e) => setErro(e.message));
  }, []);

  if (erro) return <div className="alerta erro">{erro}</div>;
  if (!d) return <p>Carregando…</p>;

  const taxa = d.acoes.total ? Math.round((d.acoes.vitorias / d.acoes.total) * 100) : 0;

  return (
    <>
      <header className="pagina-topo">
        <h2>Dashboard</h2>
        <p>Andamento da unidade em cursos, ocorrências e ações.</p>
      </header>

      <div className="kpis">
        <div className="kpi"><span>Oficiais cadastrados</span><strong>{d.usuarios}</strong><small>{d.em_servico} em serviço agora</small></div>
        <div className="kpi"><span>Ocorrências</span><strong>{d.ocorrencias.total}</strong><small>{d.ocorrencias.semana} nos últimos 7 dias</small></div>
        <div className="kpi"><span>Ações</span><strong>{d.acoes.total}</strong><small>{d.acoes.semana} nos últimos 7 dias</small></div>
        <div className="kpi"><span>Taxa de vitória</span><strong>{taxa}%</strong><small>{d.acoes.vitorias} vitórias · {d.acoes.derrotas} derrotas</small></div>
        <div className="kpi"><span>Veículos presos</span><strong>{d.acoes.presos}</strong><small>{d.acoes.fugas} fugas</small></div>
        <div className="kpi"><span>Horas em serviço</span><strong>{fmtDuracao(d.horas_segundos)}</strong><small>total da unidade</small></div>
      </div>

      <div className="grade">
        <section className="card">
          <h3>Cursos</h3>
          <div className="tabela-wrap">
            <table>
              <thead><tr><th>Curso</th><th>Provas</th><th>Aprov.</th><th>Reprov.</th><th>Média</th><th>Oficiais aprovados</th></tr></thead>
              <tbody>
                {d.cursos.map((c) => (
                  <tr key={c.id}>
                    <td>{c.nome}</td><td>{c.provas}</td><td>{c.aprovados}</td><td>{c.reprovados}</td>
                    <td>{c.media === null ? '—' : c.media.toFixed(2)}</td>
                    <td>{c.oficiais_aprovados} / {d.usuarios}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <h3>Top 5 do ranking</h3>
          <ol className="lista-simples">
            {d.top_ranking.map((r) => <li key={r.id}>{r.nome} — <strong>{r.pontos} pts</strong></li>)}
          </ol>
        </section>

        <section className="card">
          <h3>Ocorrências por tipo</h3>
          <Barras itens={d.ocorrencias.por_tipo} rotulo={(i) => i.tipo} valor={(i) => i.total} />
        </section>

        <section className="card">
          <h3>Ações por tipo</h3>
          <Barras itens={d.acoes.por_tipo} rotulo={(i) => i.tipo} valor={(i) => i.total} />
          <div className="tabela-wrap">
            <table>
              <thead><tr><th>Ação</th><th>Vitórias</th><th>Derrotas</th></tr></thead>
              <tbody>
                {d.acoes.por_tipo.map((a) => <tr key={a.tipo}><td>{a.tipo}</td><td>{a.vitorias}</td><td>{a.derrotas}</td></tr>)}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
