import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, X, Settings, Maximize2 } from 'lucide-react';
import { CockpitModal } from './CockpitModal';

interface PomodoroDockProps {
  activeTaskTitle?: string;
  activeProjectCode?: string;
  onCompleteActiveSession?: () => void;
}

export const PomodoroDock: React.FC<PomodoroDockProps> = ({
  activeTaskTitle = "Session de Travail & Focus WBS",
  activeProjectCode = "SAAS",
  onCompleteActiveSession
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCockpit, setShowCockpit] = useState(false);

  // Settings State
  const [focusTime, setFocusTime] = useState<number>(() => {
    const saved = localStorage.getItem('pomo_focus');
    return saved ? parseInt(saved) : 25;
  });
  const [breakTime, setBreakTime] = useState<number>(() => {
    const saved = localStorage.getItem('pomo_break');
    return saved ? parseInt(saved) : 5;
  });
  const [sound, setSound] = useState<string>(() => {
    return localStorage.getItem('pomo_sound') || 'none';
  });

  const [timeLeft, setTimeLeft] = useState(focusTime * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<'focus' | 'break'>('focus');

  // Update timer on settings change if not running
  useEffect(() => {
    if (!isRunning) {
      setTimeLeft(mode === 'focus' ? focusTime * 60 : breakTime * 60);
    }
  }, [focusTime, breakTime, mode]);

  useEffect(() => {
    let timer: any = null;
    if (isRunning && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isRunning) {
      setIsRunning(false);
      if (mode === 'focus') {
        setMode('break');
        setTimeLeft(breakTime * 60);
      } else {
        setMode('focus');
        setTimeLeft(focusTime * 60);
      }
    }
    return () => clearInterval(timer);
  }, [isRunning, timeLeft, mode, focusTime, breakTime]);

  const toggleTimer = () => setIsRunning(!isRunning);
  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(mode === 'focus' ? focusTime * 60 : breakTime * 60);
  };

  const handleSaveSettings = (newFocus: number, newBreak: number, newSound: string) => {
    setFocusTime(newFocus);
    setBreakTime(newBreak);
    setSound(newSound);
    localStorage.setItem('pomo_focus', newFocus.toString());
    localStorage.setItem('pomo_break', newBreak.toString());
    localStorage.setItem('pomo_sound', newSound);
    setShowSettings(false);
    setIsRunning(false);
    setTimeLeft(newFocus * 60);
  };

  const minutes = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const seconds = String(timeLeft % 60).padStart(2, '0');
  const formattedTime = `${minutes}:${seconds}`;

  return (
    <>
      <div
        className={`fixed right-0 bottom-24 md:bottom-8 z-30 flex items-center transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Handle Tab on edge of screen */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="absolute left-0 -translate-x-full text-white py-3 px-2.5 rounded-l-2xl shadow-2xl flex flex-col items-center gap-1 cursor-pointer"
          style={{ background: 'linear-gradient(180deg, var(--terra), var(--terra-d))', border: '1px solid rgba(255,255,255,.15)', borderRight: 'none' }}
        >
          <span className="text-base">🍅</span>
          <span className="font-mono text-[10px] font-black leading-none">{formattedTime}</span>
          <span className="text-[10px] font-black">{isOpen ? '▶' : '◀'}</span>
        </button>

        {/* Main Dock Body */}
        <div className="card p-4 flex flex-col gap-3 w-72 md:w-80" style={{ borderRadius: '22px 0 0 22px', borderRight: 'none' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🍅</span>
              <div>
                <span className="font-mono font-black text-xl leading-none" style={{ color: 'var(--terra)' }}>{formattedTime}</span>
                <span className="text-[10px] uppercase font-black tracking-wider ml-2" style={{ color: 'var(--muted)' }}>
                  {mode === 'focus' ? 'Focus' : 'Pause'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowCockpit(true)}
                className="p-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-700 transition-colors flex items-center gap-1 text-[10px] font-black"
                title="Mode Cockpit Plein Écran"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Cockpit</span>
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="p-1.5 rounded-lg hover:bg-teal-50 text-gray-500 hover:text-teal-700 transition-colors"
                title="Réglages Pomodoro"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-500 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                toggleTimer();
                if (!isRunning) setShowCockpit(true);
              }}
              className="flex-grow py-2 rounded-xl text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #FF6B35, #FF3D00)' }}
            >
              {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isRunning ? 'Pause' : 'Démarrer'}
            </button>
            <button
              onClick={resetTimer}
              className="p-2 rounded-xl card flex items-center justify-center hover:scale-105 cursor-pointer"
              title="Réinitialiser"
            >
              <RotateCcw className="w-3.5 h-3.5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Mode Cockpit Immersif */}
      <CockpitModal
        isOpen={showCockpit}
        onClose={() => setShowCockpit(false)}
        formattedTime={formattedTime}
        isRunning={isRunning}
        onToggleTimer={toggleTimer}
        activeTaskTitle={activeTaskTitle}
        activeProjectCode={activeProjectCode}
        sound={sound}
        onSoundChange={setSound}
        onCompleteSession={() => {
          if (onCompleteActiveSession) onCompleteActiveSession();
        }}
      />

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="card p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border)' }}>
              <h3 className="font-black text-lg flex items-center gap-2" style={{ color: 'var(--text)' }}>
                <Settings className="w-5 h-5 text-teal-700" />
                Réglages Pomodoro
              </h3>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-black block mb-1" style={{ color: 'var(--muted)' }}>Durée de Focus (min)</label>
                <div className="grid grid-cols-4 gap-2">
                  {[15, 25, 30, 45].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setFocusTime(m)}
                      className={`py-1.5 rounded-xl text-xs font-bold ${
                        focusTime === m ? 'btn-main' : 'btn-ghost'
                      }`}
                    >
                      {m} min
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-black block mb-1" style={{ color: 'var(--muted)' }}>Durée de Pause (min)</label>
                <div className="grid grid-cols-4 gap-2">
                  {[3, 5, 10, 15].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setBreakTime(m)}
                      className={`py-1.5 rounded-xl text-xs font-bold ${
                        breakTime === m ? 'btn-main' : 'btn-ghost'
                      }`}
                    >
                      {m} min
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-black block mb-1" style={{ color: 'var(--muted)' }}>Ambiance Sonore</label>
                <select
                  value={sound}
                  onChange={e => setSound(e.target.value)}
                  className="inp text-xs font-bold"
                >
                  <option value="none">🔇 Désactivé (Silencieux)</option>
                  <option value="rain">🌧️ Pluie Apaisante</option>
                  <option value="forest">🌲 Ambiance Forêt</option>
                  <option value="white">⚪ Bruit Blanc Focus</option>
                  <option value="lofi">🎧 Musique Lo-Fi</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="btn-ghost text-xs py-2 px-4"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => handleSaveSettings(focusTime, breakTime, sound)}
                className="btn-main text-xs py-2 px-4"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
