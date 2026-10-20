import { useEffect, useState } from 'react';
import { api, fmtDuracao } from '../api.js';
import { useAuth } from '../AuthContext.jsx';

export default function Ranking() {
  const { user } = useAuth();
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api('/ranking').then(setLista).catch((e) => setErro(e.message));
  }, []);

  if (erro) return <div className="alerta erro">{erro}</div>;
  if (!lista) return <p>Carregando…</p>;

  return (
    <>
      <header className="pagina-topo">
        <h2>Ranking da unidade</h2>
        <p>Pontuação: 3 pts por hora em serviço · 3 pts por ocorrência · 3 pts por veículo preso · 10 pts por vitória.</p>
      </header>

      <section className="card">
        <div className="tabela-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th><th>Oficial</th><th>Horas</th><th>Ocorrências</th><th>Presos</th><th>Vitórias</th><th>Pontos</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((r, i) => (
                <tr key={r.id} className={r.id === user.id ? 'destaque' : ''}>
                  <td><span className={'pos pos-' + (i + 1)}>{i + 1}</span></td>
                  <td>{r.nome}</td>
                  <td>{fmtDuracao(r.segundos)}</td>
                  <td>{r.ocorrencias}</td>
                  <td>{r.presos}</td>
                  <td>{r.vitorias}</td>
                  <td><strong>{r.pontos}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
