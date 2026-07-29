import React from 'react';
import { Project, ScheduleData } from '../../types';
import { Clock, BarChart3, Calendar } from 'lucide-react';
import { getLocalDateString } from '../../engine/scheduler';

interface StatWidgetsProps {
  projects: Project[];
  scheduleData: ScheduleData;
  currentWeekStart: Date;
}

const MONTHS_SHORT = ["Janv.", "Févr.", "Mars", "Avril", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];

export const StatWidgets: React.FC<StatWidgetsProps> = ({ projects, scheduleData, currentWeekStart }) => {
  let total = 0;
  let completed = 0;

  for (let i = 0; i < 7; i++) {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + i);
    const dateStr = getLocalDateString(d);
    const s = scheduleData[dateStr] || [];
    total += s.length;
    completed += s.filter(x => x.isCompleted).length;
  }

  const hours = Math.round(total * 10 / 3);
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  let nextDeliveryText = '--';
  if (projects.length > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let minDiff = Infinity;
    let nextDateStr = '';

    projects.forEach(p => {
      if (p.deadline) {
        const parts = p.deadline.split('-');
        if (parts.length === 3) {
          const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          d.setHours(0, 0, 0, 0);
          const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000);
          if (diff >= 0 && diff < minDiff) {
            minDiff = diff;
            nextDateStr = `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
          }
        }
      }
    });

    nextDeliveryText = minDiff === Infinity ? 'Livré' : (nextDateStr || (minDiff === 0 ? 'Auj.' : `${minDiff} j`));
  }

  return (
    <div className="grid grid-cols-3 gap-3 md:gap-4">
      {/* Hours Card */}
      <div className="card p-4 text-center flex flex-col items-center justify-center">
        <div className="w-10 h-10 rounded-full flex items-center justify-center mb-1.5" style={{ background: '#DDF2ED', color: 'var(--terra)' }}>
          <Clock className="w-5 h-5" />
        </div>
        <span className="block text-2xl md:text-3xl font-black" style={{ color: 'var(--terra)' }}>{hours}h</span>
        <span className="text-[10px] md:text-xs font-extrabold tracking-wider uppercase mt-1" style={{ color: 'var(--muted)' }}>HEURES PRÉVUES</span>
      </div>

      {/* Completion % Card */}
      <div className="card p-4 text-center flex flex-col items-center justify-center relative overflow-hidden">
        <div className="w-10 h-10 rounded-full flex items-center justify-center mb-1.5" style={{ background: '#DDF2ED', color: 'var(--terra)' }}>
          <BarChart3 className="w-5 h-5" />
        </div>
        <span className="block text-2xl md:text-3xl font-black" style={{ color: 'var(--terra)' }}>{pct}%</span>
        <span className="text-[10px] md:text-xs font-extrabold tracking-wider uppercase mt-1" style={{ color: 'var(--muted)' }}>COMPLÉTÉ</span>
        <div className="w-12 h-1.5 rounded-full mt-2 overflow-hidden" style={{ background: 'var(--border)' }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: 'var(--terra)' }}></div>
        </div>
      </div>

      {/* Next Exam/Delivery Card */}
      <div className="card p-4 text-center flex flex-col items-center justify-center">
        <div className="w-10 h-10 rounded-full flex items-center justify-center mb-1.5" style={{ background: '#DDF2ED', color: 'var(--terra)' }}>
          <Calendar className="w-5 h-5" />
        </div>
        <span className="block text-xl md:text-2xl font-black truncate max-w-full px-1" style={{ color: 'var(--terra)' }}>{nextDeliveryText}</span>
        <span className="text-[10px] md:text-xs font-extrabold tracking-wider uppercase mt-1" style={{ color: 'var(--muted)' }}>PROCHAIN JALON</span>
      </div>
    </div>
  );
};
