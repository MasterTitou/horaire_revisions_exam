import React, { useState } from 'react';
import { ExternalEvent, UserSettings } from '../../types';

interface CalendarIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  userSettings: UserSettings;
  externalEvents: ExternalEvent[];
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
  onAddExternalEvent: (event: ExternalEvent) => void;
  onSetExternalEvents: (events: ExternalEvent[]) => void;
}

export const CalendarIntegrationModal: React.FC<CalendarIntegrationModalProps> = ({
  isOpen,
  onClose,
  userSettings,
  externalEvents,
  onUpdateSettings,
  onAddExternalEvent,
  onSetExternalEvents
}) => {
  const [icalUrl, setIcalUrl] = useState('');
  const [isLoadingICal, setIsLoadingICal] = useState(false);

  // Formulaire d'événement manuel indisponible
  const [manualTitle, setManualTitle] = useState('');
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualStartTime, setManualStartTime] = useState('14:00');
  const [manualEndTime, setManualEndTime] = useState('15:00');

  if (!isOpen) return null;

  const handleFetchICal = async () => {
    if (!icalUrl.trim()) return;
    setIsLoadingICal(true);

    try {
      const res = await fetch('/api/calendar/ical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ icalUrl })
      });
      const data = await res.json();
      if (data.success && data.events) {
        onSetExternalEvents([...externalEvents, ...data.events]);
        alert(`Succès : ${data.events.length} événements indisponibles importés !`);
        setIcalUrl('');
      } else {
        alert(data.error || 'Erreur lors de l\'import iCal');
      }
    } catch (e) {
      alert('Impossible d\'accéder au flux iCal.');
    } finally {
      setIsLoadingICal(false);
    }
  };

  const handleConnectGoogle = async () => {
    try {
      const res = await fetch('/api/calendar/google?action=auth_url');
      const data = await res.json();
      if (data.url) {
        window.open(data.url, '_blank', 'width=500,height=600');
      }
    } catch (e) {
      alert('Erreur de connexion avec l\'API Google Calendar.');
    }
  };

  const handleAddManualEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim()) return;

    const startISO = new Date(`${manualDate}T${manualStartTime}:00`).toISOString();
    const endISO = new Date(`${manualDate}T${manualEndTime}:00`).toISOString();

    const newEv: ExternalEvent = {
      id: 'man_' + Date.now(),
      title: manualTitle.trim(),
      startTime: startISO,
      endTime: endISO,
      source: 'manual'
    };

    onAddExternalEvent(newEv);
    setManualTitle('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">📅</span>
            <div>
              <h2 className="text-xl font-bold">Intégration Calendrier & Heures Creuses</h2>
              <p className="text-xs text-slate-400">Synchronisation bidirectionnelle, tampons et replanification auto</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">✕</button>
        </div>

        {/* Section 1: Connection APIs */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-teal-400 uppercase tracking-wider">1. Agendas Externes Connectés</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Google OAuth */}
            <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/60 flex flex-col justify-between">
              <div>
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <span>🔴</span> Google Calendar API
                </h4>
                <p className="text-xs text-slate-400 mt-1">Sync bidirectionnelle réactive par Webhooks Push</p>
              </div>
              <button
                onClick={handleConnectGoogle}
                className="mt-4 w-full py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg transition"
              >
                Connecter Google Calendar
              </button>
            </div>

            {/* iCal Feed */}
            <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/60 flex flex-col justify-between">
              <div>
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <span>📅</span> Flux iCal / Apple / Outlook
                </h4>
                <p className="text-xs text-slate-400 mt-1">Importez vos événements via lien d'agenda `.ics`</p>
              </div>
              <div className="mt-3 space-y-2">
                <input
                  type="text"
                  placeholder="https://.../calendar.ics"
                  value={icalUrl}
                  onChange={e => setIcalUrl(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-md text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
                <button
                  onClick={handleFetchICal}
                  disabled={isLoadingICal}
                  className="w-full py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50"
                >
                  {isLoadingICal ? 'Importation...' : 'Importer Flux iCal'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Réglages des Tampons & Plages d'Heures Creuses */}
        <div className="space-y-4 pt-2 border-t border-slate-800">
          <h3 className="text-sm font-semibold text-teal-400 uppercase tracking-wider">2. Temps de Tampon & Plage Quotidienne</h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Tampon Avant/Après */}
            <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-800">
              <label className="text-xs text-slate-300 block mb-1">Tampon Avant / Après</label>
              <select
                value={userSettings.bufferMinutesBefore}
                onChange={e => {
                  const val = parseInt(e.target.value);
                  onUpdateSettings({ bufferMinutesBefore: val, bufferMinutesAfter: val });
                }}
                className="w-full bg-slate-950 border border-slate-700 text-xs text-white rounded-lg p-2 focus:border-teal-500"
              >
                <option value={0}>Aucun tampon (0 min)</option>
                <option value={15}>15 minutes (Recommandé)</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
              </select>
            </div>

            {/* Début de Journée */}
            <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-800">
              <label className="text-xs text-slate-300 block mb-1">Début Plage Travail</label>
              <select
                value={userSettings.dayStartHour}
                onChange={e => onUpdateSettings({ dayStartHour: parseInt(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-700 text-xs text-white rounded-lg p-2 focus:border-teal-500"
              >
                {[6, 7, 8, 9, 10].map(h => (
                  <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                ))}
              </select>
            </div>

            {/* Fin de Journée */}
            <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-800">
              <label className="text-xs text-slate-300 block mb-1">Fin Plage Travail</label>
              <select
                value={userSettings.dayEndHour}
                onChange={e => onUpdateSettings({ dayEndHour: parseInt(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-700 text-xs text-white rounded-lg p-2 focus:border-teal-500"
              >
                {[20, 21, 22, 23, 24].map(h => (
                  <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Ajout Rapide d'un Bloc Personnel Indisponible */}
        <div className="space-y-3 pt-2 border-t border-slate-800">
          <h3 className="text-sm font-semibold text-teal-400 uppercase tracking-wider">3. Bloquer Manuellement un Créneau Personnel</h3>
          <form onSubmit={handleAddManualEvent} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <input
              type="text"
              placeholder="Ex: RDV Médical, Sport..."
              value={manualTitle}
              onChange={e => setManualTitle(e.target.value)}
              className="sm:col-span-2 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500"
              required
            />
            <input
              type="date"
              value={manualDate}
              onChange={e => setManualDate(e.target.value)}
              className="px-2 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
            />
            <div className="flex gap-1">
              <input
                type="time"
                value={manualStartTime}
                onChange={e => setManualStartTime(e.target.value)}
                className="w-1/2 px-1 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
              />
              <input
                type="time"
                value={manualEndTime}
                onChange={e => setManualEndTime(e.target.value)}
                className="w-1/2 px-1 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
              />
            </div>
            <button
              type="submit"
              className="sm:col-span-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs rounded-lg transition"
            >
              + Ajouter le créneau indisponible indiscutable
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg transition"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
};
