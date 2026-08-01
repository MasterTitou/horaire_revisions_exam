import { Project, Milestone, ScheduleData, CognitiveLoad, CalibrationLoop, ExternalEvent, UserSettings, Session } from '../types';

export const SLOTS = ["Matin", "Après-midi", "Soir"];
export const HPH = 10 / 3;
export const MAX_STUDY_HOURS_PER_DAY = 6;

export const DEFAULT_CALIBRATION: CalibrationLoop = {
  highFactor: 1.25,   // +25% correction sur Architecture / Stratégie
  mediumFactor: 1.10, // +10% correction sur Dev / Exécution
  lowFactor: 1.00,
  lastCalibrated: 'Aujourd\'hui'
};

export const DEFAULT_USER_SETTINGS: UserSettings = {
  timezone: 'Europe/Paris',
  bufferMinutesBefore: 15,
  bufferMinutesAfter: 15,
  dayStartHour: 8,
  dayEndHour: 23,
  slotDurationMinutes: 60
};

export function getLocalDateString(d: Date, timezone: string = 'Europe/Paris'): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(d);
  } catch (e) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}

export function getStartOfWeek(date: Date, timezone: string = 'Europe/Paris'): Date {
  const dateStr = getLocalDateString(date, timezone);
  const parts = dateStr.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Détection formelle de cycle dans le graphe WBS DAG via DFS coloré (Anti-Infinite Recursion).
 */
export function detectCycles(projects: Project[]): { hasCycle: boolean; cycleNodes: Set<string> } {
  const msMap = new Map<string, Milestone>();
  const graph = new Map<string, string[]>();

  projects.forEach(p => {
    (p.milestones || []).forEach(m => {
      msMap.set(m.id, m);
      graph.set(m.id, m.dependsOn || []);
    });
  });

  const visited = new Set<string>();
  const inStack = new Set<string>();
  const cycleNodes = new Set<string>();

  const dfs = (nodeId: string): boolean => {
    visited.add(nodeId);
    inStack.add(nodeId);

    const neighbors = graph.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (!msMap.has(neighbor)) continue;
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) {
          cycleNodes.add(nodeId);
          return true;
        }
      } else if (inStack.has(neighbor)) {
        cycleNodes.add(nodeId);
        cycleNodes.add(neighbor);
        return true;
      }
    }

    inStack.delete(nodeId);
    return false;
  };

  for (const mId of msMap.keys()) {
    if (!visited.has(mId)) {
      dfs(mId);
    }
  }

  return { hasCycle: cycleNodes.size > 0, cycleNodes };
}

/**
 * Calcul du Chemin Critique (CPM - Critical Path Method) 100% PURE, DÉTERMINISTE & GLOBAL CROSS-PROJETS.
 * Identifie l'intégralité de la chaîne de dépendances (y compris inter-projets) où la Marge Totale (Slack = LS - ES) est égale à zéro.
 */
