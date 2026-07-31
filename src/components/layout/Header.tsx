import React from 'react';
import { Zap, Moon, Sun, Leaf, Bell } from 'lucide-react';
import { Gamification, Streak } from '../../types';
import { requestNotificationPermission, sendPushNotification } from '../../notifications/pwaNotifications';

interface HeaderProps {
  streak: Streak;
  gamification: Gamification;
  isDarkMode: boolean;
  toggleTheme: () => void;
  syncStatus: string;
  onOpenQuickParser?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  gamification,
  isDarkMode,
  toggleTheme,
  syncStatus,
  onOpenQuickParser
}) => {
  const velocity = gamification.velocityIndex || 100;
  const velocityColor = velocity >= 85 ? '#2E7D32' : velocity >= 60 ? '#FF8C42' : '#E11D48';
  const velocityBg = velocity >= 85 ? 'rgba(46, 125, 50, 0.12)' : velocity >= 60 ? 'rgba(255, 140, 66, 0.15)' : 'rgba(225, 29, 72, 0.12)';

  const handleToggleNotifications = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      sendPushNotification("Rappels PWA Activés", "Vous recevrez des rappels avant vos créneaux du matin (08h) et de l'après-midi (14h) et des alertes de chemin critique.");
    }
  };

  return (
    <header className="mb-5 md:mb-7 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
      <div className="flex flex-col gap-1 w-full md:w-auto">
        <div className="flex items-center justify-between w-full md:w-auto gap-3">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-2" style={{ color: 'var(--text)' }}>
            Mes Révisions <span className="flame text-2xl">🔥</span>
          </h1>
          <div className="flex items-center gap-2 md:hidden">
            {onOpenQuickParser && (
              <button
                onClick={onOpenQuickParser}
                className="btn-main px-3 py-1.5 text-xs flex items-center gap-1"
              >
                <span>⚡ IA</span>
              </button>
            )}
            <button
              onClick={handleToggleNotifications}
              className="w-10 h-10 rounded-full card flex items-center justify-center shadow-xs"
              title="Activer les notifications PWA"
            >
              <Bell className="w-5 h-5 text-teal-700" />
            </button>
            <button
              onClick={toggleTheme}
              className="w-10 h-10 rounded-full card flex items-center justify-center shadow-xs"
            >
              {isDarkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-teal-700" />}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold" style={{ color: 'var(--muted)' }}>
          <span id="syncIndicator">
            {syncStatus === 'saving' ? '☁️ Synchro…' : 'Synchronisé'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
        {onOpenQuickParser && (
          <button
            onClick={onOpenQuickParser}
            className="btn-main hidden md:flex px-3.5 py-2 text-xs items-center gap-1.5 shadow-sm hover:scale-105 transition-all"
          >
            <span>⚡ Saisie Rapide IA</span>
          </button>
        )}

        {/* Indice de Vélocité Performance Pill */}
        <div
          className="px-3.5 py-2 flex items-center gap-1.5 font-black text-xs rounded-full shadow-xs transition-all"
          style={{ background: velocityBg, color: velocityColor, border: `1px solid ${velocityColor}40` }}
          title="Indice de Vélocité (Heures Exécutées / Heures Prévues sur 14j)"
        >
          <Zap className="w-4 h-4" />
          <span>{velocity}% Vélocité</span>
        </div>

        {/* Level Badge Pill */}
        <div className="card px-3.5 py-2 flex items-center gap-2 rounded-full" style={{ background: 'var(--terra-l)', border: '1px solid var(--border)' }}>
          <span className="flex items-center justify-center text-teal-700">
            <Leaf className="w-4 h-4" />
          </span>
          <span className="text-xs font-black" style={{ color: 'var(--terra)' }}>Maîtrise Niv.{gamification.level}</span>
        </div>

        {/* Notification Bell Toggle */}
        <button
          onClick={handleToggleNotifications}
          className="hidden md:flex w-10 h-10 rounded-full card items-center justify-center shadow-xs hover:scale-105 transition-transform"
          title="Activer les notifications PWA"
        >
          <Bell className="w-5 h-5 text-teal-700" />
        </button>

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

