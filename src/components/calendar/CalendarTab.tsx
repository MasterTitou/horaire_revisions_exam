import React, { useState, useMemo } from 'react';
import { Project, ScheduleData, ExternalEvent, UserSettings } from '../../types';
import { PlanningCalendar } from '../planner/PlanningCalendar';
import { CalendarIntegrationModal } from '../planner/CalendarIntegrationModal';
import { Calendar as CalendarIcon, Settings, Plus, RefreshCw, ShieldAlert, CheckCircle2, Globe, FileText } from 'lucide-react';

interface CalendarTabProps {
  projects: Project[];
  scheduleData: ScheduleData;
  externalEvents: ExternalEvent[];
  userSettings: UserSettings;
  currentWeekStart: Date;
  onChangeWeek: (offset: number) => void;
  onRegenerate: () => void;
  onToggleSession: (dateStr: string, idx: number) => void;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
  onAddExternalEvent: (event: ExternalEvent) => void;
  onSetExternalEvents: (events: ExternalEvent[]) => void;
}

export const CalendarTab: React.FC<CalendarTabProps> = ({
  projects,
  scheduleData,
  externalEvents,
  userSettings,
  currentWeekStart,
  onChangeWeek,
  onRegenerate,
  onToggleSession,
  onUpdateSettings,
  onAddExternalEvent,
  onSetExternalEvents
}) => {
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  // Compter uniquement les événements de cette semaine
  const weekEventsCount = useMemo(() => {
    const weekStart = currentWeekStart.getTime();
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndMs = weekEnd.getTime();
    return externalEvents.filter(ev => {
      const evStart = new Date(ev.startTime).getTime();
      const evEnd = new Date(ev.endTime).getTime();
      return evStart < weekEndMs && evEnd > weekStart;
    }).length;
  }, [externalEvents, currentWeekStart]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="card p-6 flex flex-col md:flex-row items-center justify-between gap-4" style={{ borderLeft: '6px solid var(--terra)' }}>
        <div>
          <h2 className="text-2xl font-black flex items-center gap-2.5" style={{ color: 'var(--text)' }}>
            <CalendarIcon className="w-6.5 h-6.5 text-teal-700" />
            Agenda &amp; Intégrations Calendrier
          </h2>
          <p className="text-xs font-bold mt-1" style={{ color: 'var(--muted)' }}>
            Gestion de vos agendas externes (Google / iCal), masques de temps de tampon ({userSettings.bufferMinutesBefore} min) et découpage {String(userSettings.dayStartHour).padStart(2, '0')}h00–{String(userSettings.dayEndHour).padStart(2, '0')}h00.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsConfigModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-xs font-extrabold flex items-center gap-2 shadow-lg transition-transform hover:scale-105"
          >
            <Settings className="w-4 h-4" />
            <span>Gérer mes Calendriers ({externalEvents.length})</span>
          </button>
        </div>
      </div>

      {/* Quick Status Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0 font-bold">
            🔒
          </div>
          <div>
            <span className="text-[11px] font-black uppercase text-muted block">Cette semaine</span>
            <span className="text-lg font-black text-teal-700">{weekEventsCount} événements bloquants</span>
            <span className="text-[10px] text-muted block">{externalEvents.length} au total (tous agendas)</span>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center shrink-0 font-bold">
            ⏳
          </div>
          <div>
            <span className="text-[11px] font-black uppercase text-muted block">Temps de Tampon</span>
            <span className="text-lg font-black text-teal-700">{userSettings.bufferMinutesBefore} min (Avant &amp; Après)</span>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 font-bold">
            ☀️
          </div>
          <div>
            <span className="text-[11px] font-black uppercase text-muted block">Plage Quotidienne</span>
            <span className="text-lg font-black text-teal-700">{String(userSettings.dayStartHour).padStart(2, '0')}h00 – {String(userSettings.dayEndHour).padStart(2, '0')}h00</span>
          </div>
        </div>
      </div>

      {/* Embedded Full Interactive Planning Calendar View */}
      <PlanningCalendar
        projects={projects}
        scheduleData={scheduleData}
        externalEvents={externalEvents}
        userSettings={userSettings}
        currentWeekStart={currentWeekStart}
        onChangeWeek={onChangeWeek}
        onRegenerate={onRegenerate}
        onToggleSession={onToggleSession}
        onUpdateSettings={onUpdateSettings}
        onAddExternalEvent={onAddExternalEvent}
        onSetExternalEvents={onSetExternalEvents}
      />

      {/* Integration Modal */}
      <CalendarIntegrationModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        userSettings={userSettings}
        externalEvents={externalEvents}
        onUpdateSettings={onUpdateSettings}
        onAddExternalEvent={onAddExternalEvent}
        onSetExternalEvents={onSetExternalEvents}
      />
    </div>
  );
};