export function computeCriticalPath(
  projects: Project[],
  calibration: CalibrationLoop = DEFAULT_CALIBRATION
): Record<string, boolean> {
  const criticalMap: Record<string, boolean> = {};
  if (!projects || projects.length === 0) return criticalMap;

  const { cycleNodes } = detectCycles(projects);

  const msMap = new Map<string, Milestone>();
  const durationMap = new Map<string, number>();

  projects.forEach(project => {
    (project.milestones || []).forEach(m => {
      if (cycleNodes.has(m.id)) return;
      msMap.set(m.id, m);
      const calFactor = m.cognitiveLoad === 'high'
        ? calibration.highFactor
        : (m.cognitiveLoad === 'medium' ? calibration.mediumFactor : calibration.lowFactor);
      const duration = Math.max(1, Math.round((m.estimatedHours || 10) * calFactor));
      durationMap.set(m.id, duration);
    });
  });

  if (msMap.size === 0) return criticalMap;

  // Prédécesseurs filtrés (on ignore les dependsOn pointant vers un id inconnu)
  const predecessors = new Map<string, string[]>();
  const successors = new Map<string, string[]>();

  msMap.forEach((m, mId) => {
    predecessors.set(mId, (m.dependsOn || []).filter(pId => msMap.has(pId)));
    successors.set(mId, []);
  });
  msMap.forEach((_, mId) => {
    (predecessors.get(mId) || []).forEach(pId => {
      successors.get(pId)!.push(mId);
    });
  });

  // --- Détection des composantes connexes (Union-Find) ---
  const parent = new Map<string, string>();
  msMap.forEach((_, mId) => parent.set(mId, mId));

  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root)!;
    let cur = id;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const union = (a: string, b: string) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  msMap.forEach((_, mId) => {
    (predecessors.get(mId) || []).forEach(pId => union(mId, pId));
  });

  // PASSE AVANT (Forward Pass: ES & EF)
  const ES = new Map<string, number>();
  const EF = new Map<string, number>();

  const calcForward = (mId: string, visited = new Set<string>()): number => {
    if (EF.has(mId)) return EF.get(mId)!;
    if (visited.has(mId)) return 0;
    visited.add(mId);

    let maxEarliestStart = 0;
    (predecessors.get(mId) || []).forEach(pId => {
      maxEarliestStart = Math.max(maxEarliestStart, calcForward(pId, new Set(visited)));
    });

    const es = maxEarliestStart;
    const ef = es + (durationMap.get(mId) || 10);
    ES.set(mId, es);
    EF.set(mId, ef);
    return ef;
  };

  msMap.forEach((_, mId) => calcForward(mId));

  // Horizon LOCAL par composante (remplace le globalMaxFinish partagé)
  const componentMaxFinish = new Map<string, number>();
  msMap.forEach((_, mId) => {
    const root = find(mId);
    const ef = EF.get(mId) || 0;
    componentMaxFinish.set(root, Math.max(componentMaxFinish.get(root) || 0, ef));
  });

  // PASSE ARRIÈRE (Backward Pass: LS & LF), bornée par composante
  const LS = new Map<string, number>();
  const LF = new Map<string, number>();

  const calcBackward = (mId: string, visited = new Set<string>()): number => {
    if (LS.has(mId)) return LS.get(mId)!;
    const localMaxFinish = componentMaxFinish.get(find(mId)) || (durationMap.get(mId) || 10);
    if (visited.has(mId)) return localMaxFinish;
    visited.add(mId);

    let minLatestFinish = localMaxFinish;
    (successors.get(mId) || []).forEach(sId => {
      minLatestFinish = Math.min(minLatestFinish, calcBackward(sId, new Set(visited)));
    });

    const lf = minLatestFinish;
    const ls = lf - (durationMap.get(mId) || 10);
    LF.set(mId, lf);
    LS.set(mId, ls);
    return ls;
  };

  msMap.forEach((_, mId) => calcBackward(mId));

  // CALCUL DE LA MARGE TOTALE (Slack = LS - ES)
  msMap.forEach((_, mId) => {
    const es = ES.get(mId) || 0;
    const ls = LS.get(mId) || 0;
    const slack = Math.max(0, ls - es);
    criticalMap[mId] = (slack === 0);
  });

  return criticalMap;
}


/**
 * Vérifie si un créneau proposé [slotStart, slotEnd] entre en conflit avec un événement externe
 * en incluant les temps de tampon (Buffer Times) avant et après l'événement.
 */
export function isSlotBlockedByExternalEvent(
  slotStart: Date,
  slotEnd: Date,
  externalEvents: ExternalEvent[],
  bufferBeforeMinutes: number = 15,
  bufferAfterMinutes: number = 15
): boolean {
  const slotStartMs = slotStart.getTime();
  const slotEndMs = slotEnd.getTime();

  for (const event of externalEvents) {
    const evStartMs = new Date(event.startTime).getTime() - (bufferBeforeMinutes * 60 * 1000);
    const evEndMs = new Date(event.endTime).getTime() + (bufferAfterMinutes * 60 * 1000);

    if (slotStartMs < evEndMs && slotEndMs > evStartMs) {
      return true;
    }
  }

  return false;
}

