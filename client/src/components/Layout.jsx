import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import Logo from './Logo.jsx';

export default function Layout() {
  const { user, sair } = useAuth();
  const nav = useNavigate();
  const admin = user.role === 'admin';

  const link = (to, label) => (
    <NavLink to={to} className={({ isActive }) => 'nav-link' + (isActive ? ' ativo' : '')}>
      {label}
    </NavLink>
  );

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-topo">
          <Logo size={64} />
          <div>
            <strong>G.A.R</strong>
            <small>Grupamento de Apoio Rápido</small>
          </div>
        </div>
        <nav>
          {admin && (
            <>
              <span className="nav-titulo">Administração</span>
              {link('/dashboard', 'Dashboard')}
              {link('/admin/questoes', 'Cursos e questões')}
              {link('/admin/usuarios', 'Usuários')}
            </>
          )}
          <span className="nav-titulo">Unidade</span>
          {link('/ranking', 'Ranking')}
          {link('/ponto', 'Bate-ponto')}
          {link('/ocorrencias', 'Registro de ocorrência')}
          {link('/acoes', 'Registro de ação')}
          {link('/cursos', 'Cursos e provas')}
        </nav>
        <div className="sidebar-rodape">
          <div>
            <strong>{user.nome}</strong>
            <small>{admin ? 'Administrador' : 'Oficial'}</small>
          </div>
          <button className="btn btn-sec" onClick={() => { sair(); nav('/login'); }}>Sair</button>
        </div>
      </aside>
      <main className="conteudo">
        <Outlet />
      </main>
    </div>
  );
}
