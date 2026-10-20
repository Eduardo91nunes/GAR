import { useEffect, useState } from 'react';
import { api } from '../api.js';

// Lista de checkboxes com todos os usuários do sistema
export default function OficiaisSelect({ value, onChange }) {
  const [users, setUsers] = useState([]);
  const [busca, setBusca] = useState('');

  useEffect(() => {
    api('/usuarios').then(setUsers).catch(() => {});
  }, []);

  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  const filtrados = users.filter((u) => u.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div className="oficiais">
      <input placeholder="Buscar oficial…" value={busca} onChange={(e) => setBusca(e.target.value)} />
      <div className="oficiais-lista">
        {filtrados.map((u) => (
          <label key={u.id} className={'chip' + (value.includes(u.id) ? ' marcado' : '')}>
            <input type="checkbox" checked={value.includes(u.id)} onChange={() => toggle(u.id)} />
            {u.nome}
          </label>
        ))}
        {!filtrados.length && <span className="vazio">Nenhum oficial encontrado.</span>}
      </div>
      <small>{value.length} selecionado(s)</small>
    </div>
  );
}