export function generateSchedule(
  projects: Project[],
  currentWeekStart: Date,
  existingSchedule: ScheduleData,
  calibration: CalibrationLoop = DEFAULT_CALIBRATION,
  externalEvents: ExternalEvent[] = [],
  settings: UserSettings = DEFAULT_USER_SETTINGS
): ScheduleData {
  if (!projects || projects.length === 0) return {};

  const userTimezone = settings.timezone || 'Europe/Paris';
  const criticalMap = computeCriticalPath(projects, calibration);
  const scheduleData: ScheduleData = { ...existingSchedule };

  // Milestone completion tracking
  const milestoneCompletedHours: Record<string, number> = {};
  const completedMilestoneIds = new Set<string>();

  projects.forEach(p => {
    p.milestones.forEach(m => {
      if (m.isCompleted) completedMilestoneIds.add(m.id);
    });
  });

  Object.values(existingSchedule).forEach(sessions => {
    sessions.forEach(sess => {
      if (sess.isCompleted && sess.milestoneId) {
        const hours = sess.durationMinutes ? (sess.durationMinutes / 60) : HPH;
        milestoneCompletedHours[sess.milestoneId] = (milestoneCompletedHours[sess.milestoneId] || 0) + hours;
      }
    });
  });

  interface FlatMilestone {
    project: Project;
    milestone: Milestone;
    id: string;
    title: string;
    color: string;
    startDate: string;
    dueDate: string;
    isHardDeadline: boolean;
    isCriticalPath: boolean;
    cognitiveLoad: CognitiveLoad;
    estimatedHours: number;
    completedHours: number;
    dependsOn: string[];
  }

  const allMilestones: FlatMilestone[] = [];
  projects.forEach(proj => {
    proj.milestones.forEach(ms => {
      if (!ms.isCompleted) {
        const actualDone = Math.max(ms.completedHours || 0, milestoneCompletedHours[ms.id] || 0);

        const calFactor = ms.cognitiveLoad === 'high' ? calibration.highFactor : (ms.cognitiveLoad === 'medium' ? calibration.mediumFactor : calibration.lowFactor);
        const calibratedEstimate = Math.round((ms.estimatedHours || 10) * calFactor);

        allMilestones.push({
          project: proj,
          milestone: ms,
          id: ms.id,
          title: ms.title,
          color: proj.color,
          startDate: ms.startDate || proj.startDate || '',
          dueDate: ms.dueDate || proj.deadline || '',
          isHardDeadline: ms.isHardDeadline || proj.isHardDeadline,
          isCriticalPath: !!criticalMap[ms.id],
          cognitiveLoad: ms.cognitiveLoad || 'medium',
          estimatedHours: calibratedEstimate,
          completedHours: actualDone,
          dependsOn: ms.dependsOn || []
        });
      }
    });
  });

  if (allMilestones.length === 0) return scheduleData;

  const projectedHours: Record<string, number> = {};
  allMilestones.forEach(m => projectedHours[m.id] = 0);

  const dayStartHour = settings.dayStartHour ?? 8;
  const dayEndHour = settings.dayEndHour ?? 23;
  const slotDurationMinutes = settings.slotDurationMinutes ?? 60;
  const slotHours = slotDurationMinutes / 60;
  const maxSessionsPerDay = Math.floor(MAX_STUDY_HOURS_PER_DAY / slotHours);

  const todayStr = getLocalDateString(new Date(), userTimezone);

  for (let i = 0; i < 7; i++) {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + i);
    const dateStr = getLocalDateString(d, userTimezone);

    if (dateStr < todayStr) {
      if (!scheduleData[dateStr]) {
        scheduleData[dateStr] = existingSchedule[dateStr] || [];
      }
      continue;
    }

    // CORRECTION BUG 1 : Conserver les séances complétées pour ce jour
    const existingCompletedSessions = (existingSchedule[dateStr] || []).filter(s => s.isCompleted);
    scheduleData[dateStr] = [...existingCompletedSessions];

    let sessionsCreatedToday = existingCompletedSessions.length;

    const dayStartMs = new Date(d).setHours(0, 0, 0, 0);
    const dayEndMs = new Date(d).setHours(23, 59, 59, 999);
    const dayEvents = externalEvents.filter(ev => {
      const evStart = new Date(ev.startTime).getTime();
      const evEnd = new Date(ev.endTime).getTime();
      return evStart < dayEndMs && evEnd > dayStartMs;
    });

    const dayStartMinute = dayStartHour * 60;
    const dayEndMinute = dayEndHour * 60;
    const bufferAfter = settings.bufferMinutesAfter ?? 15;

    let currentSlotStartMinute = dayStartMinute;

    while (currentSlotStartMinute + slotDurationMinutes <= dayEndMinute) {
      if (sessionsCreatedToday >= maxSessionsPerDay) break;

      const slotStart = new Date(d);
      const startH = Math.floor(currentSlotStartMinute / 60);
      const startM = currentSlotStartMinute % 60;
      slotStart.setHours(startH, startM, 0, 0);

      const slotEnd = new Date(slotStart.getTime() + slotDurationMinutes * 60 * 1000);

      if (isSlotBlockedByExternalEvent(slotStart, slotEnd, dayEvents, settings.bufferMinutesBefore, settings.bufferMinutesAfter)) {
        currentSlotStartMinute += 30;
        continue;
      }

      const hour = slotStart.getHours();
      const slotIdx = hour < 12 ? 0 : (hour < 18 ? 1 : 2);
      const targetCog: CognitiveLoad = slotIdx === 0 ? 'high' : (slotIdx === 1 ? 'medium' : 'low');

      const candidates = allMilestones.filter(m => {
        // CORRECTION BIAIS 1 : Normalisation stricte de la date au format YYYY-MM-DD
        const msStartStr = m.startDate ? m.startDate.split('T')[0] : '';
        const msDueStr = m.dueDate ? m.dueDate.split('T')[0] : '';

        if (msStartStr && dateStr < msStartStr) return false;
        if (msDueStr && dateStr > msDueStr) return false;
        if (slotIdx === 2 && m.cognitiveLoad === 'high') return false;

        // CORRECTION BIAIS 2 (DOCUMENTATION SEUIL 75%) :
        // Le seuil de 75% d'exécution permet le chevauchement maîtrisé (Fast-Tracking WBS).
        // Il débloque la tâche suivante une fois le cœur de l'effort réalisé sans attendre 100%.
        if (m.dependsOn && m.dependsOn.length > 0) {
          const allPrereqsDone = m.dependsOn.every(prereqId => {
            if (completedMilestoneIds.has(prereqId)) return true;
            const doneHours = milestoneCompletedHours[prereqId] || 0;
            const prereqTarget = allMilestones.find(item => item.id === prereqId);
            const prereqEst = prereqTarget ? prereqTarget.estimatedHours : 10;
            return doneHours >= (prereqEst * 0.75);
          });
          if (!allPrereqsDone) return false;
        }

        return true;
      });

      if (candidates.length === 0) {
        currentSlotStartMinute += 30;
        continue;
      }

      const scored = candidates.map(m => {
        let daysToDeadline = 60;
        if (m.dueDate) {
          const dueClean = m.dueDate.split('T')[0];
          const parts = dueClean.split('-');
          if (parts.length === 3) {
            const targetD = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            const currD = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            daysToDeadline = Math.max(1, Math.round((targetD.getTime() - currD.getTime()) / 86400000));
          }
        }

        const bufferedDaysToDeadline = Math.max(1, Math.floor(daysToDeadline * 0.85));
        const remainingHours = Math.max(0, m.estimatedHours - m.completedHours - projectedHours[m.id]);
        if (remainingHours <= 0) return { milestone: m, score: -999 };

        let pressure = 1.0;
        if (m.isHardDeadline) {
          if (bufferedDaysToDeadline <= 1) pressure = 4.5;
          else if (bufferedDaysToDeadline <= 3) pressure = 3.0;
          else if (bufferedDaysToDeadline <= 7) pressure = 2.0;
          else pressure = 1.2;
        } else {
          // CORRECTION BIAIS 3 : Remplacement du HPH hérité par la durée réelle du créneau (slotHours)
          pressure = Math.min(1.5, (remainingHours / slotHours) / bufferedDaysToDeadline);
        }

        let cogMatchBonus = 0;
        if (m.cognitiveLoad === targetCog) cogMatchBonus = 2.0;
        else if (slotIdx === 0 && m.cognitiveLoad === 'medium') cogMatchBonus = 0.5;

        const criticalBonus = m.isCriticalPath ? 3.5 : 0;
        const score = (pressure * 2.0) + cogMatchBonus + criticalBonus + (remainingHours / 5);
        return { milestone: m, score };
      });

      scored.sort((a, b) => b.score - a.score);
      const best = scored[0];
      if (best && best.score > 0) {
        projectedHours[best.milestone.id] += slotHours;

        const formatTime = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

        scheduleData[dateStr].push({
          id: 'sess_' + Math.random().toString(36).substr(2, 9),
          projectId: best.milestone.project.id,
          milestoneId: best.milestone.id,
          subjectId: best.milestone.project.id,
          note: `${formatTime(slotStart)}–${formatTime(slotEnd)} · [${best.milestone.project.code}] ${best.milestone.title}`,
          isCompleted: false,
          startTime: slotStart.toISOString(),
          endTime: slotEnd.toISOString(),
          durationMinutes: slotDurationMinutes
        });
        sessionsCreatedToday++;

        currentSlotStartMinute += (slotDurationMinutes + bufferAfter);
      } else {
        currentSlotStartMinute += 30;
      }
    }
  }

  return scheduleData;
}

