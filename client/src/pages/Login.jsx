import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import Logo from '../components/Logo.jsx';

export default function Login() {
  const { user, entrar } = useAuth();
  const nav = useNavigate();
  const [modo, setModo] = useState('login');
  const [form, setForm] = useState({ nome: '', usuario: '', senha: '' });
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      const rota = modo === 'login' ? '/auth/login' : '/auth/registrar';
      const data = await api(rota, { method: 'POST', body: form });
      entrar(data.token, data.user);
      nav(data.user.role === 'admin' ? '/dashboard' : '/ranking', { replace: true });
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="login-tela">
      <form className="login-card" onSubmit={enviar}>
        <Logo size={150} />
        <h1>G.A.R</h1>
        <p className="sub">Grupamento de Apoio Rápido</p>

        {modo === 'cadastro' && (
          <label>Nome completo
            <input value={form.nome} onChange={set('nome')} required autoComplete="name" />
          </label>
        )}
        <label>Usuário
          <input value={form.usuario} onChange={set('usuario')} required autoComplete="username" />
        </label>
        <label>Senha
          <input type="password" value={form.senha} onChange={set('senha')} required minLength={modo === 'cadastro' ? 6 : undefined} autoComplete={modo === 'login' ? 'current-password' : 'new-password'} />
        </label>

        {erro && <div className="alerta erro">{erro}</div>}

        <button className="btn" disabled={enviando}>{modo === 'login' ? 'Entrar' : 'Criar conta'}</button>
        <button type="button" className="link" onClick={() => { setModo(modo === 'login' ? 'cadastro' : 'login'); setErro(''); }}>
          {modo === 'login' ? 'Ainda não tenho usuário — criar conta' : 'Já tenho conta — entrar'}
        </button>
      </form>
    </div>
  );
}
