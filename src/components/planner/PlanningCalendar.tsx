import React, { useState } from 'react';
import { Project, ScheduleData, ExternalEvent, UserSettings } from '../../types';
import { getLocalDateString } from '../../engine/scheduler';
import { ChevronLeft, ChevronRight, RotateCw, Check, Calendar as CalendarIcon, ShieldAlert } from 'lucide-react';
import { CalendarIntegrationModal } from './CalendarIntegrationModal';

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const MONTHS = ["Janv.", "Févr.", "Mars", "Avril", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];

interface PlanningCalendarProps {
  projects: Project[];
  scheduleData: ScheduleData;
  externalEvents?: ExternalEvent[];
  userSettings?: UserSettings;
  currentWeekStart: Date;
  onChangeWeek: (offset: number) => void;
  onRegenerate: () => void;
  onToggleSession: (dateStr: string, idx: number) => void;
  onUpdateSettings?: (newSettings: Partial<UserSettings>) => void;
  onAddExternalEvent?: (event: ExternalEvent) => void;
  onSetExternalEvents?: (events: ExternalEvent[]) => void;
}

export const PlanningCalendar: React.FC<PlanningCalendarProps> = ({
  projects,
  scheduleData,
  externalEvents = [],
  userSettings = { timezone: 'Europe/Paris', bufferMinutesBefore: 15, bufferMinutesAfter: 15, dayStartHour: 8, dayEndHour: 23, slotDurationMinutes: 60 },
  currentWeekStart,
  onChangeWeek,
  onRegenerate,
  onToggleSession,
  onUpdateSettings,
  onAddExternalEvent,
  onSetExternalEvents
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const endOfWeek = new Date(currentWeekStart);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  const weekLabel = `${currentWeekStart.getDate()} ${MONTHS[currentWeekStart.getMonth()]} – ${endOfWeek.getDate()} ${MONTHS[endOfWeek.getMonth()]}`;
  const todayStr = getLocalDateString(new Date());

  return (
    <div className="space-y-5">
      {/* Ton Planning Card Header */}
      <div className="card p-5 space-y-3" style={{ borderLeft: '5px solid var(--terra)' }}>
        <div>
          <h2 className="text-2xl font-black" style={{ color: 'var(--text)' }}>Ton Planning</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>Optimisé automatiquement avec tampons et intégration bidirectionnelle d'agendas.</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-1.5 p-1.5 rounded-2xl card" style={{ borderRadius: '18px' }}>
            <button onClick={() => onChangeWeek(-1)} className="btn-ghost border-0 px-3 py-1.5 text-xs font-black">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 text-xs font-black min-w-[130px] text-center">{weekLabel}</span>
            <button onClick={() => onChangeWeek(1)} className="btn-ghost border-0 px-3 py-1.5 text-xs font-black">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-3 py-2 rounded-xl card flex items-center gap-2 text-xs font-bold hover:scale-105 transition-transform"
              style={{ border: '1px solid var(--terra)', color: 'var(--terra)' }}
              title="Configurer l'intégration Google / iCal"
            >
              <CalendarIcon className="w-4 h-4" />
              <span>Intégration Calendrier ({externalEvents.length})</span>
            </button>

            <button
              onClick={onRegenerate}
              className="w-10 h-10 rounded-2xl card flex items-center justify-center text-lg hover:scale-105 transition-transform"
              title="Régénérer le planning"
            >
              <RotateCw className="w-4 h-4 text-teal-700" />
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Days Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {projects.length === 0 ? (
          <div className="col-span-full py-14 text-center rounded-3xl border-2 border-dashed" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
            <div className="text-5xl mb-3">📅</div>
            <p className="font-bold">Ajoute un projet et des jalons pour générer ton planning sous contraintes</p>
          </div>
        ) : (
          [0, 1, 2, 3, 4, 5, 6].map(i => {
            const d = new Date(currentWeekStart);
            d.setDate(d.getDate() + i);
            const dateStr = getLocalDateString(d);
            const isToday = dateStr === todayStr;
            const sessions = scheduleData[dateStr] || [];

            // Filtrer les événements externes du jour
            const dayEvents = externalEvents.filter(ev => {
              const evDateStr = getLocalDateString(new Date(ev.startTime));
              return evDateStr === dateStr;
            });

            const completedCount = sessions.filter(s => s.isCompleted).length;
            const isDoneAll = sessions.length > 0 && completedCount === sessions.length;

            return (
              <div
                key={dateStr}
                className={`day-card card p-4 ${isToday ? 'today' : ''}`}
              >
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <h3 className="font-black text-sm" style={{ color: isToday ? 'var(--terra)' : 'inherit' }}>{DAYS[i]}</h3>
                    <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>{d.getDate()} {MONTHS[d.getMonth()]}</span>
                  </div>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full font-black" style={{ background: isDoneAll ? 'var(--sage-l)' : 'var(--bg)', color: isDoneAll ? 'var(--sage)' : 'var(--muted)', border: '1px solid var(--border)' }}>
                    {completedCount}/{sessions.length}
                  </span>
                </div>

                <div className="space-y-2 min-h-[30px]">
                  {/* Blocs Indisponibles Externes (RDV / Personnels) */}
                  {dayEvents.map(ev => {
                    const startH = new Date(ev.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const endH = new Date(ev.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    return (
                      <div
                        key={ev.id}
                        className="p-2 rounded-xl border border-rose-900/40 bg-rose-950/20 text-rose-300 text-xs flex items-center gap-2"
                        title={`Événement externe bloqué + ${userSettings.bufferMinutesBefore}m tampon`}
                      >
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <div className="truncate flex-grow">
                          <span className="font-bold block truncate">{ev.title}</span>
                          <span className="text-[10px] text-rose-400 opacity-80">{startH} – {endH} (Occupé)</span>
                        </div>
                      </div>
                    );
                  })}

                  {sessions.length === 0 && dayEvents.length === 0 ? (
                    <p className="text-[10px] italic py-2 text-center" style={{ color: 'var(--muted)' }}>Repos / Pas de créneau</p>
                  ) : (
                    sessions.map((session, si) => {
                      const proj = projects.find(p => p.id === session.projectId || p.id === session.subjectId) || { color: '#0E8478' };
                      const checked = session.isCompleted;

                      return (
                        <div
                          key={session.id || si}
                          onClick={() => onToggleSession(dateStr, si)}
                          className={`sess flex items-center p-2.5 cursor-pointer group ${checked ? 'done' : ''}`}
                        >
                          <div className="w-1.5 h-8 rounded-full mr-2.5 shrink-0" style={{ background: proj.color }}></div>
                          <div className="flex-grow min-w-0">
                            <span className={`block text-xs md:text-sm font-bold truncate ${checked ? 'line-through opacity-60' : ''}`}>
                              {session.note}
                            </span>
                          </div>
                          <div className={`check-dot shrink-0 ml-2 ${checked ? 'on' : ''}`}>
                            {checked && <Check className="w-3 h-3 text-white stroke-[3]" />}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal d'intégration */}
      <CalendarIntegrationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        userSettings={userSettings}
        externalEvents={externalEvents}
        onUpdateSettings={onUpdateSettings || (() => {})}
        onAddExternalEvent={onAddExternalEvent || (() => {})}
        onSetExternalEvents={onSetExternalEvents || (() => {})}
      />
    </div>
  );
};