export function replanifyOnCalendarChange(
  projects: Project[],
  currentWeekStart: Date,
  existingSchedule: ScheduleData,
  externalEvents: ExternalEvent[],
  settings: UserSettings = DEFAULT_USER_SETTINGS,
  calibration: CalibrationLoop = DEFAULT_CALIBRATION
): ScheduleData {
  const preservedSchedule: ScheduleData = {};

  Object.entries(existingSchedule).forEach(([dateStr, sessions]) => {
    preservedSchedule[dateStr] = sessions.filter(s => s.isCompleted);
  });

  return generateSchedule(
    projects,
    currentWeekStart,
    preservedSchedule,
    calibration,
    externalEvents,
    settings
  );
}

export interface PlanningConflictReport {
  hasConflicts: boolean;
  totalRequiredHours: number;
  totalAvailableHours: number;
  totalPlannedNotCompletedHours: number; // INFORMATIF : heures déjà planifiées mais pas encore complétées
  overloadedProjects: { id: string; name: string; requiredHours: number; daysRemaining: number }[];
  impasseMilestones: { id: string; title: string; cognitiveLoad: string; isHardDeadline: boolean }[];
  summaryMessage: string;
}

export function evaluatePlanningConflicts(
  projects: Project[],
  existingSchedule: ScheduleData = {},
  settings: UserSettings = DEFAULT_USER_SETTINGS
): PlanningConflictReport {
  let totalRequiredHours = 0;
  let totalPlannedNotCompletedHours = 0;
  let maxHorizonDays = 1;
  const overloadedProjects: PlanningConflictReport['overloadedProjects'] = [];
  const impasseMilestones: PlanningConflictReport['impasseMilestones'] = [];

  const userTimezone = settings.timezone || 'Europe/Paris';
  const todayStr = getLocalDateString(new Date(), userTimezone);
  const parts = todayStr.split('-').map(Number);
  const today = new Date(parts[0], parts[1] - 1, parts[2]);

  // Heures déjà planifiées mais non complétées : gardées à titre INFORMATIF seulement.
  // generateSchedule régénère systématiquement ces séances à chaque appel (elles ne
  // survivent pas à une replanification), donc elles ne doivent PAS réduire le
  // volume d'heures considéré comme "requis" — sous peine de sous-estimer la charge
  // réelle que generateSchedule devra recaser.
  const milestonePlannedHours: Record<string, number> = {};
  Object.values(existingSchedule || {}).forEach(sessions => {
    (sessions || []).forEach(s => {
      if (!s.isCompleted && s.milestoneId) {
        const hours = s.durationMinutes ? (s.durationMinutes / 60) : HPH;
        milestonePlannedHours[s.milestoneId] = (milestonePlannedHours[s.milestoneId] || 0) + hours;
        totalPlannedNotCompletedHours += hours;
      }
    });
  });

  projects.forEach(p => {
    let projReqHours = 0;
    let projDaysRemaining = 30;

    if (p.deadline) {
      const cleanDeadline = p.deadline.split('T')[0];
      const pParts = cleanDeadline.split('-').map(Number);
      if (pParts.length === 3) {
        const target = new Date(pParts[0], pParts[1] - 1, pParts[2]);
        projDaysRemaining = Math.max(1, Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
      }
    }

    maxHorizonDays = Math.max(maxHorizonDays, projDaysRemaining);

    p.milestones.forEach(m => {
      if (!m.isCompleted) {
        // Seules les heures COMPLÉTÉES sont déduites — cohérent avec generateSchedule
        // qui ne préserve que les sessions isCompleted lors d'une replanification.
        const req = Math.max(0, (m.estimatedHours || 10) - (m.completedHours || 0));
        projReqHours += req;
        totalRequiredHours += req;

        let msDaysRemaining = projDaysRemaining;
        if (m.dueDate) {
          const cleanDue = m.dueDate.split('T')[0];
          const mParts = cleanDue.split('-').map(Number);
          if (mParts.length === 3) {
            const msTarget = new Date(mParts[0], mParts[1] - 1, mParts[2]);
            msDaysRemaining = Math.max(1, Math.round((msTarget.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
          }
        }

        if (msDaysRemaining <= 3 && req > (3 * MAX_STUDY_HOURS_PER_DAY)) {
          impasseMilestones.push({
            id: m.id,
            title: m.title,
            cognitiveLoad: m.cognitiveLoad || 'medium',
            isHardDeadline: m.isHardDeadline || p.isHardDeadline
          });
        }
      }
    });

    const capacity = projDaysRemaining * MAX_STUDY_HOURS_PER_DAY;
    if (projReqHours > capacity) {
      overloadedProjects.push({
        id: p.id,
        name: p.name,
        requiredHours: projReqHours,
        daysRemaining: projDaysRemaining
      });
    }
  });

  const totalAvailableHours = maxHorizonDays * MAX_STUDY_HOURS_PER_DAY;

  const hasConflicts = overloadedProjects.length > 0 || impasseMilestones.length > 0 || totalRequiredHours > totalAvailableHours;
  let summaryMessage = "Planning équilibré et réalisable.";
  if (hasConflicts) {
    summaryMessage = `Surcharge détectée : ${totalRequiredHours.toFixed(1)}h requises pour ~${totalAvailableHours}h de capacité disponible sur votre agenda unique.`;
  }

  return {
    hasConflicts,
    totalRequiredHours,
    totalAvailableHours,
    totalPlannedNotCompletedHours,
    overloadedProjects,
    impasseMilestones,
    summaryMessage
  };
}


/**
 * Arbitrage déterministe non-destructif.
 */
export function resolveConflictsHeuristically(
  projects: Project[],
  conflicts: PlanningConflictReport,
  timezone: string = 'Europe/Paris'
): { updatedProjects: Project[]; actionsTaken: string[] } {
  const actionsTaken: string[] = [];

  const updatedProjects = JSON.parse(JSON.stringify(projects)) as Project[];

  // 1. Reporter les jalons non-fermes des projets surchargés
  conflicts.overloadedProjects.forEach(overloaded => {
    const proj = updatedProjects.find(p => p.id === overloaded.id);
    if (!proj) return;

    proj.milestones.forEach(m => {
      if (!m.isCompleted && !m.isHardDeadline) {
        if (m.dueDate) {
          const cleanDue = m.dueDate.split('T')[0];
          const dParts = cleanDue.split('-').map(Number);
          if (dParts.length === 3) {
            const d = new Date(dParts[0], dParts[1] - 1, dParts[2]);
            d.setDate(d.getDate() + 7);
            m.dueDate = getLocalDateString(d, timezone);
            actionsTaken.push(`Décalage de 7 jours du jalon non-ferme « ${m.title} » (${proj.name}).`);
          }
        }
      }
    });
  });

  // 2. Si l'impasse persiste, réajuster les jalons à charge cognitive élevée avec traçabilité flag wasReduced
  conflicts.impasseMilestones.forEach(imp => {
    if (!imp.isHardDeadline) {
      updatedProjects.forEach(p => {
        p.milestones.forEach(m => {
          if (m.id === imp.id) {
            m.estimatedHours = Math.max(2, Math.round((m.estimatedHours || 10) * 0.75));
            m.wasReduced = true;
            actionsTaken.push(`Réduction du volume horaire de 25% sur « ${m.title} » (Ajusté).`);
          }
        });
      });
    }
  });

  if (actionsTaken.length === 0) {
    actionsTaken.push("Aucun réajustement automatique requis sur le planning actuel.");
  } else {
    actionsTaken.unshift("⚡ Arbitrage déterministe appliqué par le moteur TS :");
  }

  return { updatedProjects, actionsTaken };
}
