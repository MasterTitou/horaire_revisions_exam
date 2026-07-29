import { Project, Milestone, ScheduleData, CognitiveLoad, CalibrationLoop } from '../types';

export const SLOTS = ["Matin (3h20)", "Après-midi (3h20)", "Soir (3h20)"];
export const HPH = 10 / 3;

export const DEFAULT_CALIBRATION: CalibrationLoop = {
  highFactor: 1.25,   // +25% correction sur Architecture
  mediumFactor: 1.10, // +10% correction sur Dev
  lowFactor: 1.00,
  lastCalibrated: 'Aujourd\'hui'
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

export function generateSchedule(
  projects: Project[],
  currentWeekStart: Date,
  existingSchedule: ScheduleData,
  calibration: CalibrationLoop = DEFAULT_CALIBRATION
): ScheduleData {
  if (!projects || projects.length === 0) return {};

  const scheduleData: ScheduleData = { ...existingSchedule };

  // Calculate actual completed hours per milestone across existing schedule
  const milestoneCompletedHours: Record<string, number> = {};
  Object.values(existingSchedule).forEach(sessions => {
    sessions.forEach(sess => {
      if (sess.isCompleted && sess.milestoneId) {
        milestoneCompletedHours[sess.milestoneId] = (milestoneCompletedHours[sess.milestoneId] || 0) + HPH;
      }
    });
  });

  // Flatten active milestones
  interface FlatMilestone {
    project: Project;
    milestone: Milestone;
    id: string;
    title: string;
    color: string;
    dueDate: string;
    isHardDeadline: boolean;
    cognitiveLoad: CognitiveLoad;
    estimatedHours: number;
    completedHours: number;
  }

  const allMilestones: FlatMilestone[] = [];
  projects.forEach(proj => {
    proj.milestones.forEach(ms => {
      if (!ms.isCompleted) {
        const actualDone = Math.max(ms.completedHours || 0, milestoneCompletedHours[ms.id] || 0);

        // RÉTRO-ÉTALONNAGE IA : Application du coefficient correcteur selon l'effort cognitif
        const calFactor = ms.cognitiveLoad === 'high' ? calibration.highFactor : (ms.cognitiveLoad === 'medium' ? calibration.mediumFactor : calibration.lowFactor);
        const calibratedEstimate = Math.round(ms.estimatedHours * calFactor);

        allMilestones.push({
          project: proj,
          milestone: ms,
          id: ms.id,
          title: ms.title,
          color: proj.color,
          dueDate: ms.dueDate || proj.deadline || '',
          isHardDeadline: ms.isHardDeadline || proj.isHardDeadline,
          cognitiveLoad: ms.cognitiveLoad || 'medium',
          estimatedHours: calibratedEstimate,
          completedHours: actualDone
        });
      }
    });
  });

  if (allMilestones.length === 0) return scheduleData;

  const projectedHours: Record<string, number> = {};
  allMilestones.forEach(m => projectedHours[m.id] = 0);

  for (let i = 0; i < 7; i++) {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + i);
    const dateStr = getLocalDateString(d);
    scheduleData[dateStr] = [];

    const dayOfWeek = d.getDay(); // 0 is Sunday, 6 is Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Plafond strict de capacité quotidienne : Max 2 slots (6h20) en semaine, Max 3 slots (10h) le week-end
    const maxSlotsForDay = isWeekend ? 3 : 2;

    for (let slotIdx = 0; slotIdx < maxSlotsForDay; slotIdx++) {
      // Slot 0: Matin (prefers high cog), Slot 1: Après-midi (prefers medium cog), Slot 2: Soir (prefers low cog)
      const targetCog: CognitiveLoad = slotIdx === 0 ? 'high' : (slotIdx === 1 ? 'medium' : 'low');

      const candidates = allMilestones.filter(m => {
        if (m.dueDate && dateStr > m.dueDate) return false;
        // Evening slot rule: strictly avoid high cognitive load tasks at night
        if (slotIdx === 2 && m.cognitiveLoad === 'high') return false;
        return true;
      });

      if (candidates.length === 0) continue;

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

        // MARGE DE SÉCURITÉ INTÉGRÉE (BUFFER ZONE - 15%)
        const bufferedDaysToDeadline = Math.max(1, Math.floor(daysToDeadline * 0.85));

        const remainingHours = Math.max(0, m.estimatedHours - m.completedHours - projectedHours[m.id]);
        if (remainingHours <= 0) return { milestone: m, score: -999 };

        // Calcul de pression avec Buffer Zone
        let pressure = 1.0;
        if (m.isHardDeadline) {
          if (bufferedDaysToDeadline <= 1) pressure = 4.5;
          else if (bufferedDaysToDeadline <= 3) pressure = 3.0;
          else if (bufferedDaysToDeadline <= 7) pressure = 2.0;
          else pressure = 1.2;
        } else {
          pressure = Math.min(1.5, (remainingHours / HPH) / bufferedDaysToDeadline);
        }

        // Alignement d'effort cognitif avec le créneau
        let cogMatchBonus = 0;
        if (m.cognitiveLoad === targetCog) cogMatchBonus = 2.0;
        else if (slotIdx === 0 && m.cognitiveLoad === 'medium') cogMatchBonus = 0.5;

        const score = (pressure * 2.0) + cogMatchBonus + (remainingHours / 5);
        return { milestone: m, score };
      });

      scored.sort((a, b) => b.score - a.score);
      const best = scored[0];
      if (best && best.score > 0) {
        projectedHours[best.milestone.id] += HPH;
        scheduleData[dateStr].push({
          id: 'sess_' + Math.random().toString(36).substr(2, 9),
          projectId: best.milestone.project.id,
          milestoneId: best.milestone.id,
          subjectId: best.milestone.project.id,
          note: `${SLOTS[slotIdx]} · [${best.milestone.project.code}] ${best.milestone.title}`,
          isCompleted: false
        });
      }
    }
  }

  return scheduleData;
}
