import React from 'react';
import { Flame, Moon, Sun, Leaf } from 'lucide-react';
import { Gamification, Streak } from '../../types';

interface HeaderProps {
  streak: Streak;
  gamification: Gamification;
  isDarkMode: boolean;
  toggleTheme: () => void;
  syncStatus: string;
}

export const Header: React.FC<HeaderProps> = ({
  streak,
  gamification,
  isDarkMode,
  toggleTheme,
  syncStatus
}) => {
  const levelXp = (gamification.level - 1) * 300;
  const xpInLevel = Math.max(0, gamification.xp - levelXp);
  const xpNeeded = 300;
  const pct = Math.min(100, (xpInLevel / xpNeeded) * 100);

  return (
    <header className="mb-5 md:mb-7 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
      <div className="flex flex-col gap-1 w-full md:w-auto">
        <div className="flex items-center justify-between w-full md:w-auto gap-3">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-2" style={{ color: 'var(--text)' }}>
            Mes Révisions <span className="flame text-2xl">🔥</span>
          </h1>
          <button
            onClick={toggleTheme}
            className="md:hidden w-10 h-10 rounded-full card flex items-center justify-center shadow-xs"
          >
            {isDarkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-teal-700" />}
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold" style={{ color: 'var(--muted)' }}>
          <span id="syncIndicator">
            {syncStatus === 'saving' ? '☁️ Synchro…' : 'Synchronisé'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
        {/* Level Badge Pill */}
        <div className="card px-3.5 py-2 flex items-center gap-2.5 rounded-full" style={{ background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.14), rgba(46, 125, 50, 0.08))', border: '1px solid rgba(76, 175, 80, 0.25)' }}>
          <span className="flex items-center justify-center text-emerald-600">
            <Leaf className="w-4 h-4" />
          </span>
          <div className="xp-track w-16 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(76, 175, 80, 0.2)' }}>
            <div className="xp-fill h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: '#2E7D32' }}></div>
          </div>
          <span className="text-xs font-black" style={{ color: '#2E7D32' }}>Niv.{gamification.level}</span>
        </div>

        {/* Streak Badge Pill */}
        <div className="px-3.5 py-2 flex items-center gap-1.5 font-black text-xs text-white rounded-full shadow-xs" style={{ background: 'linear-gradient(135deg, #FF6B35, #FF3D00)' }}>
          <Flame className="w-4 h-4 text-white" />
          <span>{streak.count} j</span>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="hidden md:flex w-10 h-10 rounded-full card items-center justify-center shadow-xs hover:scale-105 transition-transform"
        >
          {isDarkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-teal-700" />}
        </button>
      </div>
    </header>
  );
};
