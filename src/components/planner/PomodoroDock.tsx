import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, X, Volume2, VolumeX } from 'lucide-react';

export const PomodoroDock: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<'focus' | 'break'>('focus');

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
        setTimeLeft(5 * 60);
      } else {
        setMode('focus');
        setTimeLeft(25 * 60);
      }
    }
    return () => clearInterval(timer);
  }, [isRunning, timeLeft, mode]);

  const toggleTimer = () => setIsRunning(!isRunning);
  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(mode === 'focus' ? 25 * 60 : 5 * 60);
  };

  const minutes = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const seconds = String(timeLeft % 60).padStart(2, '0');
  const formattedTime = `${minutes}:${seconds}`;

  return (
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
          <button onClick={() => setIsOpen(false)} className="text-xs hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleTimer}
            className="flex-grow py-2 rounded-xl text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm"
            style={{ background: 'linear-gradient(135deg, #FF6B35, #FF3D00)' }}
          >
            {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isRunning ? 'Pause' : 'Démarrer'}
          </button>
          <button
            onClick={resetTimer}
            className="p-2 rounded-xl card flex items-center justify-center hover:scale-105"
            title="Réinitialiser"
          >
            <RotateCcw className="w-3.5 h-3.5 text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  );
};
