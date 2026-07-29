import React, { useState } from 'react';

interface LoginOverlayProps {
  onLogin: (password: string) => boolean;
}

export const LoginOverlay: React.FC<LoginOverlayProps> = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = onLogin(password);
    if (!success) {
      setError(true);
    }
  };

  return (
    <div id="loginOverlay" className="login-bg">
      <div className="login-card p-8 md:p-12 w-full max-w-xs mx-4 text-center">
        <div className="bob text-6xl mb-5">📚</div>
        <h2 className="text-2xl font-black mb-1" style={{ color: '#E2F5F2' }}>Mes Révisions</h2>
        <p className="text-sm mb-8" style={{ color: '#7B9C97' }}>Ton espace d'études personnel</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe"
            className="login-inp w-full"
          />
          {error && <p className="text-sm font-bold text-red-500">Mot de passe incorrect</p>}
          <button type="submit" className="btn-main w-full text-base py-3.5 font-extrabold">
            Entrer &rarr;
          </button>
        </form>
        <p className="text-xs mt-8 opacity-40" style={{ color: '#7B9C97' }}>Accès réservé au propriétaire</p>
      </div>
    </div>
  );
};
