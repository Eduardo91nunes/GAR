import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api.js';

export default function Prova() {
  const { cursoId } = useParams();
  const [prova, setProva] = useState(null);
  const [respostas, setRespostas] = useState({});
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function iniciar() {
    setErro('');
    setCarregando(true);
    try {
      setProva(await api('/provas/iniciar', { method: 'POST', body: { curso_id: Number(cursoId) } }));
      setRespostas({});
      setResultado(null);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  async function finalizar() {
    const faltam = prova.questoes.length - Object.keys(respostas).length;
    if (faltam > 0 && !window.confirm(`Faltam ${faltam} questão(ões) sem resposta. Finalizar mesmo assim?`)) return;
    setCarregando(true);
    try {
      setResultado(await api(`/provas/${prova.prova_id}/finalizar`, { method: 'POST', body: { respostas } }));
      window.scrollTo({ top: 0 });
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  if (resultado) {
    return (
      <>
        <header className="pagina-topo"><h2>Resultado — {prova.curso}</h2></header>
        <section className="card resultado">
          <div className={'nota-grande ' + (resultado.aprovado ? 'ok' : 'falha')}>{resultado.nota.toFixed(2)}</div>
          <h3>{resultado.aprovado ? 'Aprovado!' : 'Reprovado'}</h3>
          <p>Você acertou {resultado.acertos} de {resultado.total} questões. Nota de corte: {resultado.nota_corte}.</p>
          <div className="acoes-linha">
            <button className="btn" onClick={iniciar} disabled={carregando}>Fazer nova prova (questões novas)</button>
            <Link className="btn btn-sec" to="/cursos">Voltar aos cursos</Link>
          </div>
        </section>
        <section className="card">
          <h3>Revisão</h3>
          <ol className="revisao">
            {resultado.detalhes.map((d) => (
              <li key={d.questao_id} className={d.acertou ? 'ok' : 'falha'}>
                <span>{d.enunciado}</span>
                <strong>{d.acertou ? 'Acertou' : d.marcada ? 'Errou' : 'Em branco'}</strong>
              </li>
            ))}
          </ol>
        </section>
      </>
    );
  }

  if (!prova) {
    return (
      <>
        <header className="pagina-topo"><h2>Prova</h2></header>
        <section className="card">
          <p>Ao iniciar, o sistema sorteia <strong>15 questões</strong> do banco do curso. A nota de corte é <strong>7</strong>. Quando você iniciar outra prova, as questões serão sorteadas novamente.</p>
          {erro && <div className="alerta erro">{erro}</div>}
          <div className="acoes-linha">
            <button className="btn" onClick={iniciar} disabled={carregando}>{carregando ? 'Sorteando questões…' : 'Iniciar prova'}</button>
            <Link className="btn btn-sec" to="/cursos">Cancelar</Link>
          </div>
        </section>
      </>
    );
  }

  const total = prova.questoes.length;
  const feitas = Object.keys(respostas).length;

  return (
    <>
      <header className="pagina-topo">
        <h2>Prova — {prova.curso}</h2>
        <p>{feitas} de {total} respondidas</p>
        <div className="barra"><span style={{ width: `${(feitas / total) * 100}%` }} /></div>
      </header>

      {prova.questoes.map((q, i) => (
        <section key={q.id} className="card questao">
          <h3>{i + 1}. {q.enunciado}</h3>
          {['a', 'b', 'c', 'd'].map((l) => (
            <label key={l} className={'opcao' + (respostas[q.id] === l ? ' marcada' : '')}>
              <input type="radio" name={`q${q.id}`} checked={respostas[q.id] === l} onChange={() => setRespostas({ ...respostas, [q.id]: l })} />
              <span><strong>{l.toUpperCase()})</strong> {q[`opcao_${l}`]}</span>
            </label>
          ))}
        </section>
      ))}

      {erro && <div className="alerta erro">{erro}</div>}
      <button className="btn btn-grande" onClick={finalizar} disabled={carregando}>Finalizar prova</button>
    </>
  );
}
