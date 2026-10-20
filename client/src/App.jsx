import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Cursos from './pages/Cursos.jsx';
import Prova from './pages/Prova.jsx';
import Ocorrencias from './pages/Ocorrencias.jsx';
import Acoes from './pages/Acoes.jsx';
import Ponto from './pages/Ponto.jsx';
import Ranking from './pages/Ranking.jsx';
import Dashboard from './pages/Dashboard.jsx';
import AdminQuestoes from './pages/AdminQuestoes.jsx';
import AdminUsuarios from './pages/AdminUsuarios.jsx';

function Protegida({ children, soAdmin }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="tela-cheia">Carregando…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (soAdmin && user.role !== 'admin') return <Navigate to="/ranking" replace />;
  return children;
}

function Inicio() {
  const { user } = useAuth();
  return <Navigate to={user?.role === 'admin' ? '/dashboard' : '/ranking'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protegida><Layout /></Protegida>}>
        <Route index element={<Inicio />} />
        <Route path="/cursos" element={<Cursos />} />
        <Route path="/provas/:cursoId" element={<Prova />} />
        <Route path="/ocorrencias" element={<Ocorrencias />} />
        <Route path="/acoes" element={<Acoes />} />
        <Route path="/ponto" element={<Ponto />} />
        <Route path="/ranking" element={<Ranking />} />
        <Route path="/dashboard" element={<Protegida soAdmin><Dashboard /></Protegida>} />
        <Route path="/admin/questoes" element={<Protegida soAdmin><AdminQuestoes /></Protegida>} />
        <Route path="/admin/usuarios" element={<Protegida soAdmin><AdminUsuarios /></Protegida>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
