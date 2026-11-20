import { useState, useEffect, useCallback, useRef } from 'react';
import { Project, Milestone, ScheduleData, Streak, Gamification, ChatMessage, DomainSkill, StudyDomain, DomainCategory, DynamicQuest, ExternalEvent, UserSettings, CognitiveLoad } from '../types';


import { generateSchedule, getStartOfWeek, HPH, DEFAULT_USER_SETTINGS, replanifyOnCalendarChange, getLocalDateString, isSlotBlockedByExternalEvent, cleanEventTitle, deduplicateExternalEvents } from '../engine/scheduler';

import {
  calculateSessionXP,
  evaluateDomainMastery,
  calculateLevelAndTitle,
  extractDailyQuestsFromWBS,
  checkBadgeUnlocks,
  resolveTargetDomainKey
} from '../engine/gamificationEngine';

import { mergeDomainOntology } from '../engine/domainSeeds';

const COLORS = [
  "#0E8478", "#6B46C1", "#2E7D32", "#FF6B35", "#3B82F6", "#D946EF",
  "#059669", "#E11D48", "#F59E0B", "#8B5CF6", "#14B8A6", "#EC4899"
];

// UNIVERSAL MULTI-DOMAIN SKILLS TREE INITIALISATION (HYBRID MODEL)
const DEFAULT_SKILLS = mergeDomainOntology();


const DEFAULT_CALIBRATION = {
  highFactor: 1.25,
  mediumFactor: 1.10,
  lowFactor: 1.00,
  lastCalibrated: 'Aujourd\'hui'
};

const DEFAULT_GAMIFICATION: Gamification = {
  xp: 0,
  level: 1,
  title: '🌱 Apprenti',
  xpToNextLevel: 400,
  velocityIndex: 92,
  calibration: DEFAULT_CALIBRATION,
  skills: DEFAULT_SKILLS,
  quests: [],
  badges: [],
  unlockedBadges: [],
  aggregates: {
    weeklyHighCognitiveHours: 0,
    consecutivePunctualMilestones: 0,
    lastActiveDate: '',
    resurrectedProjectsCount: 0,
    totalActiveFocusSeconds: 0
  },
  toastQueue: [],
  pomodorosCompleted: 0,
  sessionsCompleted: 0,
  bestStreak: 0,
  pomoSettings: { focus: 25, break: 5, sound: null },
  subjectPomoStats: {}
};

