import { useState } from 'react';

export default function Logo({ size = 80 }) {
  const [erro, setErro] = useState(false);
  if (erro) return <div className="logo-fallback" style={{ width: size, height: size }}>G.A.R</div>;
  return <img src="/logo-gar.png" alt="Brasão G.A.R" width={size} height={size} className="logo" onError={() => setErro(true)} />;
}
