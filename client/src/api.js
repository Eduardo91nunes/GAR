
const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const BASE = `${API_URL}/api`;

export const getToken = () => localStorage.getItem('gar_token');

export const setToken = (t) =>
  t
    ? localStorage.setItem('gar_token', t)
    : localStorage.removeItem('gar_token');

export const imagemUrl = (id) =>
  `${BASE}/imagens/${id}?token=${encodeURIComponent(getToken() || '')}`;

export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  const token = getToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let payload;

  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: payload,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.erro || 'Erro na requisição.');
  }

  return data;
}

export const fmtDuracao = (seg) => {
  seg = Math.max(0, Math.floor(seg || 0));

  const h = String(Math.floor(seg / 3600)).padStart(2, '0');
  const m = String(Math.floor((seg % 3600) / 60)).padStart(2, '0');
  const s = String(seg % 60).padStart(2, '0');

  return `${h}:${m}:${s}`;
};

export const fmtData = (iso) =>
  iso
    ? new Date(iso).toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : '—';