export function useProjectStore() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [scheduleData, setScheduleData] = useState<ScheduleData>({});
  const [externalEvents, setExternalEventsState] = useState<ExternalEvent[]>([]);
  const [userSettings, setUserSettingsState] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [streak, setStreak] = useState<Streak>({ count: 0, lastDate: '' });
  const [gamification, setGamification] = useState<Gamification>(DEFAULT_GAMIFICATION);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getStartOfWeek(new Date()));
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const getPersistentToken = () => {
    const local = localStorage.getItem('authToken');
    if (local) return local;
    const cookieMatch = typeof document !== 'undefined' ? document.cookie.match(/authToken=([^;]+)/) : null;
    if (cookieMatch) return cookieMatch[1];
    const defaultToken = 'auth_token_active';
    try {
      localStorage.setItem('authToken', defaultToken);
      if (typeof document !== 'undefined') {
        document.cookie = `authToken=${defaultToken}; max-age=315360000; path=/; SameSite=Lax`;
      }
    } catch (e) {}
    return defaultToken;
  };

  const [authToken, setAuthToken] = useState<string>(getPersistentToken());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'saving' | 'loading' | 'error'>('synced');


  const saveTimerRef = useRef<any>(null);
  const latestPayloadRef = useRef<any>(null);
  const currentWeekStartRef = useRef<Date>(currentWeekStart);
  currentWeekStartRef.current = currentWeekStart;

  const stateRef = useRef({
    projects,
    scheduleData,
    externalEvents,
    userSettings,
    streak,
    gamification,
    chatHistory,
    isDarkMode
  });
  stateRef.current = {
    projects,
    scheduleData,
    externalEvents,
    userSettings,
    streak,
    gamification,
    chatHistory,
    isDarkMode
  };



  // Compute Velocity Index & Dynamic Quests from WBS
  const updateMetricsAndQuests = (currentSchedule: ScheduleData, currentProjects: Project[], currentGamo: Gamification): Gamification => {
    let totalPlanned = 0;
    let totalDone = 0;

    Object.values(currentSchedule).forEach(sessions => {
      totalPlanned += sessions.length;
      totalDone += sessions.filter(s => s.isCompleted).length;
    });

    const velocityIndex = totalPlanned > 0 ? Math.min(100, Math.round((totalDone / totalPlanned) * 100)) : 100;
    const quests = extractDailyQuestsFromWBS(currentProjects);

    return {
      ...currentGamo,
      velocityIndex,
      quests
    };
  };


  // Process and apply state payload
  const applyStatePayload = useCallback((d: any) => {
    if (!d) return;
    let projs: Project[] = d.projects || [];
    const subjs = d.subjects || [];

    if (projs.length === 0 && subjs.length > 0) {
      projs = subjs.map((sub: any, idx: number) => ({
        id: sub.id || `prj_${Date.now()}_${idx}`,
        name: sub.name,
        code: `PRJ-${idx + 1}`,
        color: sub.color || COLORS[idx % COLORS.length],
        isHardDeadline: true,
        deadline: sub.examDate || '',
        milestones: [
          {
            id: `ms_${sub.id || idx}`,
            title: `Jalon principal — ${sub.name}`,
            estimatedHours: (sub.difficulty || 3) * 10,
            completedHours: 0,
            dueDate: sub.examDate || '',
            cognitiveLoad: (sub.difficulty || 3) >= 4 ? 'high' : ((sub.difficulty || 3) >= 2 ? 'medium' : 'low'),
            isHardDeadline: true,
            isCompleted: false
          }
        ]
      }));
    }

    const rawGamo = d.gamification || DEFAULT_GAMIFICATION;
    const mergedSkills = mergeDomainOntology(rawGamo.skills);
    const initialGamo = {
      ...DEFAULT_GAMIFICATION,
      ...rawGamo,
      skills: mergedSkills
    };


    const baseSettings = d.userSettings ? { ...DEFAULT_USER_SETTINGS, ...d.userSettings } : { ...DEFAULT_USER_SETTINGS };

    const rawFeeds = (Array.isArray(d.icalFeeds) && d.icalFeeds.length > 0)
      ? d.icalFeeds
      : (Array.isArray(baseSettings.icalFeeds) ? baseSettings.icalFeeds : []);
    const knownFeedNames = rawFeeds.map((f: any) => f?.name).filter(Boolean);

    const extEvtsIncoming = (d.externalEvents && Array.isArray(d.externalEvents))
      ? d.externalEvents.map((ev: ExternalEvent) => ({
          ...ev,
          title: cleanEventTitle(ev.title, knownFeedNames)
        }))
      : [];

    const settings: UserSettings = {
      ...baseSettings,
      icalFeeds: rawFeeds
    };

    if (rawFeeds.length > 0) {
      localStorage.setItem('imported_ical_feeds', JSON.stringify(rawFeeds));
    }
    if (settings.googleAccessToken) {
      localStorage.setItem('google_access_token', settings.googleAccessToken);
    }

    const hasConfiguredExtCalendars = rawFeeds.length > 0 || Boolean(settings.googleConnected || settings.googleAccessToken);
    const extEvts = (extEvtsIncoming.length === 0 && hasConfiguredExtCalendars && stateRef.current.externalEvents.length > 0)
      ? stateRef.current.externalEvents
      : extEvtsIncoming;

    if (d.externalEvents && Array.isArray(d.externalEvents)) {
      setExternalEventsState(extEvts);
    }
    if (d.userSettings || rawFeeds.length > 0) {
      setUserSettingsState(settings);
    }

    // Conserver le planning exact s'il existe déjà pour garantir la parité PC / Téléphone
    const weekStart = getStartOfWeek(new Date(), settings.timezone || 'Europe/Paris');
    const hasExistingSchedule = d.scheduleData && Object.keys(d.scheduleData).length > 0;
    const freshSchedule = hasExistingSchedule
      ? d.scheduleData
      : (projs.length > 0
          ? replanifyOnCalendarChange(projs, weekStart, {}, extEvts, settings, initialGamo.calibration)
          : {});

    const updatedGamo = updateMetricsAndQuests(freshSchedule, projs, initialGamo);
    const nextStreak = d.streak || { count: 0, lastDate: '' };
    const nextChat = d.chatHistory || [];
    const nextDark = !!d.isDarkMode;

    stateRef.current = {
      projects: projs,
      scheduleData: freshSchedule,
      externalEvents: extEvts,
      userSettings: settings,
      streak: nextStreak,
      gamification: updatedGamo,
      chatHistory: nextChat,
      isDarkMode: nextDark
    };

    setProjects(projs);
    setScheduleData(freshSchedule);
    setStreak(nextStreak);
    setGamification(updatedGamo);
    setChatHistory(nextChat);
    setIsDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const isSyncingRef = useRef<boolean>(false);

  const getHydratedLocalData = useCallback(() => {
    let localData: any = null;
    try {
      const saved = localStorage.getItem('revisionCalendarData');
      if (saved) localData = JSON.parse(saved);
    } catch (e) {
      console.error('Failed to read local revisionCalendarData:', e);
    }

    let orphanFeeds: any[] = [];
    try {
      const savedFeedsRaw = localStorage.getItem('imported_ical_feeds');
      if (savedFeedsRaw) {
        const parsedFeeds = JSON.parse(savedFeedsRaw);
        if (Array.isArray(parsedFeeds)) orphanFeeds = parsedFeeds;
      }
    } catch {}

    const orphanGToken = localStorage.getItem('google_access_token');

    if (!localData && (orphanFeeds.length > 0 || orphanGToken)) {
      localData = {
        projects: [],
        scheduleData: {},
        streak: { count: 0, lastDate: '' },
        gamification: DEFAULT_GAMIFICATION,
        chatHistory: [],
        externalEvents: [],
        userSettings: { ...DEFAULT_USER_SETTINGS },
        icalFeeds: [],
        isDarkMode: false
      };
    }

    if (!localData) return null;

    let mutated = false;
    const baseFeeds: any[] = Array.isArray(localData.icalFeeds) && localData.icalFeeds.length > 0
      ? localData.icalFeeds
      : (Array.isArray(localData.userSettings?.icalFeeds) ? localData.userSettings.icalFeeds : []);

    const mergedFeeds = [...baseFeeds];
    orphanFeeds.forEach(feed => {
      if (feed && (feed.url || feed.id)) {
        const exists = mergedFeeds.some(f => (feed.id && f.id === feed.id) || (feed.url && f.url === feed.url));
        if (!exists) {
          mergedFeeds.push(feed);
          mutated = true;
        }
      }
    });

    if (mergedFeeds.length > 0 && (!Array.isArray(localData.icalFeeds) || localData.icalFeeds.length !== mergedFeeds.length)) {
      mutated = true;
    }

    const baseSettings: UserSettings = {
      ...DEFAULT_USER_SETTINGS,
      ...(localData.userSettings || {}),
      icalFeeds: mergedFeeds
    };

    if (orphanGToken && (!baseSettings.googleConnected || !baseSettings.googleAccessToken)) {
      baseSettings.googleConnected = true;
      baseSettings.googleAccessToken = orphanGToken;
      mutated = true;
    }

    if (Array.isArray(localData.externalEvents)) {
      const knownFeedNames = mergedFeeds.map(f => f?.name).filter(Boolean);
      const cleaned = localData.externalEvents.map((ev: ExternalEvent) => ({
        ...ev,
        title: cleanEventTitle(ev.title, knownFeedNames)
      }));
      const hasTitleChanged = cleaned.some((ev: ExternalEvent, idx: number) => ev.title !== localData.externalEvents[idx]?.title);
      if (hasTitleChanged) {
        localData.externalEvents = cleaned;
        mutated = true;
      }
    }

    if (mutated) {
      localData = {
        ...localData,
        externalEvents: localData.externalEvents,
        icalFeeds: mergedFeeds,
        userSettings: baseSettings,
        updatedAt: localData.updatedAt || new Date().toISOString()
      };
      try {
        localStorage.setItem('revisionCalendarData', JSON.stringify(localData));
        localStorage.setItem('horaire_revisions_backup', JSON.stringify(localData));
      } catch {}
    }

    return localData;
  }, []);

  const pushSnapshotToCloud = useCallback(async (snapshot: any) => {
    const token = localStorage.getItem('authToken') || 'auth_token_active';
    const payloadToPush = {
      ...snapshot,
      updatedAt: snapshot.updatedAt || new Date().toISOString()
    };
    latestPayloadRef.current = payloadToPush;
    localStorage.setItem('revisionCalendarData', JSON.stringify(payloadToPush));
    localStorage.setItem('horaire_revisions_backup', JSON.stringify(payloadToPush));
    try {
      setSyncStatus('saving');
      const res = await fetch('/api/save', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payloadToPush)
      });
      setSyncStatus(res.ok ? 'synced' : 'error');
    } catch {
      setSyncStatus('error');
    }
  }, []);

  const refreshExternalCalendars = useCallback(async (sourceData: any) => {
    const rawFeeds: any[] = (() => {
      if (Array.isArray(sourceData?.icalFeeds) && sourceData.icalFeeds.length > 0) return sourceData.icalFeeds;
      if (Array.isArray(sourceData?.userSettings?.icalFeeds) && sourceData.userSettings.icalFeeds.length > 0) return sourceData.userSettings.icalFeeds;
      try {
        const s = localStorage.getItem('imported_ical_feeds');
        return s ? JSON.parse(s) : [];
      } catch {
        return [];
      }
    })();

    const gToken = sourceData?.userSettings?.googleAccessToken || localStorage.getItem('google_access_token');
    const shouldFetchGoogle = Boolean(gToken || sourceData?.userSettings?.googleConnected);

    if ((!Array.isArray(rawFeeds) || rawFeeds.length === 0) && !shouldFetchGoogle) {
      return;
    }

    if (gToken) localStorage.setItem('google_access_token', gToken);

    const tasks: Array<Promise<{ kind: 'ical'; feedId: string; events: ExternalEvent[] } | { kind: 'google'; events: ExternalEvent[]; accessToken?: string }>> = [];

    if (Array.isArray(rawFeeds)) {
      rawFeeds.forEach((feed: any) => {
        if (feed?.url) {
          tasks.push(
            fetch('/api/calendar/ical', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ icalUrl: feed.url })
            })
              .then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
              })
              .then(data => {
                if (!data.success || !Array.isArray(data.events)) {
                  throw new Error(data.error || 'Flux iCal invalide');
                }
                const tagged: ExternalEvent[] = data.events.map((ev: any) => ({
                  ...ev,
                  integrationId: feed.id,
                  calendarName: feed.name,
                  title: cleanEventTitle(ev.title, [feed.name])
                }));
                return { kind: 'ical' as const, feedId: feed.id, events: tagged };
              })
          );
        }
      });
    }

    if (shouldFetchGoogle) {
      tasks.push(
        fetch('/api/calendar/google?action=fetch_events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken: gToken || undefined })
        })
          .then(async r => {
            const gData = await r.json().catch(() => ({}));
            if (!r.ok || !gData.success || !Array.isArray(gData.events)) {
              throw new Error(gData.error || `Google HTTP ${r.status}`);
            }
            if (gData.accessToken) {
              localStorage.setItem('google_access_token', gData.accessToken);
            }
            return { kind: 'google' as const, events: gData.events as ExternalEvent[], accessToken: gData.accessToken };
          })
      );
    }

    if (tasks.length === 0) return;

    const settled = await Promise.allSettled(tasks);
    const prevEvents = stateRef.current.externalEvents || [];
    let nextEvents = [...prevEvents];
    let updatedGoogleToken: string | undefined;

    settled.forEach(res => {
      if (res.status === 'fulfilled') {
        const val = res.value;
        if (val.kind === 'ical') {
          nextEvents = [
            ...nextEvents.filter(e => e.integrationId !== val.feedId),
            ...val.events
          ];
        } else if (val.kind === 'google') {
          if (val.accessToken) updatedGoogleToken = val.accessToken;
          const cleanedGoogle = val.events.map((e: ExternalEvent) => ({
            ...e,
            title: cleanEventTitle(e.title)
          }));
          nextEvents = [
            ...nextEvents.filter(e => !e.id?.startsWith('gcal_') && e.source !== 'google'),
            ...cleanedGoogle
          ];
        }
      } else {
        console.warn('Auto-refresh calendrier partiel:', res.reason?.message || res.reason);
      }
    });

    const sig = (list: ExternalEvent[]) =>
      [...list]
        .map(e => `${e.integrationId || ''}|${e.title}|${e.startTime}|${e.endTime}|${e.source}`)
        .sort()
        .join(';;');

    const eventsChanged = sig(prevEvents) !== sig(nextEvents);
    const tokenChanged = Boolean(updatedGoogleToken && updatedGoogleToken !== stateRef.current.userSettings?.googleAccessToken);

    if (!eventsChanged && !tokenChanged) {
      return;
    }

    const curState = stateRef.current;
    const nextSettings: UserSettings = {
      ...curState.userSettings,
      icalFeeds: rawFeeds,
      ...(updatedGoogleToken ? { googleConnected: true, googleAccessToken: updatedGoogleToken } : {})
    };

    let nextSchedule = curState.scheduleData;
    let nextGamo = curState.gamification;

    if (eventsChanged) {
      setExternalEventsState(nextEvents);
      const tz = nextSettings.timezone || 'Europe/Paris';
      const todayStr = getLocalDateString(new Date(), tz);
      let hasConflict = false;

      for (const [dateStr, sessions] of Object.entries(curState.scheduleData || {})) {
        if (dateStr < todayStr) continue;
        for (const s of (sessions || [])) {
          if (s.isCompleted || !s.startTime || !s.endTime) continue;
          if (
            isSlotBlockedByExternalEvent(
              new Date(s.startTime),
              new Date(s.endTime),
              nextEvents,
              nextSettings.bufferMinutesBefore ?? 15,
              nextSettings.bufferMinutesAfter ?? 15
            )
          ) {
            hasConflict = true;
            break;
          }
        }
        if (hasConflict) break;
      }

      if (hasConflict && curState.projects.length > 0) {
        const weekStart = currentWeekStartRef.current || getStartOfWeek(new Date(), tz);
        nextSchedule = replanifyOnCalendarChange(
          curState.projects,
          weekStart,
          curState.scheduleData,
          nextEvents,
          nextSettings,
          curState.gamification.calibration
        );
        nextGamo = updateMetricsAndQuests(nextSchedule, curState.projects, curState.gamification);
        setScheduleData(nextSchedule);
        setGamification(nextGamo);
      }
    }

    if (tokenChanged) {
      setUserSettingsState(nextSettings);
    }

    stateRef.current = {
      ...curState,
      externalEvents: nextEvents,
      userSettings: nextSettings,
      scheduleData: nextSchedule,
      gamification: nextGamo
    };

    await pushSnapshotToCloud({
      projects: curState.projects,
      scheduleData: nextSchedule,
      streak: curState.streak,
      gamification: nextGamo,
      chatHistory: curState.chatHistory,
      isDarkMode: curState.isDarkMode,
      externalEvents: nextEvents,
      userSettings: nextSettings,
      icalFeeds: nextSettings.icalFeeds || rawFeeds,
      updatedAt: new Date().toISOString()
    });
  }, [pushSnapshotToCloud]);

  const syncFromCloud = useCallback(async (isBackground = false) => {
    if (isSyncingRef.current || saveTimerRef.current) return;
    isSyncingRef.current = true;
    if (!isBackground) setSyncStatus('loading');

    const localData = getHydratedLocalData();
    const token = localStorage.getItem('authToken') || 'auth_token_active';

    const localProjCount = Array.isArray(localData?.projects) ? localData.projects.length : 0;
    const localExtCount = Array.isArray(localData?.externalEvents) ? localData.externalEvents.length : 0;
    const localFeedsCount = Array.isArray(localData?.icalFeeds)
      ? localData.icalFeeds.length
      : (Array.isArray(localData?.userSettings?.icalFeeds) ? localData.userSettings.icalFeeds.length : 0);
    const localGoogle = Boolean(localData?.userSettings?.googleConnected || localData?.userSettings?.googleAccessToken);
    const hasAnyLocalContent = localProjCount > 0 || localExtCount > 0 || localFeedsCount > 0 || localGoogle;

    try {
      const res = await fetch(`/api/load?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache'
        }
      });

      if (!res.ok) throw new Error('No Cloud data');
      const cloudData = await res.json();

      if (cloudData && typeof cloudData === 'object') {
        const cloudProjCount = Array.isArray(cloudData.projects) ? cloudData.projects.length : 0;
        const cloudExtCount = Array.isArray(cloudData.externalEvents) ? cloudData.externalEvents.length : 0;
        const cloudFeedsCount = Array.isArray(cloudData.icalFeeds)
          ? cloudData.icalFeeds.length
          : (Array.isArray(cloudData.userSettings?.icalFeeds) ? cloudData.userSettings.icalFeeds.length : 0);
        const cloudGoogle = Boolean(cloudData.userSettings?.googleConnected || cloudData.userSettings?.googleAccessToken);

        const cloudTime = cloudData.updatedAt ? new Date(cloudData.updatedAt).getTime() : 0;
        const localTime = localData?.updatedAt ? new Date(localData.updatedAt).getTime() : 0;

        const isLocalRicherThanLegacyCloud =
          Boolean(localData) &&
          ((cloudProjCount === 0 && localProjCount > 0) ||
           (cloudFeedsCount === 0 && localFeedsCount > 0) ||
           (!cloudData.updatedAt && (
             localProjCount > cloudProjCount ||
             localExtCount > cloudExtCount ||
             localFeedsCount > cloudFeedsCount ||
             (localGoogle && !cloudGoogle)
           )));

        const isLocalNewer = Boolean(localData) && localTime > 0 && cloudTime > 0 && localTime > cloudTime;

        if (isLocalRicherThanLegacyCloud || isLocalNewer) {
          applyStatePayload(localData);
          await pushSnapshotToCloud(localData);
          if (!isBackground) await refreshExternalCalendars(localData);
        } else {
          const hasChanged =
            !isBackground ||
            !localData ||
            cloudData.updatedAt !== localData.updatedAt ||
            cloudProjCount !== localProjCount ||
            cloudExtCount !== localExtCount ||
            cloudFeedsCount !== localFeedsCount ||
            cloudGoogle !== localGoogle;

          if (hasChanged) {
            applyStatePayload(cloudData);
            localStorage.setItem('revisionCalendarData', JSON.stringify(cloudData));
            localStorage.setItem('horaire_revisions_backup', JSON.stringify(cloudData));
          }
          setSyncStatus('synced');
          if (!isBackground) await refreshExternalCalendars(cloudData);
        }
      } else if (hasAnyLocalContent) {
        await pushSnapshotToCloud(localData);
        if (!isBackground) await refreshExternalCalendars(localData);
      } else {
        setSyncStatus('synced');
      }
    } catch (err: any) {
      console.log('Cloud sync skipped or offline:', err?.message || err);
      if (hasAnyLocalContent) {
        await pushSnapshotToCloud(localData);
      } else {
        setSyncStatus('synced');
      }
      if (!isBackground) await refreshExternalCalendars(localData);
    } finally {
      isSyncingRef.current = false;
    }
  }, [applyStatePayload, getHydratedLocalData, pushSnapshotToCloud, refreshExternalCalendars]);

  // Dual Load: 1. LocalStorage Cache, 2. Cloud API (/api/load) + Re-sync on focus/visibility/interval
  useEffect(() => {
    const initialLocal = getHydratedLocalData();
    if (initialLocal) {
      applyStatePayload(initialLocal);
    }

    if (typeof window !== 'undefined' && window.location.search.includes('google_connected=')) {
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', cleanUrl);
    }

    syncFromCloud(false);

    const handleVisibilityOrFocus = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        syncFromCloud(true);
      }
    };

    const handleOnline = () => {
      syncFromCloud(false);
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    const intervalId = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        syncFromCloud(true);
      }
    }, 20000);

    return () => {
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      clearInterval(intervalId);
    };
  }, [applyStatePayload, getHydratedLocalData, syncFromCloud]);

  // Dual Save: 1. LocalStorage, 2. Cloud API (/api/save)
  const saveAll = useCallback((
    newProjects: Project[],
    newSchedule: ScheduleData,
    newStreak: Streak,
    newGamification: Gamification,
    newDark: boolean,
    newEvents?: ExternalEvent[],
    newSettings?: UserSettings,
    newChatHistory?: ChatMessage[]
  ) => {
    const cur = stateRef.current;
    const savedFeedsRaw = localStorage.getItem('imported_ical_feeds');
    let localFeeds: any[] = [];
    try {
      localFeeds = savedFeedsRaw ? JSON.parse(savedFeedsRaw) : [];
    } catch {}

    const currentSettings = newSettings !== undefined ? newSettings : cur.userSettings;
    const mergedFeeds = currentSettings.icalFeeds !== undefined ? currentSettings.icalFeeds : localFeeds;
    const mergedSettings: UserSettings = {
      ...currentSettings,
      icalFeeds: mergedFeeds
    };

    const resolvedEvents = newEvents !== undefined ? newEvents : cur.externalEvents;
    const resolvedChat = newChatHistory !== undefined ? newChatHistory : cur.chatHistory;

    stateRef.current = {
      projects: newProjects,
      scheduleData: newSchedule,
      streak: newStreak,
      gamification: newGamification,
      isDarkMode: newDark,
      externalEvents: resolvedEvents,
      userSettings: mergedSettings,
      chatHistory: resolvedChat
    };

    const payload = {
      projects: newProjects,
      scheduleData: newSchedule,
      streak: newStreak,
      gamification: newGamification,
      chatHistory: resolvedChat,
      isDarkMode: newDark,
      externalEvents: resolvedEvents,
      userSettings: mergedSettings,
      icalFeeds: mergedSettings.icalFeeds,
      updatedAt: new Date().toISOString()
    };

    latestPayloadRef.current = payload;

    // Save to LocalStorage immediately
    localStorage.setItem('revisionCalendarData', JSON.stringify(payload));
    localStorage.setItem('horaire_revisions_backup', JSON.stringify(payload));
    localStorage.setItem('imported_ical_feeds', JSON.stringify(mergedSettings.icalFeeds || []));

    // Sync to Cloud (/api/save)
    const token = localStorage.getItem('authToken') || 'auth_token_active';
    setSyncStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      const payloadToSend = latestPayloadRef.current || payload;
      fetch('/api/save', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payloadToSend)
      })
        .then(res => {
          if (res.ok) setSyncStatus('synced');
          else setSyncStatus('error');
        })
        .catch(() => setSyncStatus('error'));
    }, 400);
  }, []);

  const updateChatHistory = (action: React.SetStateAction<ChatMessage[]>) => {
    setChatHistory(prev => {
      const updated = typeof action === 'function' ? action(prev) : action;
      saveAll(projects, scheduleData, streak, gamification, isDarkMode, externalEvents, userSettings, updated);
      return updated;
    });
  };

  const addProject = (
    name: string,
    code: string,
    deadline: string,
    isHardDeadline: boolean,
    startDate?: string,
    customId?: string,
    initialMilestones?: Array<{
      title: string;
      dueDate?: string;
      estimatedHours: number;
      cognitiveLoad: CognitiveLoad;
      dependsOn?: string[];
    }>
  ) => {
    const todayStr = getLocalDateString(new Date());
    const projId = customId || `prj_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    const milestones: Milestone[] = (initialMilestones || []).map((m, idx) => ({
      id: `ms_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`,
      title: m.title,
      estimatedHours: m.estimatedHours,
      completedHours: 0,
      startDate: startDate || todayStr,
      dueDate: m.dueDate || deadline,
      cognitiveLoad: m.cognitiveLoad,
      isHardDeadline: isHardDeadline,
      isCompleted: false,
      dependsOn: m.dependsOn || []
    }));

    const newProj: Project = {
      id: projId,
      name,
      code: code.toUpperCase() || 'PRJ',
      color: COLORS[projects.length % COLORS.length],
      startDate: startDate || todayStr,
      deadline,
      isHardDeadline,
      milestones
    };
    const updatedProjects = [...projects, newProj];
    const updatedSchedule = generateSchedule(updatedProjects, currentWeekStart, scheduleData, gamification.calibration, externalEvents, userSettings);
    const updatedGamo = updateMetricsAndQuests(updatedSchedule, updatedProjects, gamification);

    setProjects(updatedProjects);
    setScheduleData(updatedSchedule);
    setGamification(updatedGamo);
    saveAll(updatedProjects, updatedSchedule, streak, updatedGamo, isDarkMode);

    return projId;
  };

  const addMilestones = (
    projId: string,
    milestonesToAdd: Array<{
      title: string;
      dueDate?: string;
      estimatedHours: number;
      cognitiveLoad: CognitiveLoad;
      dependsOn?: string[];
      startDate?: string;
    }>
  ) => {
    if (!milestonesToAdd || milestonesToAdd.length === 0) return;
    const todayStr = getLocalDateString(new Date());

    const updatedProjects = projects.map(p => {
      if (p.id === projId) {
        const newMsList: Milestone[] = milestonesToAdd.map((m, idx) => ({
          id: `ms_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`,
          title: m.title,
          estimatedHours: m.estimatedHours,
          completedHours: 0,
          startDate: m.startDate || p.startDate || todayStr,
          dueDate: m.dueDate || p.deadline,
          cognitiveLoad: m.cognitiveLoad,
          isHardDeadline: p.isHardDeadline,
          isCompleted: false,
          dependsOn: m.dependsOn || []
        }));

        return {
          ...p,
          milestones: [...p.milestones, ...newMsList]
        };
      }
      return p;
    });

    const updatedSchedule = generateSchedule(updatedProjects, currentWeekStart, scheduleData, gamification.calibration, externalEvents, userSettings);
    const updatedGamo = updateMetricsAndQuests(updatedSchedule, updatedProjects, gamification);

    setProjects(updatedProjects);
    setScheduleData(updatedSchedule);
    setGamification(updatedGamo);
    saveAll(updatedProjects, updatedSchedule, streak, updatedGamo, isDarkMode);
  };

  const addMilestone = (
    projId: string,
    title: string,
    dueDate: string,
    estimatedHours: number,
    cognitiveLoad: CognitiveLoad,
    dependsOn?: string[],
    startDate?: string
  ) => {
    addMilestones(projId, [{
      title,
      dueDate,
      estimatedHours,
      cognitiveLoad,
      dependsOn,
      startDate
    }]);
  };

  const deleteProject = (projId: string) => {
    const projToDelete = projects.find(p => p.id === projId);
    const deletedMsIds = new Set(projToDelete?.milestones.map(m => m.id) || []);

    // 1. Nettoyer le projet et retirer les références d'ID supprimés dans les dépendances
    const updatedProjects = projects
      .filter(p => p.id !== projId)
      .map(p => ({
        ...p,
        milestones: p.milestones.map(m => ({
          ...m,
          dependsOn: (m.dependsOn || []).filter(depId => !deletedMsIds.has(depId))
        }))
      }));

    // 2. Nettoyer les séances orphelines liées à ce projet
    const cleanedSchedule: ScheduleData = {};
    Object.entries(scheduleData).forEach(([dateStr, sessions]) => {
      cleanedSchedule[dateStr] = sessions.filter(s => s.projectId !== projId);
    });

    const updatedSchedule = generateSchedule(updatedProjects, currentWeekStart, cleanedSchedule, gamification.calibration, externalEvents, userSettings);
    const updatedGamo = updateMetricsAndQuests(updatedSchedule, updatedProjects, gamification);

    setProjects(updatedProjects);
    setScheduleData(updatedSchedule);
    setGamification(updatedGamo);
    saveAll(updatedProjects, updatedSchedule, streak, updatedGamo, isDarkMode);
  };

  const deleteMilestone = (projId: string, msId: string) => {
    // 1. Nettoyer le jalon ET purger msId de toutes les listes dependsOn
    const updatedProjects = projects.map(p => {
      const filteredMilestones = p.milestones
        .filter(m => m.id !== msId)
        .map(m => ({
          ...m,
          dependsOn: (m.dependsOn || []).filter(depId => depId !== msId)
        }));
      return { ...p, milestones: filteredMilestones };
    });

    // 2. Nettoyer les séances orphelines liées à ce jalon
    const cleanedSchedule: ScheduleData = {};
    Object.entries(scheduleData).forEach(([dateStr, sessions]) => {
      cleanedSchedule[dateStr] = sessions.filter(s => s.milestoneId !== msId);
    });

    const updatedSchedule = generateSchedule(updatedProjects, currentWeekStart, cleanedSchedule, gamification.calibration, externalEvents, userSettings);
    const updatedGamo = updateMetricsAndQuests(updatedSchedule, updatedProjects, gamification);

    setProjects(updatedProjects);
    setScheduleData(updatedSchedule);
    setGamification(updatedGamo);
    saveAll(updatedProjects, updatedSchedule, streak, updatedGamo, isDarkMode);
  };


  const dismissToast = (toastId: string) => {
    setGamification(prev => ({
      ...prev,
      toastQueue: (prev.toastQueue || []).filter(t => t.id !== toastId)
    }));
  };

  const toggleSession = (dateStr: string, sessionIndex: number) => {
    const sessions = scheduleData[dateStr] || [];
    if (!sessions[sessionIndex]) return;

    const updatedSessions = [...sessions];
    const s = { ...updatedSessions[sessionIndex] };
    s.isCompleted = !s.isCompleted;
    updatedSessions[sessionIndex] = s;

    const updatedSchedule = {
      ...scheduleData,
      [dateStr]: updatedSessions
    };

    let updatedGamification = { ...gamification };
    let updatedStreak = { ...streak };

    if (s.isCompleted) {
      // 0. Mise à jour déterministe du Streak (Évaluation de l'écart avant réécriture)
      const userTz = userSettings.timezone || 'Europe/Paris';
      const todayStr = getLocalDateString(new Date(), userTz);

      if (!streak.lastDate) {
        updatedStreak = { count: 1, lastDate: todayStr };
      } else if (streak.lastDate !== todayStr) {
        const parts = streak.lastDate.split('-').map(Number);
        const lastD = new Date(parts[0], parts[1] - 1, parts[2]);
        const tParts = todayStr.split('-').map(Number);
        const currD = new Date(tParts[0], tParts[1] - 1, tParts[2]);
        const diffDays = Math.round((currD.getTime() - lastD.getTime()) / 86400000);

        if (diffDays === 1) {
          updatedStreak = { count: streak.count + 1, lastDate: todayStr };
        } else if (diffDays > 1) {
          updatedStreak = { count: 1, lastDate: todayStr };
        }
      }

      // Trouver la charge cognitive du jalon parent
      let cognitiveLoad: CognitiveLoad = 'medium';

      let plannedMinutes = 60;
      const targetProj = projects.find(p => p.id === s.projectId);
      if (targetProj) {
        const targetMs = targetProj.milestones.find(m => m.id === s.milestoneId);
        if (targetMs) {
          cognitiveLoad = targetMs.cognitiveLoad || 'medium';
          plannedMinutes = Math.round((targetMs.estimatedHours || 1) * 60);
        }
      }

      // 1. Calcul de l'XP pondérée avec plancher & cap anti-oubli
      const actualMinutes = s.durationMinutes || 60;
      const { xpGained, countedMinutes } = calculateSessionXP({
        actualDurationMinutes: actualMinutes,
        plannedDurationMinutes: plannedMinutes,
        cognitiveLoad,
        velocityIndex: gamification.velocityIndex || 100,
        isOnTime: true
      });

      const newTotalXp = updatedGamification.xp + xpGained;
      const { level: newGlobalLevel, title: newTitle, xpToNextLevel } = calculateLevelAndTitle(newTotalXp);

      // Si montée de niveau, push toast
      const newToastQueue = [...(updatedGamification.toastQueue || [])];
      if (newGlobalLevel > updatedGamification.level) {
        newToastQueue.push({
          id: `toast_lvl_${newGlobalLevel}_${Date.now()}`,
          type: 'level',
          title: 'Niveau Supérieur !',
          message: `Félicitations, vous êtes désormais ${newTitle}`,
          icon: '✨',
          subtext: `Niveau ${newGlobalLevel} débloqué (+${xpGained} XP)`
        });
      } else {
        newToastQueue.push({
          id: `toast_xp_${Date.now()}`,
          type: 'xp',
          title: 'Session Validée !',
          message: `+${xpGained} XP Qualifiés`,
          icon: '⚡',
          subtext: `Charge cognitive: ${cognitiveLoad.toUpperCase()}`
        });
      }

      // 2. Détermination du domaine & mise à jour des heures qualifiées
      const skillKey = resolveTargetDomainKey(s.note, updatedGamification.skills);

      const currentSkill = updatedGamification.skills[skillKey] || DEFAULT_SKILLS[skillKey] || {
        id: skillKey, name: 'Domaine', category: 'Custom', color: '#14B8A6', icon: '⚡', isSystem: false, archived: false, hoursSpent: 0, level: 1, currentTier: 'Novice', tierProgressPct: 0, hoursRemainingInTier: 20
      };

      const hoursAdd = countedMinutes / 60;
      const newHoursSpent = currentSkill.hoursSpent + hoursAdd;
      const mastery = evaluateDomainMastery(newHoursSpent);

      const updatedSkills = {
        ...updatedGamification.skills,
        [skillKey]: {
          ...currentSkill,
          hoursSpent: Math.round(newHoursSpent * 10) / 10,
          level: mastery.level,
          currentTier: mastery.currentTier,
          tierProgressPct: mastery.tierProgressPct,
          hoursRemainingInTier: mastery.hoursRemainingInTier
        }
      };

      // 3. Mise à jour des agrégats O(1)
      const currentAggs = updatedGamification.aggregates || {
        weeklyHighCognitiveHours: 0,
        consecutivePunctualMilestones: 0,
        lastActiveDate: '',
        resurrectedProjectsCount: 0,
        totalActiveFocusSeconds: 0
      };

      const highCogHoursAdd = cognitiveLoad === 'high' ? hoursAdd : 0;
      const newAggregates = {
        ...currentAggs,
        weeklyHighCognitiveHours: currentAggs.weeklyHighCognitiveHours + highCogHoursAdd,
        consecutivePunctualMilestones: currentAggs.consecutivePunctualMilestones + 1,
        totalActiveFocusSeconds: currentAggs.totalActiveFocusSeconds + (countedMinutes * 60)
      };

      // 4. Évaluation O(1) des badges
      const { newlyUnlocked, toastsToPush } = checkBadgeUnlocks(
        { ...updatedGamification, skills: updatedSkills },
        newAggregates
      );

      updatedGamification = {
        ...updatedGamification,
        xp: newTotalXp,
        level: newGlobalLevel,
        title: newTitle,
        xpToNextLevel,
        sessionsCompleted: updatedGamification.sessionsCompleted + 1,
        skills: updatedSkills,
        unlockedBadges: [...(updatedGamification.unlockedBadges || []), ...newlyUnlocked],
        aggregates: newAggregates,
        toastQueue: [...newToastQueue, ...toastsToPush]
      };
    } else {
      // Décochement : déduire l'XP et les heures de domaine de manière symétrique
      const actualMinutes = s.durationMinutes || 60;
      const hoursSubtract = actualMinutes / 60;
      const xpDeduct = Math.max(10, Math.round(actualMinutes * 1.5));
      const newTotalXp = Math.max(0, updatedGamification.xp - xpDeduct);
      const { level: newGlobalLevel, title: newTitle, xpToNextLevel } = calculateLevelAndTitle(newTotalXp);

      const skillKey = resolveTargetDomainKey(s.note, updatedGamification.skills);

      const currentSkill = updatedGamification.skills[skillKey] || DEFAULT_SKILLS[skillKey];
      if (currentSkill) {
        const newHoursSpent = Math.max(0, currentSkill.hoursSpent - hoursSubtract);
        const mastery = evaluateDomainMastery(newHoursSpent);
        updatedGamification = {
          ...updatedGamification,
          xp: newTotalXp,
          level: newGlobalLevel,
          title: newTitle,
          xpToNextLevel,
          sessionsCompleted: Math.max(0, updatedGamification.sessionsCompleted - 1),
          skills: {
            ...updatedGamification.skills,
            [skillKey]: {
              ...currentSkill,
              hoursSpent: Math.round(newHoursSpent * 10) / 10,
              level: mastery.level,
              currentTier: mastery.currentTier,
              tierProgressPct: mastery.tierProgressPct,
              hoursRemainingInTier: mastery.hoursRemainingInTier
            }
          }
        };
      }
    }



    const sessionHoursDelta = ((s.durationMinutes || 60) / 60) * (s.isCompleted ? 1 : -1);
    const updatedProjects = projects.map(p => {
      if (p.id !== s.projectId) return p;
      return {
        ...p,
        milestones: p.milestones.map(m => {
          if (m.id !== s.milestoneId) return m;
          const nextHours = Math.max(0, Math.round(((m.completedHours || 0) + sessionHoursDelta) * 10) / 10);
          return {
            ...m,
            completedHours: nextHours,
            isCompleted: nextHours >= (m.estimatedHours || 10)
          };
        })
      };
    });

    if (updatedStreak.count > (updatedGamification.bestStreak || 0)) {
      updatedGamification.bestStreak = updatedStreak.count;
    }

    updatedGamification = updateMetricsAndQuests(updatedSchedule, updatedProjects, updatedGamification);

    setProjects(updatedProjects);
    setScheduleData(updatedSchedule);
    setStreak(updatedStreak);
    setGamification(updatedGamification);
    saveAll(updatedProjects, updatedSchedule, updatedStreak, updatedGamification, isDarkMode);
  };



  const changeWeek = (offset: number) => {
    const nextWeek = new Date(currentWeekStart);
    nextWeek.setDate(nextWeek.getDate() + offset * 7);
    setCurrentWeekStart(nextWeek);
    const updatedSchedule = generateSchedule(projects, nextWeek, scheduleData, gamification.calibration, externalEvents, userSettings);
    const updatedGamo = updateMetricsAndQuests(updatedSchedule, projects, gamification);

    setScheduleData(updatedSchedule);
    setGamification(updatedGamo);
    saveAll(projects, updatedSchedule, streak, updatedGamo, isDarkMode);
  };

  const regenerateSchedule = () => {
    const updatedSchedule = replanifyOnCalendarChange(projects, currentWeekStart, scheduleData, externalEvents, userSettings, gamification.calibration);
    setScheduleData(updatedSchedule);
    saveAll(projects, updatedSchedule, streak, gamification, isDarkMode);
  };

  const updateProjects = (updatedProjects: Project[]) => {
    const updatedSchedule = replanifyOnCalendarChange(updatedProjects, currentWeekStart, scheduleData, externalEvents, userSettings, gamification.calibration);
    const updatedGamo = updateMetricsAndQuests(updatedSchedule, updatedProjects, gamification);
    setProjects(updatedProjects);
    setScheduleData(updatedSchedule);
    setGamification(updatedGamo);
    saveAll(updatedProjects, updatedSchedule, streak, updatedGamo, isDarkMode);
  };

  const toggleTheme = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    document.documentElement.classList.toggle('dark', nextDark);
    saveAll(projects, scheduleData, streak, gamification, nextDark);
  };

  const resetAllData = () => {
    localStorage.removeItem('revisionCalendarData');
    localStorage.removeItem('horaire_revisions_backup');
    setProjects([]);
    setScheduleData({});
    setStreak({ count: 0, lastDate: '' });
    const freshSkills = mergeDomainOntology();


    const freshGamo: Gamification = {
      ...DEFAULT_GAMIFICATION,
      velocityIndex: 100,
      skills: freshSkills,
      sessionsCompleted: 0,
      pomodorosCompleted: 0,
      xp: 0,
      level: 1
    };
    setGamification(freshGamo);
    setChatHistory([]);
    saveAll([], {}, { count: 0, lastDate: '' }, freshGamo, isDarkMode);
  };

  const exportDataJSON = () => {
    const payload = {
      projects,
      scheduleData,
      externalEvents,
      userSettings,
      streak,
      gamification,
      chatHistory,
      isDarkMode,
      exportedAt: new Date().toISOString()
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `horaire_projects_backup_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const importDataJSON = (jsonString: string) => {
    try {
      const parsed = JSON.parse(jsonString);
      applyStatePayload(parsed);
      saveAll(parsed.projects || [], parsed.scheduleData || {}, parsed.streak || { count: 0, lastDate: '' }, parsed.gamification || DEFAULT_GAMIFICATION, !!parsed.isDarkMode, parsed.externalEvents, parsed.userSettings);
      return true;
    } catch (e) {
      alert("Erreur lors de l'importation du fichier JSON.");
      return false;
    }
  };

  const updateUserSettings = (newSettings: Partial<UserSettings>) => {
    const cur = stateRef.current;
    const updated = { ...cur.userSettings, ...newSettings };
    stateRef.current = { ...cur, userSettings: updated };
    setUserSettingsState(updated);
    const updatedSchedule = replanifyOnCalendarChange(
      cur.projects,
      currentWeekStart,
      cur.scheduleData,
      cur.externalEvents,
      updated,
      cur.gamification.calibration
    );
    stateRef.current = { ...stateRef.current, scheduleData: updatedSchedule };
    setScheduleData(updatedSchedule);
    saveAll(cur.projects, updatedSchedule, cur.streak, cur.gamification, cur.isDarkMode, cur.externalEvents, updated, cur.chatHistory);
  };

  const setExternalEvents = (events: ExternalEvent[]) => {
    const cur = stateRef.current;
    stateRef.current = { ...cur, externalEvents: events };
    setExternalEventsState(events);
    const updatedSchedule = replanifyOnCalendarChange(
      cur.projects,
      currentWeekStart,
      cur.scheduleData,
      events,
      cur.userSettings,
      cur.gamification.calibration
    );
    stateRef.current = { ...stateRef.current, scheduleData: updatedSchedule };
    setScheduleData(updatedSchedule);
    saveAll(cur.projects, updatedSchedule, cur.streak, cur.gamification, cur.isDarkMode, events, cur.userSettings, cur.chatHistory);
  };

  const addExternalEvent = (event: ExternalEvent) => {
    const updatedEvents = [...stateRef.current.externalEvents, event];
    setExternalEvents(updatedEvents);
  };

  const addCustomDomain = (name: string, category: DomainCategory, color: string, icon: string, keywords: string[] = []) => {
    const domainId = `custom_${Date.now()}`;
    const newDomain: StudyDomain = {
      id: domainId,
      name,
      category,
      color: color || '#3B82F6',
      icon: icon || '⚡',
      isSystem: false,
      archived: false,
      hoursSpent: 0,
      level: 1,
      currentTier: 'Novice',
      tierProgressPct: 0,
      hoursRemainingInTier: 20,
      keywords
    };

    const updatedGamification = {
      ...gamification,
      skills: {
        ...gamification.skills,
        [domainId]: newDomain
      }
    };

    setGamification(updatedGamification);
    saveAll(projects, scheduleData, streak, updatedGamification, isDarkMode);
  };

  const updateDomain = (domainId: string, updates: Partial<StudyDomain>) => {
    const existing = gamification.skills[domainId];
    if (!existing) return;

    const updatedDomain = {
      ...existing,
      ...updates
    };

    const updatedGamification = {
      ...gamification,
      skills: {
        ...gamification.skills,
        [domainId]: updatedDomain
      }
    };

    setGamification(updatedGamification);
    saveAll(projects, scheduleData, streak, updatedGamification, isDarkMode);
  };

  const archiveDomain = (domainId: string) => {
    updateDomain(domainId, { archived: true });
  };

  const restoreDomain = (domainId: string) => {
    updateDomain(domainId, { archived: false });
  };

  return {
    projects,
    scheduleData,
    externalEvents,
    userSettings,
    streak,
    gamification,
    chatHistory,
    currentWeekStart,
    isDarkMode,
    authToken,
    isAuthenticated,
    setIsAuthenticated,
    syncStatus,
    addProject,
    addMilestone,
    addMilestones,
    deleteProject,
    deleteMilestone,
    toggleSession,
    changeWeek,
    regenerateSchedule,
    updateProjects,
    toggleTheme,
    resetAllData,
    exportDataJSON,
    importDataJSON,
    setChatHistory: updateChatHistory,
    updateUserSettings,
    setExternalEvents,
    addExternalEvent,
    dismissToast,
    addCustomDomain,
    updateDomain,
    archiveDomain,
    restoreDomain,
    forceCloudSync: () => syncFromCloud(false)
  };
}




