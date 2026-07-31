import { Project, Milestone, ScheduleData, CognitiveLoad, CalibrationLoop, ExternalEvent, UserSettings, Session } from '../types';

export const SLOTS = ["Matin", "Après-midi", "Soir"];
export const HPH = 10 / 3;

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

export function getLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Calcul du Chemin Critique (CPM - Critical Path Method) sur le graphe DAG des jalons WBS.
 * Identifie les jalons où la Marge Totale (Slack) est égale à zéro.
 */
export function computeCriticalPath(projects: Project[]): Record<string, boolean> {
  const criticalMap: Record<string, boolean> = {};

  projects.forEach(project => {
    const milestones = project.milestones;
    if (!milestones || milestones.length === 0) return;

    const msMap = new Map<string, Milestone>();
    milestones.forEach(m => msMap.set(m.id, m));

    const getChainDuration = (mId: string, visited = new Set<string>()): number => {
      if (visited.has(mId)) return 0;
      visited.add(mId);

      const ms = msMap.get(mId);
      if (!ms) return 0;

      let maxParentDuration = 0;
      if (ms.dependsOn && ms.dependsOn.length > 0) {
        ms.dependsOn.forEach(parentId => {
          maxParentDuration = Math.max(maxParentDuration, getChainDuration(parentId, new Set(visited)));
        });
      }

      return maxParentDuration + (ms.estimatedHours || 10);
    };

    let maxProjectChain = 0;
    const durationsMap: Record<string, number> = {};

    milestones.forEach(m => {
      const dur = getChainDuration(m.id);
      durationsMap[m.id] = dur;
      maxProjectChain = Math.max(maxProjectChain, dur);
    });

    milestones.forEach(m => {
      if (maxProjectChain > 0 && durationsMap[m.id] >= maxProjectChain * 0.85) {
        criticalMap[m.id] = true;
        m.isCriticalPath = true;
      } else {
        m.isCriticalPath = false;
      }
    });
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

    // Chevauchement d'intervalles : (slotStart < evEnd) AND (slotEnd > evStart)
    if (slotStartMs < evEndMs && slotEndMs > evStartMs) {
      return true; // En conflit !
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

  const criticalMap = computeCriticalPath(projects);
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
        const calibratedEstimate = Math.round(ms.estimatedHours * calFactor);

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

  // Plafond quotidien : max 6 heures de sessions de révision par jour
  // Cela évite d'empiler 11+ sessions sur un seul jour et force la distribution
  const MAX_STUDY_HOURS_PER_DAY = 6;
  const maxSessionsPerDay = Math.floor(MAX_STUDY_HOURS_PER_DAY / (slotDurationMinutes / 60));

  const todayStr = getLocalDateString(new Date());

  for (let i = 0; i < 7; i++) {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + i);
    const dateStr = getLocalDateString(d);
    
    // RÈGLE STRICTE : Ne jamais planifier de nouvelles séances dans le passé (avant aujourd'hui)
    if (dateStr < todayStr) {
      if (!scheduleData[dateStr]) {
        scheduleData[dateStr] = existingSchedule[dateStr] || [];
      }
      continue;
    }

    scheduleData[dateStr] = [];

    // Filtrer les événements externes du jour uniquement (optimisation + exactitude)
    const dayStartMs = new Date(d).setHours(0, 0, 0, 0);
    const dayEndMs = new Date(d).setHours(23, 59, 59, 999);
    const dayEvents = externalEvents.filter(ev => {
      const evStart = new Date(ev.startTime).getTime();
      const evEnd = new Date(ev.endTime).getTime();
      return evStart < dayEndMs && evEnd > dayStartMs;
    });

    // Compteur de sessions créées ce jour
    let sessionsCreatedToday = 0;

    // Découpage en tranches d'heures réelles de dayStartHour à dayEndHour
    let currentSlotStartHour = dayStartHour;

    while (currentSlotStartHour < dayEndHour) {
      // Vérifier le plafond quotidien
      if (sessionsCreatedToday >= maxSessionsPerDay) break;

      const slotStart = new Date(d);
      slotStart.setHours(currentSlotStartHour, 0, 0, 0);

      const slotEnd = new Date(slotStart.getTime() + slotDurationMinutes * 60 * 1000);
      if (slotEnd.getHours() > dayEndHour) break;

      // 1. Vérification des conflits d'agendas externes & temps de tampon
      if (isSlotBlockedByExternalEvent(slotStart, slotEnd, dayEvents, settings.bufferMinutesBefore, settings.bufferMinutesAfter)) {
        currentSlotStartHour += (slotDurationMinutes / 60);
        continue;
      }

      // Slot index: 0 = Matin, 1 = Après-midi, 2 = Soir
      const hour = slotStart.getHours();
      const slotIdx = hour < 12 ? 0 : (hour < 18 ? 1 : 2);
      const targetCog: CognitiveLoad = slotIdx === 0 ? 'high' : (slotIdx === 1 ? 'medium' : 'low');

      const candidates = allMilestones.filter(m => {
        // Ne pas planifier avant la date de début définie du projet ou du jalon
        if (m.startDate && dateStr < m.startDate) return false;
        if (m.dueDate && dateStr > m.dueDate) return false;
        if (slotIdx === 2 && m.cognitiveLoad === 'high') return false;

        if (m.dependsOn && m.dependsOn.length > 0) {
          const allPrereqsDone = m.dependsOn.every(prereqId => {
            return completedMilestoneIds.has(prereqId) || (milestoneCompletedHours[prereqId] || 0) >= 5;
          });
          if (!allPrereqsDone) return false;
        }

        return true;
      });


      if (candidates.length === 0) {
        currentSlotStartHour += (slotDurationMinutes / 60);
        continue;
      }

      const scored = candidates.map(m => {
        let daysToDeadline = 60;
        if (m.dueDate) {
          const parts = m.dueDate.split('-');
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
          pressure = Math.min(1.5, (remainingHours / HPH) / bufferedDaysToDeadline);
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
        const slotHours = slotDurationMinutes / 60;
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
      }

      currentSlotStartHour += (slotDurationMinutes / 60);
    }
  }

  return scheduleData;
}

/**
 * Replanification dynamique déclenchée lors d'un événement Webhook ou d'une mise à jour d'agenda externe.
 */
export function replanifyOnCalendarChange(
  projects: Project[],
  currentWeekStart: Date,
  existingSchedule: ScheduleData,
  externalEvents: ExternalEvent[],
  settings: UserSettings = DEFAULT_USER_SETTINGS,
  calibration: CalibrationLoop = DEFAULT_CALIBRATION
): ScheduleData {
  // Conserver uniquement les séances déjà complétées par l'utilisateur
  const preservedSchedule: ScheduleData = {};

  Object.entries(existingSchedule).forEach(([dateStr, sessions]) => {
    preservedSchedule[dateStr] = sessions.filter(s => s.isCompleted);
  });

  // Régénérer les séances non complétées sur les nouvelles heures creuses disponibles
  return generateSchedule(
    projects,
    currentWeekStart,
    preservedSchedule,
    calibration,
    externalEvents,
    settings
  );
}

