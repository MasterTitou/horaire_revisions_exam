import React from 'react';
import { X, CheckCircle, Volume2, Maximize2 } from 'lucide-react';

interface CockpitModalProps {
  isOpen: boolean;
  onClose: () => void;
  formattedTime: string;
  isRunning: boolean;
  onToggleTimer: () => void;
  activeTaskTitle: string;
  activeProjectCode: string;
  sound: string;
  onSoundChange: (newSound: string) => void;
  onCompleteSession: () => void;
}

export const CockpitModal: React.FC<CockpitModalProps> = ({
  isOpen,
  onClose,
  formattedTime,
  isRunning,
  onToggleTimer,
  activeTaskTitle,
  activeProjectCode,
  sound,
  onSoundChange,
  onCompleteSession
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between p-6 md:p-12 text-white bg-radial from-[#142623] to-[#0D1917] animate-fade-in">
      {/* Cockpit Top Bar */}
      <div className="w-full max-w-4xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-black bg-teal-500/20 text-teal-300 border border-teal-500/30 tracking-wider uppercase">
            🚀 Mode Cockpit Immersif
          </span>
          <span className="text-xs font-bold text-teal-400/80">Zéro Distraction</span>
        </div>

        <button
          onClick={onClose}
          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          title="Quitter le Cockpit"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Main Focus Container */}
      <div className="w-full max-w-2xl text-center space-y-8 my-auto">
        {/* Active Task Badge */}
        <div className="space-y-2">
          <span className="inline-block px-3 py-1 rounded-lg text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
            [{activeProjectCode || 'SAAS'}] Jalon en Cours
          </span>
          <h2 className="text-2xl md:text-4xl font-black tracking-tight text-emerald-100 max-w-xl mx-auto leading-tight">
            {activeTaskTitle || 'Session de Travail & Focus WBS'}
          </h2>
        </div>

        {/* Giant Timer Display */}
        <div className="relative py-4">
          <span className="font-mono text-7xl md:text-9xl font-black tracking-wider text-teal-300 drop-shadow-[0_0_35px_rgba(20,184,166,0.35)]">
            {formattedTime}
          </span>
        </div>

        {/* Ambiance Audio Quick Switcher */}
        <div className="flex items-center justify-center gap-3 bg-white/5 backdrop-blur-md p-3 rounded-2xl border border-white/10 max-w-md mx-auto">
          <Volume2 className="w-4 h-4 text-teal-400 shrink-0" />
          <select
            value={sound}
            onChange={e => onSoundChange(e.target.value)}
            className="bg-transparent text-xs font-bold text-teal-200 outline-none cursor-pointer w-full"
          >
            <option value="none" className="bg-[#142623] text-white">🔇 Silence</option>
            <option value="rain" className="bg-[#142623] text-white">🌧️ Ambiance Pluie Apaisante</option>
            <option value="forest" className="bg-[#142623] text-white">🌲 Ambiance Forêt Profonde</option>
            <option value="white" className="bg-[#142623] text-white">⚪ Bruit Blanc Focus</option>
            <option value="lofi" className="bg-[#142623] text-white">🎧 Musique Lo-Fi Beats</option>
          </select>
        </div>

        {/* Cockpit Actions */}
        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            onClick={onToggleTimer}
            className="px-8 py-4 rounded-2xl font-black text-base md:text-lg transition-transform active:scale-95 shadow-xl"
            style={{
              background: isRunning ? 'linear-gradient(135deg, #EF4444, #DC2626)' : 'linear-gradient(135deg, #10B981, #059669)',
              color: '#FFFFFF'
            }}
          >
            {isRunning ? '⏸ Mettre en Pause' : '▶ Lancer la Session'}
          </button>

          <button
            onClick={() => {
              onCompleteSession();
              onClose();
            }}
            className="px-6 py-4 rounded-2xl font-black text-base md:text-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-200 border border-teal-500/40 flex items-center gap-2 transition-transform active:scale-95"
          >
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <span>Valider</span>
          </button>
        </div>
      </div>

      {/* Cockpit Footer Tip */}
      <div className="text-center text-xs font-semibold text-teal-400/60 pb-2">
        💡 Mode Cockpit : Les distractions visuelles et onglets sont masqués pour maximiser l'immersion.
      </div>
    </div>
  );
};
