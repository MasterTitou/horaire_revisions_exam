import React, { useState, useEffect } from 'react';
import { ExternalEvent, UserSettings } from '../../types';
import { CheckCircle2, ShieldCheck, Trash2, RefreshCw, Calendar as CalendarIcon, Plus } from 'lucide-react';

interface ICalFeed {
  id: string;
  name: string;
  url: string;
  eventCount: number;
  addedAt: string;
}

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
  const [icalName, setIcalName] = useState('');
  const [icalUrl, setIcalUrl] = useState('');
  const [isLoadingICal, setIsLoadingICal] = useState(false);

  // Agendas iCal Importés conservés en mémoire et synchronisés dans le Cloud
  const [importedFeeds, setImportedFeeds] = useState<ICalFeed[]>(() => {
    if (userSettings?.icalFeeds && userSettings.icalFeeds.length > 0) {
      return userSettings.icalFeeds;
    }
    const saved = localStorage.getItem('imported_ical_feeds');
    return saved ? JSON.parse(saved) : [];
  });

  const [isGoogleConnected, setIsGoogleConnected] = useState<boolean>(() => {
    return !!(userSettings?.googleAccessToken || localStorage.getItem('google_access_token'));
  });

  // Formulaire d'événement manuel
  const [manualTitle, setManualTitle] = useState('');
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualStartTime, setManualStartTime] = useState('14:00');
  const [manualEndTime, setManualEndTime] = useState('15:00');

  // Conserver le state local en synchro avec userSettings.icalFeeds lors de chargements distants

  // Sync local state when userSettings.icalFeeds changes from external sources
  useEffect(() => {
    if (userSettings?.icalFeeds && JSON.stringify(userSettings.icalFeeds) !== JSON.stringify(importedFeeds)) {
      setImportedFeeds(userSettings.icalFeeds);
    }
  }, [userSettings?.icalFeeds]);

  // Save imported feeds to localStorage only (Cloud sync handled during add/delete)
  useEffect(() => {
    localStorage.setItem('imported_ical_feeds', JSON.stringify(importedFeeds));
  }, [importedFeeds]);

  // Écoute de l'événement OAuth Google Success envoyé par la fenêtre popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'GOOGLE_AUTH_SUCCESS' && event.data.token) {
        const token = event.data.token;
        localStorage.setItem('google_access_token', token);
        setIsGoogleConnected(true);
        onUpdateSettings({ googleConnected: true, googleAccessToken: token });

        // Récupérer automatiquement les événements Google Calendar et souscrire au webhook
        fetch('/api/calendar/google?action=fetch_events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken: token })
        })
          .then(res => res.json())
          .then(data => {
            if (data.success && data.events) {
              // I1: Dédupliquer en conservant les événements non-Google et ajoutant les événements Google frais
              const nonGoogleEvents = externalEvents.filter(ev => !ev.id?.startsWith('gcal_') && ev.source !== 'google');
              onSetExternalEvents([...nonGoogleEvents, ...data.events]);
            }
          })
          .catch(err => console.error('Erreur GCal fetch:', err));

        // Activer la souscription push webhook
        fetch('/api/calendar/google?action=subscribe_webhook', { method: 'POST' }).catch(() => {});
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [externalEvents, onSetExternalEvents, onUpdateSettings]);

  if (!isOpen) return null;

  const handleFetchICal = async () => {
    if (!icalUrl.trim()) return;
    const feedName = icalName.trim() || '🏫 Agenda iCal';
    setIsLoadingICal(true);

    try {
      const res = await fetch('/api/calendar/ical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ icalUrl })
      });
      const data = await res.json();
      if (data.success && data.events) {
        const feedId = 'feed_' + Date.now();
        const taggedEvents: ExternalEvent[] = data.events.map((ev: any) => ({
          ...ev,
          integrationId: feedId,
          title: `[${feedName}] ${ev.title}`
        }));

        const newFeed: ICalFeed = {
          id: feedId,
          name: feedName,
          url: icalUrl.trim(),
          eventCount: taggedEvents.length,
          addedAt: new Date().toLocaleDateString()
        };

        const updatedFeeds = [...importedFeeds.filter(f => f.url !== icalUrl.trim()), newFeed];
        setImportedFeeds(updatedFeeds);
        onUpdateSettings({ icalFeeds: updatedFeeds });
        onSetExternalEvents([...externalEvents, ...taggedEvents]);

        alert(`Succès : Agenda "${feedName}" importé avec ${taggedEvents.length} événements !`);
        setIcalUrl('');
        setIcalName('');
      } else {
        alert(data.error || 'Erreur lors de l\'import iCal');
      }
    } catch (e) {
      alert('Impossible d\'accéder au flux iCal.');
    } finally {
      setIsLoadingICal(false);
    }
  };

  const handleDeleteFeed = (feedId: string) => {
    const updatedFeeds = importedFeeds.filter(f => f.id !== feedId);
    setImportedFeeds(updatedFeeds);
    onUpdateSettings({ icalFeeds: updatedFeeds });
    onSetExternalEvents(externalEvents.filter(ev => ev.integrationId !== feedId));
  };

  const handleConnectGoogle = async () => {
    try {
      const res = await fetch('/api/calendar/google?action=auth_url');
      const data = await res.json();
      if (res.ok && data.url) {
        window.open(data.url, '_blank', 'width=500,height=600');
      } else {
        alert(data.message || '⚠️ Identifiant Google OAuth non configuré (GOOGLE_CLIENT_ID absent de Vercel).\n\nVeuillez ajouter GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET dans les variables d\'environnement Vercel.');
      }
    } catch (e) {
      alert('⚠️ Erreur de communication avec l\'API Google OAuth. Vérifiez votre connexion et les variables d\'environnement Vercel.');
    }
  };

  const handleDisconnectGoogle = () => {
    localStorage.removeItem('google_access_token');
    setIsGoogleConnected(false);
    onUpdateSettings({ googleConnected: false, googleAccessToken: undefined });
    // I4: Purger les événements Google de la liste d'événements externes
    const nonGoogleEvents = externalEvents.filter(ev => !ev.id?.startsWith('gcal_') && ev.source !== 'google');
    onSetExternalEvents(nonGoogleEvents);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 text-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl my-auto animate-fade-in">
        
        {/* Header (Sticky / Fixed) */}
        <div className="p-5 sm:p-6 border-b border-slate-800 shrink-0 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">📅</span>
            <div>
              <h2 className="text-lg sm:text-xl font-bold">Intégration Calendrier &amp; Heures Creuses</h2>
              <p className="text-xs text-slate-400">Synchronisation bidirectionnelle, tampons et replanification auto</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Fermer"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Modal Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-grow">
          
          {/* Section 1: Connection APIs */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-teal-400 uppercase tracking-wider">1. Agendas Externes Connectés</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Google OAuth */}
              <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/60 flex flex-col justify-between">
                <div>
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <span>🔴</span> Google Calendar API
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">Sync bidirectionnelle réactive pour vos créneaux persos</p>
                </div>

                {isGoogleConnected ? (
                  <div className="mt-4 space-y-2">
                    <div className="px-3 py-2 bg-emerald-500/20 border border-emerald-500/40 rounded-lg text-emerald-300 text-xs font-bold flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>✅ Google Calendar Connecté &amp; Synchro</span>
                    </div>
                    <button
                      onClick={handleDisconnectGoogle}
                      className="w-full py-1 text-[11px] text-slate-400 hover:text-red-400 transition"
                    >
                      Déconnecter
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleConnectGoogle}
                    className="mt-4 w-full py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg transition"
                  >
                    Connecter Google Calendar
                  </button>
                )}
              </div>

              {/* iCal Feed Form */}
              <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/60 flex flex-col justify-between">
                <div>
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <span>📅</span> Flux iCal / École / Apple / Outlook
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">Importez l'agenda de votre école ou emploi du temps (`.ics`)</p>
                </div>
                <div className="mt-3 space-y-2">
                  <input
                    type="text"
                    placeholder="Nom (Ex: 🏫 Agenda École, 💼 Travail)"
                    value={icalName}
                    onChange={e => setIcalName(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-md text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  />
                  <input
                    type="text"
                    placeholder="URL du flux (https://.../calendar.ics)"
                    value={icalUrl}
                    onChange={e => setIcalUrl(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-md text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  />
                  <button
                    onClick={handleFetchICal}
                    disabled={isLoadingICal}
                    className="w-full py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isLoadingICal ? 'Importation...' : 'Ajouter cet Agenda iCal'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Liste des Agendas iCal Importés */}
            {importedFeeds.length > 0 && (
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <CalendarIcon className="w-3.5 h-3.5 text-teal-400" />
                  <span>Agendas iCal Importés ({importedFeeds.length}) :</span>
                </h4>
                <div className="space-y-2">
                  {importedFeeds.map(feed => (
                    <div
                      key={feed.id}
                      className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-grow">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-teal-300 truncate">{feed.name}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-500/20 text-teal-300 border border-teal-500/30 shrink-0">
                            {feed.eventCount} événements
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 block truncate mt-0.5">Ajouté le {feed.addedAt} • {feed.url}</span>
                      </div>

                      <button
                        onClick={() => handleDeleteFeed(feed.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition shrink-0"
                        title="Supprimer cet agenda iCal"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Réglages des Tampons & Plages d'Heures Creuses */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <h3 className="text-xs font-black text-teal-400 uppercase tracking-wider">2. Temps de Tampon &amp; Plage Quotidienne</h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Tampon Avant/Après */}
              <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-800">
                <label className="text-xs text-slate-300 block mb-1 font-semibold">Tampon Avant / Après</label>
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
                <label className="text-xs text-slate-300 block mb-1 font-semibold">Début Plage Travail</label>
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
                <label className="text-xs text-slate-300 block mb-1 font-semibold">Fin Plage Travail</label>
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
          <div className="space-y-3 pt-4 border-t border-slate-800">
            <h3 className="text-xs font-black text-teal-400 uppercase tracking-wider">3. Bloquer Manuellement un Créneau Personnel</h3>
            <form onSubmit={handleAddManualEvent} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <input
                type="text"
                placeholder="Ex: RDV Médical, Sport..."
                value={manualTitle}
                onChange={e => setManualTitle(e.target.value)}
                className="sm:col-span-2 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500"
                required
              />
              <input
                type="date"
                value={manualDate}
                onChange={e => setManualDate(e.target.value)}
                className="px-2 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
              />
              <div className="flex gap-1">
                <input
                  type="time"
                  value={manualStartTime}
                  onChange={e => setManualStartTime(e.target.value)}
                  className="w-1/2 px-1 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                />
                <input
                  type="time"
                  value={manualEndTime}
                  onChange={e => setManualEndTime(e.target.value)}
                  className="w-1/2 px-1 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                />
              </div>
              <button
                type="submit"
                className="sm:col-span-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs rounded-lg transition shadow-md"
              >
                + Ajouter le créneau indisponible indiscutable
              </button>
            </form>
          </div>

        </div>

        {/* Footer (Sticky / Fixed) */}
        <div className="p-4 sm:p-5 border-t border-slate-800 shrink-0 flex justify-end bg-slate-900/90 rounded-b-2xl">
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
