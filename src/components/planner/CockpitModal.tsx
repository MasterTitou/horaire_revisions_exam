import React, { useState } from 'react';
import { X, CheckCircle, Volume2, Sparkles, Play, Pause, RotateCcw } from 'lucide-react';

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
  const [showAiSteps, setShowAiSteps] = useState(false);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-between px-4 pb-6 md:p-8 backdrop-blur-xl bg-slate-950/90 animate-fade-in text-white overflow-hidden"
      style={{ paddingTop: 'max(3rem, env(safe-area-inset-top))' }}
    >
      {/* Background Soft Glow Auras */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-teal-500/15 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Cockpit Top Bar */}
      <div className="w-full max-w-4xl flex items-center justify-between z-10 pt-2">
        <div className="flex items-center gap-3">
          <span className="px-3.5 py-1.5 rounded-full text-xs font-black bg-teal-500/20 text-teal-300 border border-teal-500/30 uppercase tracking-widest flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            Mode Cockpit Focus
          </span>
          <span className="text-xs font-extrabold text-teal-200/60 hidden sm:inline">
            Immersion Zéro Distraction
          </span>
        </div>

        <button
          onClick={onClose}
          className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all transform hover:scale-105"
          title="Quitter le Cockpit"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Focus Center Card */}
      <div className="w-full max-w-2xl text-center space-y-6 my-auto z-10">
        {/* Active Task Badge */}
        <div className="space-y-2">
          <span className="inline-block px-3 py-1 rounded-full text-[11px] font-black bg-teal-500/15 text-teal-300 border border-teal-500/30 uppercase">
            [{activeProjectCode || 'SAAS'}] Jalon WBS Actif
          </span>
          <h2 className="text-2xl md:text-4xl font-black tracking-tight text-white max-w-xl mx-auto leading-snug">
            {activeTaskTitle || 'Session de Travail & Focus WBS'}
          </h2>
        </div>

        {/* Giant Timer Ring Display */}
        <div className="relative py-2 flex justify-center items-center">
          <div className="w-64 h-64 md:w-80 md:h-80 rounded-full border-4 border-teal-500/20 flex items-center justify-center relative bg-slate-900/50 backdrop-blur-md shadow-[0_0_50px_rgba(14,132,120,0.25)]">
            <span className="font-mono text-6xl md:text-7xl font-black tracking-wider text-teal-300 drop-shadow-[0_0_25px_rgba(20,184,166,0.4)]">
              {formattedTime}
            </span>
          </div>
        </div>

        {/* Ambiance Audio Quick Switcher */}
        <div className="flex items-center justify-center gap-3 bg-white/5 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 max-w-md mx-auto">
          <Volume2 className="w-4 h-4 text-teal-400 shrink-0" />
          <select
            value={sound}
            onChange={e => onSoundChange(e.target.value)}
            className="bg-transparent text-xs font-extrabold text-teal-200 outline-none cursor-pointer w-full"
          >
            <option value="none" className="bg-slate-900 text-white">🔇 Silence Apaisant</option>
            <option value="rain" className="bg-slate-900 text-white">🌧️ Ambiance Pluie Apaisante</option>
            <option value="forest" className="bg-slate-900 text-white">🌲 Ambiance Forêt Profonde</option>
            <option value="white" className="bg-slate-900 text-white">⚪ Bruit Blanc Focus</option>
            <option value="lofi" className="bg-slate-900 text-white">🎧 Musique Lo-Fi Beats</option>
          </select>
        </div>

        {/* AI Session Guidance Button & Box */}
        <div className="max-w-md mx-auto">
          <button
            onClick={() => setShowAiSteps(!showAiSteps)}
            className="text-xs font-black px-4 py-2 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 flex items-center justify-center gap-1.5 mx-auto transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            <span>{showAiSteps ? 'Masquer le plan d\'action IA' : '💡 Astuce & Plan d\'action IA en 3 étapes'}</span>
          </button>

          {showAiSteps && (
            <div className="mt-3 p-4 rounded-2xl bg-teal-950/40 border border-teal-500/30 text-left space-y-2 animate-fade-in text-xs">
              <span className="font-extrabold text-teal-300 block">🤖 Plan d'Exécution Optimisé IA :</span>
              <ul className="space-y-1.5 text-teal-100/90 font-medium">
                <li>1. 🎯 <strong>Clarifier l'objectif final</strong> de ce jalon sans interruption pendant 25 min.</li>
                <li>2. ⚙️ <strong>Exécuter en sous-étapes simples</strong> et noter tout blocage pour la calibration.</li>
                <li>3. Check <strong>Valider la séance</strong> pour alimenter votre vélocité et votre arbre de compétences !</li>
              </ul>
            </div>
          )}
        </div>

        {/* Cockpit Actions */}
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={onToggleTimer}
            className="px-8 py-3.5 rounded-2xl font-black text-sm md:text-base flex items-center gap-2 transition-all transform active:scale-95 shadow-lg"
            style={{
              background: isRunning ? 'linear-gradient(135deg, #EF4444, #DC2626)' : 'linear-gradient(135deg, #0E8478, #0B6B61)',
              color: '#FFFFFF'
            }}
          >
            {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
            <span>{isRunning ? 'Pause' : 'Démarrer'}</span>
          </button>

          <button
            onClick={() => {
              onCompleteSession();
              onClose();
            }}
            className="px-6 py-3.5 rounded-2xl font-black text-sm md:text-base bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 flex items-center gap-2 transition-all transform active:scale-95"
          >
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>Valider la Séance</span>
          </button>
        </div>
      </div>

      {/* Cockpit Footer */}
      <div className="text-center text-xs font-semibold text-teal-300/50 pb-2 z-10">
        💡 Vos données de séance sont synchronisées en continu avec la vélocité et l'arbre de compétences.
      </div>
    </div>
  );
};
