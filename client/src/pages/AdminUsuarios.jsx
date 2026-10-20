import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';

export default function AdminUsuarios() {
  const { user } = useAuth();
  const [lista, setLista] = useState([]);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [alvo, setAlvo] = useState(null); // usuário que terá a senha redefinida
  const [novaSenha, setNovaSenha] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = () => api('/usuarios').then(setLista).catch((e) => setErro(e.message));
  useEffect(() => { carregar(); }, []);

  async function alternar(u) {
    setErro('');
    setSucesso('');
    try {
      await api(`/usuarios/${u.id}/role`, { method: 'PATCH', body: { role: u.role === 'admin' ? 'oficial' : 'admin' } });
      carregar();
    } catch (e) { setErro(e.message); }
  }

  function abrirRedefinir(u) {
    setErro('');
    setSucesso('');
    setNovaSenha('');
    setAlvo(u);
  }

  async function salvarSenha(e) {
    e.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      await api(`/usuarios/${alvo.id}/senha`, { method: 'PATCH', body: { nova_senha: novaSenha } });
      setSucesso(`Senha de ${alvo.nome} redefinida com sucesso.`);
      setAlvo(null);
      setNovaSenha('');
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <header className="pagina-topo">
        <h2>Usuários</h2>
        <p>Defina quem terá acesso administrativo (dashboard e cadastro de questões) e redefina senhas.</p>
      </header>

      {erro && <div className="alerta erro">{erro}</div>}
      {sucesso && <div className="alerta sucesso">{sucesso}</div>}

      {alvo && (
        <form className="card form" onSubmit={salvarSenha} style={{ maxWidth: 420 }}>
          <h3>Redefinir senha de {alvo.nome}</h3>
          <label>Nova senha (mínimo 6 caracteres)
            <input
              type="text"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              minLength={6}
              autoFocus
              required
            />
          </label>
          <div className="acoes-linha">
            <button className="btn" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar nova senha'}</button>
            <button type="button" className="btn btn-sec" onClick={() => setAlvo(null)}>Cancelar</button>
          </div>
        </form>
      )}

      <section className="card">
        <div className="tabela-wrap">
          <table>
            <thead><tr><th>Nome</th><th>Usuário</th><th>Perfil</th><th></th></tr></thead>
            <tbody>
              {lista.map((u) => (
                <tr key={u.id}>
                  <td>{u.nome}</td>
                  <td>{u.usuario}</td>
                  <td><span className={'selo ' + (u.role === 'admin' ? 'ok' : '')}>{u.role === 'admin' ? 'Administrador' : 'Oficial'}</span></td>
                  <td>
                    {u.id !== user.id && (
                      <button className="btn btn-sec" onClick={() => alternar(u)}>
                        {u.role === 'admin' ? 'Remover admin' : 'Tornar admin'}
                      </button>
                    )}{' '}
                    <button className="btn btn-sec" onClick={() => abrirRedefinir(u)}>Redefinir senha</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}