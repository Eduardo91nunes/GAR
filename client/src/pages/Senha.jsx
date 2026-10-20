import { useState } from 'react';
import { api } from '../api.js';

export default function Senha() {
  const [form, setForm] = useState({ senha_atual: '', nova_senha: '', confirmar: '' });
  const [msg, setMsg] = useState(null);

  async function enviar(e) {
    e.preventDefault();
    if (form.nova_senha !== form.confirmar) return setMsg({ tipo: 'erro', texto: 'A confirmação não confere.' });
    try {
      await api('/me/senha', { method: 'PATCH', body: { senha_atual: form.senha_atual, nova_senha: form.nova_senha } });
      setForm({ senha_atual: '', nova_senha: '', confirmar: '' });
      setMsg({ tipo: 'sucesso', texto: 'Senha alterada com sucesso.' });
    } catch (err) {
      setMsg({ tipo: 'erro', texto: err.message });
    }
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <header className="pagina-topo"><h2>Alterar senha</h2></header>
      <form className="card form" style={{ maxWidth: 420 }} onSubmit={enviar}>
        <label>Senha atual<input type="password" value={form.senha_atual} onChange={set('senha_atual')} required /></label>
        <label>Nova senha<input type="password" minLength={6} value={form.nova_senha} onChange={set('nova_senha')} required /></label>
        <label>Confirmar nova senha<input type="password" minLength={6} value={form.confirmar} onChange={set('confirmar')} required /></label>
        {msg && <div className={'alerta ' + msg.tipo}>{msg.texto}</div>}
        <button className="btn">Salvar nova senha</button>
      </form>
    </>
  );
}