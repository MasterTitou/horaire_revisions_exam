import { useState, useEffect, useCallback, useRef } from 'react';
import { Project, ScheduleData, Streak, Gamification, ChatMessage, DomainSkill, DynamicQuest, ExternalEvent, UserSettings, CognitiveLoad } from '../types';
import { generateSchedule, getStartOfWeek, HPH, DEFAULT_USER_SETTINGS, replanifyOnCalendarChange, getLocalDateString } from '../engine/scheduler';

import {
  calculateSessionXP,
  evaluateDomainMastery,
  calculateLevelAndTitle,
  extractDailyQuestsFromWBS,
  checkBadgeUnlocks
} from '../engine/gamificationEngine';


const COLORS = [
  "#0E8478", "#6B46C1", "#2E7D32", "#FF6B35", "#3B82F6", "#D946EF",
  "#059669", "#E11D48", "#F59E0B", "#8B5CF6", "#14B8A6", "#EC4899"
];

// UNIVERSAL MULTI-DOMAIN SKILLS TREE INITIALISATION
const DEFAULT_SKILLS: Record<string, DomainSkill> = {
  agri: { id: 'agri', name: 'Agriculture & Botanique', icon: '🌿', hoursSpent: 14, level: 1, currentTier: 'Novice', tierProgressPct: 70, hoursRemainingInTier: 6 },
  aero: { id: 'aero', name: 'Aérospatial & Ingénierie', icon: '🚀', hoursSpent: 10, level: 1, currentTier: 'Novice', tierProgressPct: 50, hoursRemainingInTier: 10 },
  finance: { id: 'finance', name: 'Finance & Business', icon: '💼', hoursSpent: 18, level: 1, currentTier: 'Novice', tierProgressPct: 90, hoursRemainingInTier: 2 },
  art: { id: 'art', name: 'Art & Création', icon: '🎨', hoursSpent: 8, level: 1, currentTier: 'Novice', tierProgressPct: 40, hoursRemainingInTier: 12 },
  tech: { id: 'tech', name: 'Tech & Systèmes', icon: '💻', hoursSpent: 22, level: 2, currentTier: 'Débutant Autonome', tierProgressPct: 3, hoursRemainingInTier: 78 },
  science: { id: 'science', name: 'Sciences & Recherche', icon: '🔬', hoursSpent: 6, level: 1, currentTier: 'Novice', tierProgressPct: 30, hoursRemainingInTier: 14 },
  logistics: { id: 'logistics', name: 'Logistique & Organisation', icon: '📋', hoursSpent: 12, level: 1, currentTier: 'Novice', tierProgressPct: 60, hoursRemainingInTier: 8 }
};

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
  const [authToken, setAuthToken] = useState<string>(localStorage.getItem('authToken') || '');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!localStorage.getItem('authToken'));
  const [syncStatus, setSyncStatus] = useState<'synced' | 'saving' | 'loading' | 'error'>('synced');

  const saveTimerRef = useRef<any>(null);


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
    const initialGamo = {
      ...DEFAULT_GAMIFICATION,
      ...rawGamo,
      skills: { ...DEFAULT_SKILLS, ...(rawGamo.skills || {}) }
    };

    const extEvts = (d.externalEvents && Array.isArray(d.externalEvents)) ? d.externalEvents : [];
    const settings = d.userSettings || DEFAULT_USER_SETTINGS;

    if (d.externalEvents && Array.isArray(d.externalEvents)) {
      setExternalEventsState(d.externalEvents);
    }
    if (d.userSettings) {
      setUserSettingsState(d.userSettings);
    }

    // Régénérer dynamiquement les créneaux futurs pour appliquer les pauses de tampon 15 min
    const weekStart = getStartOfWeek(new Date());
    const freshSchedule = replanifyOnCalendarChange(projs, weekStart, d.scheduleData || {}, extEvts, settings, initialGamo.calibration);

    const updatedGamo = updateMetricsAndQuests(freshSchedule, projs, initialGamo);

    setProjects(projs);
    setScheduleData(freshSchedule);
    setStreak(d.streak || { count: 0, lastDate: '' });
    setGamification(updatedGamo);
    setChatHistory(d.chatHistory || []);
    setIsDarkMode(!!d.isDarkMode);
    if (d.isDarkMode) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  // Dual Load: 1. LocalStorage Cache, 2. Cloud Redis API (/api/load)
  useEffect(() => {
    // 1. LocalStorage Initial Load
    const saved = localStorage.getItem('revisionCalendarData');
    if (saved) {
      try {
        const d = JSON.parse(saved);
        applyStatePayload(d);
      } catch (e) {
        console.error('Failed to parse revisionCalendarData:', e);
      }
    }

    // 2. Fetch from Cloud Redis API if authenticated
    const token = localStorage.getItem('authToken');
    if (token) {
      setSyncStatus('loading');
      fetch('/api/load', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(res => {
          if (res.ok) return res.json();
          throw new Error('No Cloud Redis data');
        })
        .then(cloudData => {
          if (cloudData && typeof cloudData === 'object') {
            applyStatePayload(cloudData);
            localStorage.setItem('revisionCalendarData', JSON.stringify(cloudData));
            localStorage.setItem('horaire_revisions_backup', JSON.stringify(cloudData));
          }
          setSyncStatus('synced');
        })
        .catch(err => {
          console.log('Redis load skipped or offline:', err.message);
          setSyncStatus('synced');
        });
    }

    // 3. Rafraîchissement automatique en arrière-plan de tous les flux iCal importés (ex: École)
    const savedFeeds = localStorage.getItem('imported_ical_feeds');
    if (savedFeeds) {
      try {
        const feeds = JSON.parse(savedFeeds);
        if (Array.isArray(feeds) && feeds.length > 0) {
          feeds.forEach((feed: any) => {
            if (feed.url) {
              fetch('/api/calendar/ical', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ icalUrl: feed.url })
              })
                .then(r => r.json())
                .then(data => {
                  if (data.success && data.events) {
                    const tagged = data.events.map((ev: any) => ({
                      ...ev,
                      integrationId: feed.id,
                      title: `[${feed.name}] ${ev.title}`
                    }));
                    setExternalEventsState(prev => [
                      ...prev.filter(e => e.integrationId !== feed.id),
                      ...tagged
                    ]);
                  }
                })
                .catch(e => console.error(`iCal auto-refresh err (${feed.name}):`, e.message));
            }
          });
        }
      } catch (err) {
        console.error('Error parsing iCal feeds for auto-refresh:', err);
      }
    }
  }, [applyStatePayload]);

  // Dual Save: 1. LocalStorage, 2. Cloud Redis API (/api/save)
  const saveAll = useCallback((
    newProjects: Project[],
    newSchedule: ScheduleData,
    newStreak: Streak,
    newGamification: Gamification,
    newDark: boolean,
    newEvents?: ExternalEvent[],
    newSettings?: UserSettings
  ) => {
    const payload = {
      projects: newProjects,
      scheduleData: newSchedule,
      streak: newStreak,
      gamification: newGamification,
      chatHistory,
      isDarkMode: newDark,
      externalEvents: newEvents !== undefined ? newEvents : externalEvents,
      userSettings: newSettings !== undefined ? newSettings : userSettings
    };

    // Save to LocalStorage immediately
    localStorage.setItem('revisionCalendarData', JSON.stringify(payload));
    localStorage.setItem('horaire_revisions_backup', JSON.stringify(payload));

    // Sync to Cloud Redis (/api/save)
    const token = localStorage.getItem('authToken');
    if (token) {
      setSyncStatus('saving');
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

      saveTimerRef.current = setTimeout(() => {
        fetch('/api/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        })
          .then(res => {
            if (res.ok) setSyncStatus('synced');
            else setSyncStatus('error');
          })
          .catch(() => setSyncStatus('error'));
      }, 600);
    }
  }, [chatHistory, externalEvents, userSettings]);

  const addProject = (name: string, code: string, deadline: string, isHardDeadline: boolean, startDate?: string) => {
    const todayStr = getLocalDateString(new Date());
    const newProj: Project = {
      id: `prj_${Date.now()}`,
      name,
      code: code.toUpperCase() || 'PRJ',
      color: COLORS[projects.length % COLORS.length],
      startDate: startDate || todayStr,
      deadline,
      isHardDeadline,
      milestones: []
    };
    const updatedProjects = [...projects, newProj];
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
    cognitiveLoad: 'high' | 'medium' | 'low',
    dependsOn?: string[],
    startDate?: string
  ) => {
    const todayStr = getLocalDateString(new Date());
    const updatedProjects = projects.map(p => {
      if (p.id === projId) {
        return {
          ...p,
          milestones: [
            ...p.milestones,
            {
              id: `ms_${Date.now()}`,
              title,
              estimatedHours,
              completedHours: 0,
              startDate: startDate || p.startDate || todayStr,
              dueDate: dueDate || p.deadline,
              cognitiveLoad,
              isHardDeadline: p.isHardDeadline,
              isCompleted: false,
              dependsOn: dependsOn || []
            }
          ]
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

  const deleteProject = (projId: string) => {
    const updatedProjects = projects.filter(p => p.id !== projId);
    const updatedSchedule = generateSchedule(updatedProjects, currentWeekStart, scheduleData, gamification.calibration, externalEvents, userSettings);
    const updatedGamo = updateMetricsAndQuests(updatedSchedule, updatedProjects, gamification);

    setProjects(updatedProjects);
    setScheduleData(updatedSchedule);
    setGamification(updatedGamo);
    saveAll(updatedProjects, updatedSchedule, streak, updatedGamo, isDarkMode);
  };

  const deleteMilestone = (projId: string, msId: string) => {
    const updatedProjects = projects.map(p => {
      if (p.id === projId) {
        return {
          ...p,
          milestones: p.milestones.filter(m => m.id !== msId)
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

    if (s.isCompleted) {
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
      let skillKey = 'logistics';
      const noteLower = s.note.toLowerCase();
      if (noteLower.includes('potager') || noteLower.includes('botanique') || noteLower.includes('agri')) skillKey = 'agri';
      else if (noteLower.includes('fusée') || noteLower.includes('propulsion') || noteLower.includes('aero')) skillKey = 'aero';
      else if (noteLower.includes('finance') || noteLower.includes('budget') || noteLower.includes('levée')) skillKey = 'finance';
      else if (noteLower.includes('art') || noteLower.includes('design') || noteLower.includes('créa')) skillKey = 'art';
      else if (noteLower.includes('tech') || noteLower.includes('dev') || noteLower.includes('arch') || noteLower.includes('code')) skillKey = 'tech';
      else if (noteLower.includes('science') || noteLower.includes('recherche') || noteLower.includes('étude')) skillKey = 'science';

      const currentSkill = updatedGamification.skills[skillKey] || DEFAULT_SKILLS[skillKey] || {
        id: skillKey, name: 'Domaine', icon: '⚡', hoursSpent: 0, level: 1, currentTier: 'Novice', tierProgressPct: 0, hoursRemainingInTier: 20
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
    }

    updatedGamification = updateMetricsAndQuests(updatedSchedule, projects, updatedGamification);

    setScheduleData(updatedSchedule);
    setGamification(updatedGamification);
    saveAll(projects, updatedSchedule, streak, updatedGamification, isDarkMode);
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
    const freshSkills: Record<string, DomainSkill> = {
      agri: { id: 'agri', name: 'Agriculture & Botanique', icon: '🌿', hoursSpent: 0, level: 1, currentTier: 'Novice', tierProgressPct: 0, hoursRemainingInTier: 20 },
      aero: { id: 'aero', name: 'Aérospatial & Ingénierie', icon: '🚀', hoursSpent: 0, level: 1, currentTier: 'Novice', tierProgressPct: 0, hoursRemainingInTier: 20 },
      finance: { id: 'finance', name: 'Finance & Business', icon: '💼', hoursSpent: 0, level: 1, currentTier: 'Novice', tierProgressPct: 0, hoursRemainingInTier: 20 },
      art: { id: 'art', name: 'Art & Création', icon: '🎨', hoursSpent: 0, level: 1, currentTier: 'Novice', tierProgressPct: 0, hoursRemainingInTier: 20 },
      tech: { id: 'tech', name: 'Tech & Systèmes', icon: '💻', hoursSpent: 0, level: 1, currentTier: 'Novice', tierProgressPct: 0, hoursRemainingInTier: 20 },
      science: { id: 'science', name: 'Sciences & Recherche', icon: '🔬', hoursSpent: 0, level: 1, currentTier: 'Novice', tierProgressPct: 0, hoursRemainingInTier: 20 },
      logistics: { id: 'logistics', name: 'Logistique & Organisation', icon: '📋', hoursSpent: 0, level: 1, currentTier: 'Novice', tierProgressPct: 0, hoursRemainingInTier: 20 }
    };

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
    const updated = { ...userSettings, ...newSettings };
    setUserSettingsState(updated);
    const updatedSchedule = replanifyOnCalendarChange(projects, currentWeekStart, scheduleData, externalEvents, updated, gamification.calibration);
    setScheduleData(updatedSchedule);
    saveAll(projects, updatedSchedule, streak, gamification, isDarkMode, externalEvents, updated);
  };

  const setExternalEvents = (events: ExternalEvent[]) => {
    setExternalEventsState(events);
    const updatedSchedule = replanifyOnCalendarChange(projects, currentWeekStart, scheduleData, events, userSettings, gamification.calibration);
    setScheduleData(updatedSchedule);
    saveAll(projects, updatedSchedule, streak, gamification, isDarkMode, events, userSettings);
  };

  const addExternalEvent = (event: ExternalEvent) => {
    const updatedEvents = [...externalEvents, event];
    setExternalEvents(updatedEvents);
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
    deleteProject,
    deleteMilestone,
    toggleSession,
    changeWeek,
    regenerateSchedule,
    toggleTheme,
    resetAllData,
    exportDataJSON,
    importDataJSON,
    setChatHistory,
    updateUserSettings,
    setExternalEvents,
    addExternalEvent,
    dismissToast
  };
}


