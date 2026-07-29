import React from 'react';
import { Gamification } from '../../types';
import { Trophy, Award, Target, Zap } from 'lucide-react';

interface ProfileTabProps {
  gamification: Gamification;
}

const BADGES_CONFIG = [
  { id: 'first_step', name: 'Premier Pas', icon: '👣', desc: 'Compléter 1 session' },
  { id: 'marathon', name: 'Marathonien', icon: '🏃', desc: 'Compléter 10 sessions' },
  { id: 'centurion', name: 'Centurion', icon: '💯', desc: 'Compléter 100 sessions' },
  { id: 'campfire', name: 'Feu de Camp', icon: '🏕️', desc: 'Série de 3 jours' },
  { id: 'inferno', name: 'Inferno', icon: '🌋', desc: 'Série de 7 jours' },
  { id: 'pomo_master', name: 'Pomo Master', icon: '🍅', desc: '10 Pomodoros' }
];

export const ProfileTab: React.FC<ProfileTabProps> = ({ gamification }) => {
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Level Card */}
      <div className="card p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-3xl flex items-center justify-center text-3xl font-black text-white shadow-lg" style={{ background: 'linear-gradient(135deg, #0E8478, #2E7D32)' }}>
            {gamification.level}
          </div>
          <div>
            <h2 className="font-extrabold text-xl" style={{ color: 'var(--text)' }}>Productivité SaaS &amp; Récompenses</h2>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>XP Total accumulé : <strong className="text-teal-700">{gamification.xp} XP</strong></p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="flex items-center gap-1 text-teal-700 font-black text-xl justify-center">
              <Zap className="w-5 h-5" />
              <span>{gamification.sessionsCompleted}</span>
            </div>
            <span className="text-[10px] font-bold uppercase text-muted">Sessions</span>
          </div>
          <div className="text-center">
            <div className="flex items-center gap-1 text-teal-700 font-black text-xl justify-center">
              <Trophy className="w-5 h-5" />
              <span>{gamification.bestStreak}j</span>
            </div>
            <span className="text-[10px] font-bold uppercase text-muted">Meilleure Série</span>
          </div>
        </div>
      </div>

      {/* Badges Grid */}
      <div className="card p-6">
        <h3 className="font-extrabold text-base mb-4 flex items-center gap-2" style={{ color: 'var(--text)' }}>
          <Award className="w-5 h-5 text-teal-700" />
          Badges &amp; Jalons Débloqués
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {BADGES_CONFIG.map(b => {
            const isUnlocked = gamification.sessionsCompleted >= (b.id === 'marathon' ? 10 : 1);
            return (
              <div
                key={b.id}
                className={`p-3.5 rounded-2xl flex items-center gap-3 transition-all ${
                  isUnlocked ? 'card' : 'opacity-40 grayscale'
                }`}
                style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
              >
                <span className="text-2xl">{b.icon}</span>
                <div className="min-w-0">
                  <span className="block font-extrabold text-xs truncate" style={{ color: 'var(--text)' }}>{b.name}</span>
                  <span className="block text-[10px] truncate" style={{ color: 'var(--muted)' }}>{b.desc}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
