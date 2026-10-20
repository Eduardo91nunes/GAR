import { useEffect, useState } from 'react';
import { api } from '../api.js';

const exemplo = `[
  {
    "enunciado": "Texto da pergunta",
    "a": "Alternativa A",
    "b": "Alternativa B",
    "c": "Alternativa C",
    "d": "Alternativa D",
    "correta": "a"
  }
]`;

const vazia = { enunciado: '', a: '', b: '', c: '', d: '', correta: 'a' };

export default function AdminQuestoes() {
  const [cursos, setCursos] = useState([]);
  const [cursoId, setCursoId] = useState('');
  const [resumo, setResumo] = useState('');
  const [questoes, setQuestoes] = useState([]);
  const [form, setForm] = useState(vazia);
  const [json, setJson] = useState('');
  const [msg, setMsg] = useState(null);

  const aviso = (texto, tipo = 'ok') => setMsg({ texto, tipo });

  useEffect(() => {
    api('/cursos').then((d) => {
      setCursos(d.cursos);
      if (d.cursos.length) { setCursoId(String(d.cursos[0].id)); setResumo(d.cursos[0].resumo || ''); }
    });
  }, []);

  const carregarQuestoes = (id) => api(`/cursos/${id}/questoes`).then(setQuestoes).catch((e) => aviso(e.message, 'erro'));
  useEffect(() => { if (cursoId) carregarQuestoes(cursoId); }, [cursoId]);

  function trocarCurso(id) {
    setCursoId(id);
    setResumo(cursos.find((c) => String(c.id) === id)?.resumo || '');
    setMsg(null);
  }

  async function salvarResumo() {
    try {
      await api(`/cursos/${cursoId}`, { method: 'PUT', body: { resumo } });
      setCursos(cursos.map((c) => (String(c.id) === cursoId ? { ...c, resumo } : c)));
      aviso('Resumo salvo.');
    } catch (e) { aviso(e.message, 'erro'); }
  }

  async function addQuestao(e) {
    e.preventDefault();
    try {
      await api('/questoes', { method: 'POST', body: { ...form, curso_id: Number(cursoId) } });
      setForm(vazia);
      aviso('Questão adicionada.');
      carregarQuestoes(cursoId);
    } catch (err) { aviso(err.message, 'erro'); }
  }

  async function importar() {
    try {
      const lista = JSON.parse(json);
      const r = await api('/questoes/importar', { method: 'POST', body: { curso_id: Number(cursoId), questoes: lista } });
      setJson('');
      aviso(`${r.importadas} questões importadas.`);
      carregarQuestoes(cursoId);
    } catch (err) { aviso(err instanceof SyntaxError ? 'JSON inválido.' : err.message, 'erro'); }
  }

  async function excluir(id) {
    if (!window.confirm('Excluir esta questão?')) return;
    await api(`/questoes/${id}`, { method: 'DELETE' });
    carregarQuestoes(cursoId);
  }

  const faltam = Math.max(0, 15 - questoes.length);

  return (
    <>
      <header className="pagina-topo">
        <h2>Cursos e questões</h2>
        <p>Cadastre o resumo e o banco de questões. Cada prova sorteia 15 questões do banco, então cadastre bem mais que 15 por curso.</p>
      </header>

      <section className="card form">
        <label>Curso
          <select value={cursoId} onChange={(e) => trocarCurso(e.target.value)}>
            {cursos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
        <label>Resumo do curso
          <textarea rows={8} value={resumo} onChange={(e) => setResumo(e.target.value)} />
        </label>
        <button className="btn" onClick={salvarResumo}>Salvar resumo</button>
      </section>

      {msg && <div className={'alerta ' + (msg.tipo === 'erro' ? 'erro' : 'sucesso')}>{msg.texto}</div>}

      <div className="grade">
        <form className="card form" onSubmit={addQuestao}>
          <h3>Nova questão</h3>
          <label>Enunciado<textarea rows={3} value={form.enunciado} onChange={(e) => setForm({ ...form, enunciado: e.target.value })} required /></label>
          {['a', 'b', 'c', 'd'].map((l) => (
            <label key={l}>Alternativa {l.toUpperCase()}
              <input value={form[l]} onChange={(e) => setForm({ ...form, [l]: e.target.value })} required />
            </label>
          ))}
          <label>Alternativa correta
            <select value={form.correta} onChange={(e) => setForm({ ...form, correta: e.target.value })}>
              {['a', 'b', 'c', 'd'].map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
            </select>
          </label>
          <button className="btn">Adicionar questão</button>
        </form>

        <section className="card form">
          <h3>Importar várias (JSON)</h3>
          <textarea rows={12} placeholder={exemplo} value={json} onChange={(e) => setJson(e.target.value)} />
          <button className="btn" onClick={importar} disabled={!json.trim()}>Importar questões</button>
        </section>
      </div>

      <section className="card">
        <h3>Banco do curso: {questoes.length} questões</h3>
        {faltam > 0 && <div className="alerta erro">Faltam {faltam} questão(ões) para o mínimo de 15 — enquanto isso, ninguém consegue iniciar prova deste curso.</div>}
        <ol className="revisao">
          {questoes.map((q) => (
            <li key={q.id}>
              <span>{q.enunciado}<br /><small>Correta: {q.correta.toUpperCase()}</small></span>
              <button className="btn btn-perigo" onClick={() => excluir(q.id)}>Excluir</button>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
