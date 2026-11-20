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

/**
 * Construit un objet Date JS dont l'instant (timestamp UTC) correspond exactement
 * à l'heure locale (HH:mm) spécifiée dans le fuseau horaire donné (ex: 'Europe/Paris').
 */
export function createTZDate(dateStr: string, hour: number = 0, minute: number = 0, timezone: string = 'Europe/Paris'): Date {
  const cleanDate = dateStr.split('T')[0];
  const pad = (n: number) => String(n).padStart(2, '0');
  const targetIso = `${cleanDate}T${pad(hour)}:${pad(minute)}:00`;

  try {
    const dummyUtc = new Date(`${targetIso}Z`);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(dummyUtc);
    const obj: Record<string, string> = {};
    parts.forEach(p => { if (p.type !== 'literal') obj[p.type] = p.value; });

    const formattedHour = obj.hour === '24' ? '00' : obj.hour;
    const tzAsUtc = new Date(`${obj.year}-${obj.month}-${obj.day}T${formattedHour}:${obj.minute}:${obj.second}Z`).getTime();
    const diffMs = tzAsUtc - dummyUtc.getTime();

    return new Date(dummyUtc.getTime() - diffMs);
  } catch (e) {
    return new Date(`${cleanDate}T${pad(hour)}:${pad(minute)}:00`);
  }
}

export function getCurrentMinuteInTimezone(date: Date, timezone: string = 'Europe/Paris'): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(date);
    const obj: Record<string, string> = {};
    parts.forEach(p => { if (p.type !== 'literal') obj[p.type] = p.value; });
    const h = obj.hour === '24' ? 0 : parseInt(obj.hour || '0', 10);
    const m = parseInt(obj.minute || '0', 10);
    return h * 60 + m;
  } catch {
    return date.getHours() * 60 + date.getMinutes();
  }
}

function parseYMD(dateStr: string): Date | null {
  if (!dateStr) return null;
  const clean = dateStr.split('T')[0];
  const parts = clean.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function addDaysToYMD(baseDate: Date, offsetDays: number): string {
  const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function diffCalendarDays(fromDate: Date, toDate: Date): number {
  const a = Date.UTC(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  const b = Date.UTC(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
  return Math.round((b - a) / 86400000);
}

/**
 * Calcule la capacité réelle d'heures de révision disponibles sur une journée donnée,
 * en déduisant les créneaux bloqués par les événements externes (cours, Google Calendar, iCal)
 * avec leurs buffers avant/après, plafonnée à MAX_STUDY_HOURS_PER_DAY.
 */
export function computeAvailableStudyHoursForDay(
  dateStr: string,
  dayEvents: ExternalEvent[],
  settings: UserSettings = DEFAULT_USER_SETTINGS,
  minStartMinuteOverride?: number
): number {
  const userTimezone = settings.timezone || 'Europe/Paris';
  const dayStartHour = settings.dayStartHour ?? 8;
  const dayEndHour = settings.dayEndHour ?? 23;
  const slotDurationMinutes = settings.slotDurationMinutes ?? 60;
  const bufferBefore = settings.bufferMinutesBefore ?? 15;
  const bufferAfter = settings.bufferMinutesAfter ?? 15;

  const effectiveStartMin = Math.max(dayStartHour * 60, minStartMinuteOverride ?? 0);
  const dayEndMin = dayEndHour * 60;
  if (effectiveStartMin + slotDurationMinutes > dayEndMin) return 0;

  // Chemin rapide : aucun événement externe ce jour-là
  if (!dayEvents || dayEvents.length === 0) {
    const spanMin = dayEndMin - effectiveStartMin;
    const sessionsFit = 1 + Math.floor((spanMin - slotDurationMinutes) / (slotDurationMinutes + bufferAfter));
    return Math.min(MAX_STUDY_HOURS_PER_DAY, Math.max(0, sessionsFit * (slotDurationMinutes / 60)));
  }

  const windowStartMs = createTZDate(
    dateStr,
    Math.floor(effectiveStartMin / 60),
    effectiveStartMin % 60,
    userTimezone
  ).getTime();
  const windowEndMs = createTZDate(
    dateStr,
    Math.floor(dayEndMin / 60),
    dayEndMin % 60,
    userTimezone
  ).getTime();

  // Fusion des intervalles occupés (avec buffers avant/après)
  const blocked: Array<[number, number]> = [];
  for (const ev of dayEvents) {
    const s = Math.max(windowStartMs, new Date(ev.startTime).getTime() - bufferBefore * 60000);
    const e = Math.min(windowEndMs, new Date(ev.endTime).getTime() + bufferAfter * 60000);
    if (e > s) blocked.push([s, e]);
  }
  blocked.sort((a, b) => a[0] - b[0]);

  const merged: Array<[number, number]> = [];
  for (const interval of blocked) {
    if (merged.length === 0 || interval[0] > merged[merged.length - 1][1]) {
      merged.push(interval);
    } else {
      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], interval[1]);
    }
  }

  // Somme des créneaux libres pouvant accueillir au moins une session
  let totalSessions = 0;
  let cursor = windowStartMs;
  for (const [bStart, bEnd] of merged) {
    const freeMin = (bStart - cursor) / 60000;
    if (freeMin >= slotDurationMinutes) {
      totalSessions += 1 + Math.floor((freeMin - slotDurationMinutes) / (slotDurationMinutes + bufferAfter));
    }
    cursor = Math.max(cursor, bEnd);
  }
  const tailMin = (windowEndMs - cursor) / 60000;
  if (tailMin >= slotDurationMinutes) {
    totalSessions += 1 + Math.floor((tailMin - slotDurationMinutes) / (slotDurationMinutes + bufferAfter));
  }

  return Math.min(MAX_STUDY_HOURS_PER_DAY, totalSessions * (slotDurationMinutes / 60));
}

/**
 * Construit un tableau de sommes préfixes des heures disponibles depuis aujourd'hui
 * jusqu'à maxOffsetDays inclus, en indexant les événements externes par date locale.
 */
function buildCumulativeCapacity(
  todayDate: Date,
  maxOffsetDays: number,
  externalEvents: ExternalEvent[],
  settings: UserSettings,
  todayMinStartMinute?: number
): { prefixHours: number[]; getCapacityBetween: (startOffset: number, endOffset: number) => number } {
  const userTimezone = settings.timezone || 'Europe/Paris';
  const clampedMax = Math.max(0, Math.min(365, maxOffsetDays));

  // Regroupement des événements par date locale pour éviter un scan O(days * events)
  const eventsByDate = new Map<string, ExternalEvent[]>();
  for (const ev of externalEvents || []) {
    if (!ev.startTime || !ev.endTime) continue;
    const startD = new Date(ev.startTime);
    const endD = new Date(ev.endTime);
    if (isNaN(startD.getTime()) || isNaN(endD.getTime())) continue;

    const startKey = getLocalDateString(startD, userTimezone);
    const endKey = getLocalDateString(endD, userTimezone);
    if (!eventsByDate.has(startKey)) eventsByDate.set(startKey, []);
    eventsByDate.get(startKey)!.push(ev);

    if (endKey !== startKey) {
      if (!eventsByDate.has(endKey)) eventsByDate.set(endKey, []);
      eventsByDate.get(endKey)!.push(ev);
    }
  }

  const prefixHours: number[] = new Array(clampedMax + 2).fill(0);
  for (let offset = 0; offset <= clampedMax; offset++) {
    const dateStr = addDaysToYMD(todayDate, offset);
    const dayEvs = eventsByDate.get(dateStr) || [];
    const dayCap = computeAvailableStudyHoursForDay(
      dateStr,
      dayEvs,
      settings,
      offset === 0 ? todayMinStartMinute : undefined
    );
    prefixHours[offset + 1] = prefixHours[offset] + dayCap;
  }

  const defaultDayCap = computeAvailableStudyHoursForDay('2099-01-01', [], settings);

  const getCapacityBetween = (startOffset: number, endOffset: number): number => {
    if (endOffset < startOffset) return 0;
    const s = Math.max(0, startOffset);
    const e = Math.max(s, endOffset);
    if (e <= clampedMax) {
      return prefixHours[e + 1] - prefixHours[s];
    }
    const inRangePart = s <= clampedMax ? (prefixHours[clampedMax + 1] - prefixHours[s]) : 0;
    const extraDays = e - Math.max(clampedMax, s - 1);
    return inRangePart + Math.max(0, extraDays) * defaultDayCap;
  };

  return { prefixHours, getCapacityBetween };
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
 * Calcul du Chemin Critique (CPM - Critical Path Method) basé sur la marge temporelle réelle,
 * les dépendances inter/intra-projets, la capacité libre effective (hors cours/événements externes)
 * et la saturation multi-projets sur ressource unique.
 *
 * Un jalon est marqué critique s'il est incomplet et :
 *  1. En retard par rapport à sa date limite, OU
 *  2. Sa marge CPM effective (LS - ES, avec tampon de 15% avant deadline) est <= 1 journée de travail
 *     ou son taux de charge sur sa fenêtre disponible atteint >= 75%, OU
 *  3. (Sans deadline dans la composante) Il fait partie du chemin le plus long d'une véritable chaîne de dépendances (>= 2 jalons), OU
 *  4. La somme des heures restantes de tous les jalons dus au plus tard à son échéance laisse <= 1 jour de marge globale.
 *
 * Les jalons terminés et les tâches isolées confortables ne sont jamais marqués critiques.
 */
export function computeCriticalPath(
  projects: Project[],
  calibration: CalibrationLoop = DEFAULT_CALIBRATION,
  externalEvents: ExternalEvent[] = [],
  settings: UserSettings = DEFAULT_USER_SETTINGS
): Record<string, boolean> {
  const criticalMap: Record<string, boolean> = {};
  if (!projects || projects.length === 0) return criticalMap;

  const { cycleNodes } = detectCycles(projects);
  const userTimezone = settings.timezone || 'Europe/Paris';
  const now = new Date();
  const todayStr = getLocalDateString(now, userTimezone);
  const todayDate = parseYMD(todayStr) || new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayStartMin = Math.ceil(getCurrentMinuteInTimezone(now, userTimezone) / 15) * 15;

  interface ActiveNode {
    milestone: Milestone;
    project: Project;
    duration: number;
    startDateStr: string;
    dueDateStr: string;
    isHardDeadline: boolean;
    dueOffset: number | null;
    startOffset: number;
  }

  const nodes = new Map<string, ActiveNode>();
  let maxHorizonOffset = 30;

  projects.forEach(project => {
    (project.milestones || []).forEach(m => {
      criticalMap[m.id] = false;
      if (m.isCompleted || cycleNodes.has(m.id)) return;

      const rawRemaining = Math.max(0, (m.estimatedHours || 10) - (m.completedHours || 0));
      if (rawRemaining <= 0) return;

      const calFactor = m.cognitiveLoad === 'high'
        ? calibration.highFactor
        : (m.cognitiveLoad === 'medium' ? calibration.mediumFactor : calibration.lowFactor);
      const duration = Math.max(0.5, Math.round(rawRemaining * calFactor * 10) / 10);

      const startDateStr = (m.startDate || project.startDate || '').split('T')[0];
      const dueDateStr = (m.dueDate || project.deadline || '').split('T')[0];

      let dueOffset: number | null = null;
      if (dueDateStr) {
        const dueD = parseYMD(dueDateStr);
        if (dueD) {
          dueOffset = diffCalendarDays(todayDate, dueD);
          if (dueOffset > maxHorizonOffset) maxHorizonOffset = Math.min(365, dueOffset);
        }
      }

      let startOffset = 0;
      if (startDateStr) {
        const startD = parseYMD(startDateStr);
        if (startD) {
          startOffset = Math.max(0, diffCalendarDays(todayDate, startD));
          if (startOffset > maxHorizonOffset) maxHorizonOffset = Math.min(365, startOffset);
        }
      }

      nodes.set(m.id, {
        milestone: m,
        project,
        duration,
        startDateStr,
        dueDateStr,
        isHardDeadline: Boolean(m.isHardDeadline || project.isHardDeadline),
        dueOffset,
        startOffset
      });
    });
  });

  if (nodes.size === 0) return criticalMap;

  const { getCapacityBetween } = buildCumulativeCapacity(
    todayDate,
    maxHorizonOffset,
    externalEvents,
    settings,
    todayStartMin
  );

  // Prédécesseurs & successeurs parmi les jalons actifs
  const predecessors = new Map<string, string[]>();
  const successors = new Map<string, string[]>();

  nodes.forEach((node, mId) => {
    predecessors.set(mId, (node.milestone.dependsOn || []).filter(pId => nodes.has(pId)));
    successors.set(mId, []);
  });
  nodes.forEach((_, mId) => {
    (predecessors.get(mId) || []).forEach(pId => {
      successors.get(pId)!.push(mId);
    });
  });

  // Détection des composantes connexes (Union-Find) + taille de chaque composante
  const parent = new Map<string, string>();
  nodes.forEach((_, mId) => parent.set(mId, mId));

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

  nodes.forEach((_, mId) => {
    (predecessors.get(mId) || []).forEach(pId => union(mId, pId));
  });

  const componentSize = new Map<string, number>();
  nodes.forEach((_, mId) => {
    const root = find(mId);
    componentSize.set(root, (componentSize.get(root) || 0) + 1);
  });

  // PASSE AVANT (Forward Pass en heures de capacité cumulée depuis aujourd'hui)
  const ES = new Map<string, number>();
  const EF = new Map<string, number>();

  const calcForward = (mId: string, visited = new Set<string>()): number => {
    if (EF.has(mId)) return EF.get(mId)!;
    const node = nodes.get(mId)!;
    if (visited.has(mId)) return node.duration;
    visited.add(mId);

    const minStartCap = node.startOffset > 0 ? getCapacityBetween(0, node.startOffset - 1) : 0;
    let maxEarliestStart = minStartCap;
    (predecessors.get(mId) || []).forEach(pId => {
      maxEarliestStart = Math.max(maxEarliestStart, calcForward(pId, new Set(visited)));
    });

    const es = maxEarliestStart;
    const ef = es + node.duration;
    ES.set(mId, es);
    EF.set(mId, ef);
    return ef;
  };

  nodes.forEach((_, mId) => calcForward(mId));

  // PASSE ARRIÈRE (Backward Pass) contrainte par les vraies deadlines (avec marge de sécurité 15%)
  const LS = new Map<string, number>();
  const LF = new Map<string, number>();
  const effectiveDueOffsetMap = new Map<string, number>();

  const getOwnDeadlineCap = (node: ActiveNode): number | null => {
    if (node.dueOffset === null) return null;
    if (node.dueOffset < 0) return 0; // Déjà en retard
    return getCapacityBetween(0, node.dueOffset) * 0.85;
  };

  const calcEffectiveDueOffset = (mId: string, visited = new Set<string>()): number | null => {
    if (effectiveDueOffsetMap.has(mId)) return effectiveDueOffsetMap.get(mId)!;
    if (visited.has(mId)) return null;
    visited.add(mId);

    const node = nodes.get(mId)!;
    let minDue = node.dueOffset !== null ? node.dueOffset : Infinity;
    (successors.get(mId) || []).forEach(sId => {
      const sDue = calcEffectiveDueOffset(sId, new Set(visited));
      if (sDue !== null && sDue < minDue) minDue = sDue;
    });

    if (minDue < Infinity) {
      effectiveDueOffsetMap.set(mId, minDue);
      return minDue;
    }
    return null;
  };

  nodes.forEach((_, mId) => calcEffectiveDueOffset(mId));

  // Horizon local pour les composantes sans aucune deadline
  const componentMaxFinish = new Map<string, number>();
  const componentHasDeadline = new Map<string, boolean>();
  nodes.forEach((node, mId) => {
    const root = find(mId);
    const ef = EF.get(mId) || 0;
    componentMaxFinish.set(root, Math.max(componentMaxFinish.get(root) || 0, ef));
    if (node.dueOffset !== null) componentHasDeadline.set(root, true);
  });

  const calcBackward = (mId: string, visited = new Set<string>()): number => {
    if (LS.has(mId)) return LS.get(mId)!;
    const node = nodes.get(mId)!;
    const ownCap = getOwnDeadlineCap(node);
    const root = find(mId);
    const fallbackMax = componentHasDeadline.get(root) ? Infinity : (componentMaxFinish.get(root) || node.duration);

    if (visited.has(mId)) return ownCap !== null ? ownCap - node.duration : fallbackMax - node.duration;
    visited.add(mId);

    let minLatestFinish = ownCap !== null ? ownCap : Infinity;
    (successors.get(mId) || []).forEach(sId => {
      minLatestFinish = Math.min(minLatestFinish, calcBackward(sId, new Set(visited)));
    });

    if (minLatestFinish === Infinity) {
      minLatestFinish = fallbackMax;
    }

    const lf = minLatestFinish;
    const ls = lf - node.duration;
    LF.set(mId, lf);
    LS.set(mId, ls);
    return ls;
  };

  nodes.forEach((_, mId) => calcBackward(mId));

  // ÉVALUATION CRITIQUE INDIVIDUELLE / CHAÎNE
  const criticalSlackThreshold = MAX_STUDY_HOURS_PER_DAY; // <= 1 journée de révision de marge effective

  nodes.forEach((node, mId) => {
    // 1. Retard avéré
    if (node.dueOffset !== null && node.dueOffset < 0) {
      criticalMap[mId] = true;
      return;
    }

    const es = ES.get(mId) || 0;
    const ls = LS.get(mId);
    const lf = LF.get(mId);
    const root = find(mId);
    const compSize = componentSize.get(root) || 1;
    const hasEffectiveDeadline = effectiveDueOffsetMap.has(mId);

    if (hasEffectiveDeadline && ls !== undefined && lf !== undefined && lf < Infinity) {
      const slack = ls - es;
      const effDueOffset = effectiveDueOffsetMap.get(mId)!;
      const effDeadlineCap = effDueOffset < 0 ? 0 : getCapacityBetween(0, effDueOffset) * 0.85;
      // Ratio de charge de la CHAÎNE entière passant par ce jalon (invariant si un jalon est découpé en sous-jalons)
      const chainLoadRatio = effDeadlineCap > 0 ? (1 - slack / effDeadlineCap) : 1;
      // Critique si marge effective <= 1 jour de révision OU si la chaîne consomme >= 70% de la fenêtre disponible
      if (slack <= criticalSlackThreshold || chainLoadRatio >= 0.70) {
        criticalMap[mId] = true;
      }
    } else if (!hasEffectiveDeadline && compSize >= 2 && ls !== undefined) {
      // Chaîne de dépendances sans deadline : CPM classique (mais jamais les tâches isolées de taille 1)
      if (ls - es <= 0.01) {
        criticalMap[mId] = true;
      }
    }
  });

  // PASSE MULTI-PROJETS (saturation globale de la ressource unique à une échéance)
  const uniqueDueOffsets = Array.from(
    new Set(
      Array.from(effectiveDueOffsetMap.values()).filter(offset => offset >= 0)
    )
  ).sort((a, b) => a - b);

  for (const bucketDueOffset of uniqueDueOffsets) {
    let cumDemand = 0;
    const bucketNodeIds: string[] = [];

    nodes.forEach((node, mId) => {
      const effDue = effectiveDueOffsetMap.get(mId);
      if (effDue !== undefined && effDue <= bucketDueOffset) {
        cumDemand += node.duration;
        bucketNodeIds.push(mId);
      }
    });

    const cumCapacity = getCapacityBetween(0, bucketDueOffset);
    const globalSlack = cumCapacity - cumDemand;

    // Si la ressource unique (l'étudiant) a <= 1 jour de marge globale jusqu'à cette échéance
    if (bucketNodeIds.length > 0 && (globalSlack <= criticalSlackThreshold || (cumCapacity > 0 && cumDemand / cumCapacity >= 0.85))) {
      for (const mId of bucketNodeIds) {
        const node = nodes.get(mId)!;
        if (node.isHardDeadline || globalSlack <= 0 || (cumCapacity > 0 && cumDemand / cumCapacity >= 0.95)) {
          criticalMap[mId] = true;
        }
      }
    }
  }

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

/**
 * Nettoie le titre d'un événement externe en supprimant les préfixes polluants
 * tels que [Google · ...], [Agenda ...], [https://...], etc., afin de mettre
 * en valeur l'intitulé réel du cours ou du créneau.
 */
export function cleanEventTitle(rawTitle?: string, knownFeedNames: string[] = []): string {
  if (!rawTitle) return 'Occupé';
  let title = rawTitle.trim();

  // 1. Nettoyage des noms de flux personnalisés passés en paramètre
  for (const fn of knownFeedNames) {
    if (fn && fn.trim()) {
      const trimmed = fn.trim();
      if (title.toLowerCase().startsWith(`[${trimmed.toLowerCase()}]`)) {
        title = title.substring(trimmed.length + 2).trim();
      }
    }
  }

  // 2. Nettoyage récursif des préfixes entre crochets (Google, Agenda, URLs, emails, etc.)
  const prefixRegex = /^\[(Google[\s\S]*?|Agenda[\s\S]*?|Flux[\s\S]*?|https?:\/\/[\s\S]*?|Calendrier[\s\S]*?|.*@.*)\]\s*/i;
  while (prefixRegex.test(title)) {
    title = title.replace(prefixRegex, '').trim();
  }

  // 3. Si le titre résiduel est vide ou n'est qu'une URL
  if (!title || /^https?:\/\//i.test(title)) {
    return 'Occupé';
  }

  return title.replace(/\s+/g, ' ');
}

/**
 * Déduplique les événements externes survenus sur le même créneau horaire
 * (par ex. le même cours importé à la fois via le flux iCal école et via Google Calendar).
 */
export function deduplicateExternalEvents(events: ExternalEvent[], knownFeedNames: string[] = []): ExternalEvent[] {
  const result: ExternalEvent[] = [];

  for (const ev of events) {
    const cleanTitle = cleanEventTitle(ev.title, knownFeedNames);
    const startMs = new Date(ev.startTime).getTime();
    const endMs = new Date(ev.endTime).getTime();

    const existingIdx = result.findIndex(other => {
      const oStartMs = new Date(other.startTime).getTime();
      const oEndMs = new Date(other.endTime).getTime();
      // Même créneau horaire (tolérance 5 minutes)
      const sameTime = Math.abs(startMs - oStartMs) <= 300000 && Math.abs(endMs - oEndMs) <= 300000;
      if (!sameTime) return false;

      const oClean = other.title;
      const t1 = cleanTitle.toLowerCase();
      const t2 = oClean.toLowerCase();

      // Doublon si même titre, ou si l'un est générique ("Occupé"), ou si l'un contient l'autre
      return t1 === t2 || t1 === 'occupé' || t2 === 'occupé' || t1.includes(t2) || t2.includes(t1);
    });

    if (existingIdx === -1) {
      result.push({
        ...ev,
        title: cleanTitle
      });
    } else {
      const existing = result[existingIdx];
      // Si l'existant était simplement "Occupé" ou plus court, remplacer par le titre plus précis
      if (existing.title === 'Occupé' && cleanTitle !== 'Occupé') {
        result[existingIdx] = {
          ...ev,
          title: cleanTitle
        };
      } else if (cleanTitle !== 'Occupé' && cleanTitle.length > existing.title.length && !existing.title.toLowerCase().includes(cleanTitle.toLowerCase())) {
        result[existingIdx] = {
          ...ev,
          title: cleanTitle
        };
      }
    }
  }

  return result;
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
  const criticalMap = computeCriticalPath(projects, calibration, externalEvents, settings);
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
  const milestoneById = new Map<string, FlatMilestone>();
  projects.forEach(proj => {
    proj.milestones.forEach(ms => {
      if (!ms.isCompleted) {
        const actualDone = Math.max(ms.completedHours || 0, milestoneCompletedHours[ms.id] || 0);

        const calFactor = ms.cognitiveLoad === 'high' ? calibration.highFactor : (ms.cognitiveLoad === 'medium' ? calibration.mediumFactor : calibration.lowFactor);
        const calibratedEstimate = Math.max(0.5, Math.round((ms.estimatedHours || 10) * calFactor * 10) / 10);

        const flat: FlatMilestone = {
          project: proj,
          milestone: ms,
          id: ms.id,
          title: ms.title,
          color: proj.color,
          startDate: ms.startDate || proj.startDate || '',
          dueDate: ms.dueDate || proj.deadline || '',
          isHardDeadline: Boolean(ms.isHardDeadline || proj.isHardDeadline),
          isCriticalPath: !!criticalMap[ms.id],
          cognitiveLoad: ms.cognitiveLoad || 'medium',
          estimatedHours: calibratedEstimate,
          completedHours: actualDone,
          dependsOn: ms.dependsOn || []
        };
        allMilestones.push(flat);
        milestoneById.set(ms.id, flat);
      }
    });
  });

  if (allMilestones.length === 0) return scheduleData;

  const projectedHours: Record<string, number> = {};
  allMilestones.forEach(m => { projectedHours[m.id] = 0; });

  const dayStartHour = settings.dayStartHour ?? 8;
  const dayEndHour = settings.dayEndHour ?? 23;
  const slotDurationMinutes = settings.slotDurationMinutes ?? 60;
  const slotHours = slotDurationMinutes / 60;
  const maxSessionsPerDay = Math.floor(MAX_STUDY_HOURS_PER_DAY / slotHours);

  const now = new Date();
  const todayStr = getLocalDateString(now, userTimezone);
  const nextMinuteToday = Math.ceil(getCurrentMinuteInTimezone(now, userTimezone) / 15) * 15;

  const pad2 = (n: number) => String(n).padStart(2, '0');
  const formatMinutes = (totalMin: number) => `${pad2(Math.floor(totalMin / 60) % 24)}:${pad2(totalMin % 60)}`;

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

    // Conserver les séances déjà complétées pour ce jour
    const existingCompletedSessions = (existingSchedule[dateStr] || []).filter(s => s.isCompleted);
    scheduleData[dateStr] = [...existingCompletedSessions];

    const completedIntervals = existingCompletedSessions
      .filter(s => s.startTime && s.endTime)
      .map(s => ({
        startMs: new Date(s.startTime!).getTime(),
        endMs: new Date(s.endTime!).getTime()
      }));

    let sessionsCreatedToday = existingCompletedSessions.length;

    // Suivi journalier pour l'entrelacement (interleaving) et le plafond souple par jalon
    const dailyHoursPerMilestone: Record<string, number> = {};
    const dailyHoursPerProject: Record<string, number> = {};
    let lastScheduledMilestoneId: string | null = null;
    let lastScheduledProjectId: string | null = null;

    existingCompletedSessions.forEach(s => {
      const h = s.durationMinutes ? s.durationMinutes / 60 : slotHours;
      if (s.milestoneId) {
        dailyHoursPerMilestone[s.milestoneId] = (dailyHoursPerMilestone[s.milestoneId] || 0) + h;
        lastScheduledMilestoneId = s.milestoneId;
      }
      if (s.projectId) {
        dailyHoursPerProject[s.projectId] = (dailyHoursPerProject[s.projectId] || 0) + h;
        lastScheduledProjectId = s.projectId;
      }
    });

    const dayStartMs = createTZDate(dateStr, 0, 0, userTimezone).getTime();
    const dayEndMs = createTZDate(dateStr, 23, 59, userTimezone).getTime();
    const dayEvents = externalEvents.filter(ev => {
      const evStart = new Date(ev.startTime).getTime();
      const evEnd = new Date(ev.endTime).getTime();
      return evStart < dayEndMs && evEnd > dayStartMs;
    });

    const dayStartMinute = dayStartHour * 60;
    const dayEndMinute = dayEndHour * 60;
    const bufferAfter = settings.bufferMinutesAfter ?? 15;

    // Ne jamais planifier dans le passé le jour même
    let currentSlotStartMinute = dateStr === todayStr
      ? Math.max(dayStartMinute, nextMinuteToday)
      : dayStartMinute;

    while (currentSlotStartMinute + slotDurationMinutes <= dayEndMinute) {
      if (sessionsCreatedToday >= maxSessionsPerDay) break;

      const startH = Math.floor(currentSlotStartMinute / 60);
      const startM = currentSlotStartMinute % 60;
      const slotStart = createTZDate(dateStr, startH, startM, userTimezone);
      const slotEnd = new Date(slotStart.getTime() + slotDurationMinutes * 60 * 1000);

      const overlapsCompleted = completedIntervals.some(
        ci => slotStart.getTime() < ci.endMs && slotEnd.getTime() > ci.startMs
      );
      if (
        overlapsCompleted ||
        isSlotBlockedByExternalEvent(slotStart, slotEnd, dayEvents, settings.bufferMinutesBefore, settings.bufferMinutesAfter)
      ) {
        currentSlotStartMinute += 30;
        continue;
      }

      const slotIdx = startH < 12 ? 0 : (startH < 18 ? 1 : 2);
      const targetCog: CognitiveLoad = slotIdx === 0 ? 'high' : (slotIdx === 1 ? 'medium' : 'low');

      const candidates = allMilestones.filter(m => {
        const msStartStr = m.startDate ? m.startDate.split('T')[0] : '';
        const msDueStr = m.dueDate ? m.dueDate.split('T')[0] : '';

        if (msStartStr && dateStr < msStartStr) return false;
        if (msDueStr && dateStr > msDueStr) return false;
        if (slotIdx === 2 && m.cognitiveLoad === 'high') return false;

        const remaining = m.estimatedHours - m.completedHours - projectedHours[m.id];
        if (remaining <= 0) return false;

        // Fast-Tracking WBS (seuil 75%) : inclut les heures déjà complétées ET celles projetées plus tôt dans la semaine
        if (m.dependsOn && m.dependsOn.length > 0) {
          const allPrereqsDone = m.dependsOn.every(prereqId => {
            if (completedMilestoneIds.has(prereqId)) return true;
            const prereqTarget = milestoneById.get(prereqId);
            const doneHours = Math.max(prereqTarget?.completedHours || 0, milestoneCompletedHours[prereqId] || 0)
              + (projectedHours[prereqId] || 0);
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

      const hasMultipleCandidates = candidates.length > 1;
      const currD = parseYMD(dateStr) || new Date(d.getFullYear(), d.getMonth(), d.getDate());

      const scored = candidates.map(m => {
        let daysToDeadline = 60;
        if (m.dueDate) {
          const targetD = parseYMD(m.dueDate);
          if (targetD) {
            daysToDeadline = Math.max(1, diffCalendarDays(currD, targetD) + 1);
          }
        }

        const bufferedDaysToDeadline = Math.max(1, Math.floor(daysToDeadline * 0.85));
        const remainingHours = Math.max(0, m.estimatedHours - m.completedHours - projectedHours[m.id]);
        if (remainingHours <= 0) return { milestone: m, score: -999 };

        // 1. Pression horaire réelle (volume restant / jours disponibles), modulée par la fermeté de la deadline
        const requiredHoursPerDay = remainingHours / bufferedDaysToDeadline;
        const basePressure = Math.min(6.0, requiredHoursPerDay * 1.5);
        const workloadScore = basePressure * (m.isHardDeadline ? 1.35 : 1.0);

        // 2. Proximité d'échéance lissée (sans double comptage excessif)
        let urgencyBonus = 0;
        if (daysToDeadline <= 1) urgencyBonus = 5.0;
        else if (daysToDeadline <= 3) urgencyBonus = 3.0;
        else if (daysToDeadline <= 7) urgencyBonus = 1.5;

        // 3. Adéquation chronobiologique (charge cognitive vs moment de la journée)
        let cogMatchBonus = 0;
        if (m.cognitiveLoad === targetCog) cogMatchBonus = 2.0;
        else if (slotIdx === 0 && m.cognitiveLoad === 'medium') cogMatchBonus = 0.5;
        else if (slotIdx === 1 && m.cognitiveLoad === 'high') cogMatchBonus = 0.3;

        // 4. Bonus Chemin Critique (désormais sélectif)
        const criticalBonus = m.isCriticalPath ? 3.0 : 0;

        // 5. Diversité & Entrelacement (évite les blocs monolithiques de 4-6h sur le même jalon)
        const hoursTodayOnMs = dailyHoursPerMilestone[m.id] || 0;
        const hoursTodayOnProj = dailyHoursPerProject[m.project.id] || 0;
        const isExtremeUrgency = daysToDeadline <= 1 || requiredHoursPerDay >= MAX_STUDY_HOURS_PER_DAY;
        let interleavingPenalty = 0;

        if (hasMultipleCandidates && !isExtremeUrgency) {
          if (hoursTodayOnMs >= 2) {
            interleavingPenalty += 6.0 + (hoursTodayOnMs - 2) * 2.0;
          } else if (m.id === lastScheduledMilestoneId && hoursTodayOnMs >= 1) {
            interleavingPenalty += 1.25;
          }

          if (m.project.id === lastScheduledProjectId && hoursTodayOnProj >= 2) {
            interleavingPenalty += 1.5;
          } else if (m.project.id === lastScheduledProjectId) {
            interleavingPenalty += 0.6;
          }
        }

        const score = workloadScore + urgencyBonus + cogMatchBonus + criticalBonus - interleavingPenalty;
        return { milestone: m, score };
      });

      scored.sort((a, b) => b.score - a.score);
      const best = scored[0];
      if (best && best.score > -900) {
        projectedHours[best.milestone.id] += slotHours;
        dailyHoursPerMilestone[best.milestone.id] = (dailyHoursPerMilestone[best.milestone.id] || 0) + slotHours;
        dailyHoursPerProject[best.milestone.project.id] = (dailyHoursPerProject[best.milestone.project.id] || 0) + slotHours;
        lastScheduledMilestoneId = best.milestone.id;
        lastScheduledProjectId = best.milestone.project.id;

        const endMinute = currentSlotStartMinute + slotDurationMinutes;

        scheduleData[dateStr].push({
          id: 'sess_' + Math.random().toString(36).substr(2, 9),
          projectId: best.milestone.project.id,
          milestoneId: best.milestone.id,
          subjectId: best.milestone.project.id,
          note: `${formatMinutes(currentSlotStartMinute)}–${formatMinutes(endMinute)} · [${best.milestone.project.code}] ${best.milestone.title}`,
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
  const userTimezone = settings.timezone || 'Europe/Paris';
  const weekDateSet = new Set<string>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + i);
    weekDateSet.add(getLocalDateString(d, userTimezone));
  }

  const preservedSchedule: ScheduleData = {};
  const bufferBefore = settings.bufferMinutesBefore ?? 15;
  const bufferAfter = settings.bufferMinutesAfter ?? 15;

  Object.entries(existingSchedule).forEach(([dateStr, sessions]) => {
    if (weekDateSet.has(dateStr)) {
      // Sur la semaine en cours de régénération, on ne garde que les séances complétées
      preservedSchedule[dateStr] = sessions.filter(s => s.isCompleted);
    } else {
      // Sur les autres semaines, on préserve les séances déjà planifiées sauf celles en conflit direct avec un événement externe
      preservedSchedule[dateStr] = sessions.filter(s => {
        if (s.isCompleted || !s.startTime || !s.endTime) return true;
        return !isSlotBlockedByExternalEvent(
          new Date(s.startTime),
          new Date(s.endTime),
          externalEvents,
          bufferBefore,
          bufferAfter
        );
      });
    }
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
  cycleMilestones: { id: string; title: string }[];
  summaryMessage: string;
}

export function evaluatePlanningConflicts(
  projects: Project[],
  existingSchedule: ScheduleData = {},
  settings: UserSettings = DEFAULT_USER_SETTINGS,
  externalEvents: ExternalEvent[] = []
): PlanningConflictReport {
  let totalRequiredHours = 0;
  let totalPlannedNotCompletedHours = 0;
  let maxHorizonDays = 1;
  const overloadedProjects: PlanningConflictReport['overloadedProjects'] = [];
  const impasseMilestones: PlanningConflictReport['impasseMilestones'] = [];

  const userTimezone = settings.timezone || 'Europe/Paris';
  const now = new Date();
  const todayStr = getLocalDateString(now, userTimezone);
  const today = parseYMD(todayStr) || new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayStartMin = Math.ceil(getCurrentMinuteInTimezone(now, userTimezone) / 15) * 15;

  // Détection des cycles WBS
  const { hasCycle, cycleNodes } = detectCycles(projects);
  const cycleMilestones: PlanningConflictReport['cycleMilestones'] = [];
  if (hasCycle) {
    projects.forEach(p => {
      p.milestones.forEach(m => {
        if (cycleNodes.has(m.id)) {
          cycleMilestones.push({ id: m.id, title: m.title });
        }
      });
    });
  }

  // Heures déjà planifiées mais non complétées : gardées à titre INFORMATIF seulement.
  Object.values(existingSchedule || {}).forEach(sessions => {
    (sessions || []).forEach(s => {
      if (!s.isCompleted && s.milestoneId) {
        const hours = s.durationMinutes ? (s.durationMinutes / 60) : 1.0;
        totalPlannedNotCompletedHours += hours;
      }
    });
  });

  // Déterminer l'horizon maximal pour pré-calculer la capacité libre réelle (hors cours/événements externes)
  projects.forEach(p => {
    if (p.deadline) {
      const target = parseYMD(p.deadline);
      if (target) {
        const offset = Math.max(0, diffCalendarDays(today, target));
        maxHorizonDays = Math.max(maxHorizonDays, offset + 1);
      }
    } else {
      maxHorizonDays = Math.max(maxHorizonDays, 30);
    }
    p.milestones.forEach(m => {
      if (!m.isCompleted && m.dueDate) {
        const msTarget = parseYMD(m.dueDate);
        if (msTarget) {
          const offset = Math.max(0, diffCalendarDays(today, msTarget));
          maxHorizonDays = Math.max(maxHorizonDays, offset + 1);
        }
      }
    });
  });

  const { getCapacityBetween } = buildCumulativeCapacity(
    today,
    Math.min(365, maxHorizonDays),
    externalEvents,
    settings,
    todayStartMin
  );

  projects.forEach(p => {
    let projReqHours = 0;
    let projDaysRemaining = 30;
    let projEndOffset = 29;

    if (p.deadline) {
      const target = parseYMD(p.deadline);
      if (target) {
        const rawOffset = diffCalendarDays(today, target);
        projEndOffset = Math.max(0, rawOffset);
        projDaysRemaining = Math.max(1, rawOffset + 1);
      }
    }

    p.milestones.forEach(m => {
      if (!m.isCompleted) {
        const req = Math.max(0, (m.estimatedHours || 10) - (m.completedHours || 0));
        projReqHours += req;
        totalRequiredHours += req;

        let msEndOffset = projEndOffset;
        let msDaysRemaining = projDaysRemaining;
        if (m.dueDate) {
          const msTarget = parseYMD(m.dueDate);
          if (msTarget) {
            const rawOffset = diffCalendarDays(today, msTarget);
            msEndOffset = Math.max(0, rawOffset);
            msDaysRemaining = Math.max(1, rawOffset + 1);
          }
        }

        const msRealCapacity = getCapacityBetween(0, msEndOffset);
        if (req > msRealCapacity && (msDaysRemaining <= 7 || req > msRealCapacity * 1.15)) {
          impasseMilestones.push({
            id: m.id,
            title: m.title,
            cognitiveLoad: m.cognitiveLoad || 'medium',
            isHardDeadline: Boolean(m.isHardDeadline || p.isHardDeadline)
          });
        }
      }
    });

    const capacity = getCapacityBetween(0, projEndOffset);
    if (projReqHours > capacity) {
      overloadedProjects.push({
        id: p.id,
        name: p.name,
        requiredHours: projReqHours,
        daysRemaining: projDaysRemaining
      });
    }
  });

  const totalAvailableHours = Math.round(getCapacityBetween(0, Math.max(0, maxHorizonDays - 1)) * 10) / 10;

  const hasConflicts = overloadedProjects.length > 0 || impasseMilestones.length > 0 || totalRequiredHours > totalAvailableHours || cycleMilestones.length > 0;
  let summaryMessage = "Planning équilibré et réalisable.";
  if (cycleMilestones.length > 0) {
    summaryMessage = `⚠️ Dépendance circulaire détectée sur ${cycleMilestones.length} jalon(s) [${cycleMilestones.map(c => c.title).join(' ↔ ')}]. Veuillez débloquer les dépendances WBS.`;
  } else if (hasConflicts) {
    summaryMessage = `Surcharge détectée : ${totalRequiredHours.toFixed(1)}h requises pour ~${totalAvailableHours}h de capacité libre réelle sur votre agenda unique.`;
  }

  return {
    hasConflicts,
    totalRequiredHours,
    totalAvailableHours,
    totalPlannedNotCompletedHours,
    overloadedProjects,
    impasseMilestones,
    cycleMilestones,
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

  // 2. Si l'impasse persiste, réajuster les jalons à charge cognitive élevée sans compoundage exponentiel
  conflicts.impasseMilestones.forEach(imp => {
    if (!imp.isHardDeadline) {
      updatedProjects.forEach(p => {
        p.milestones.forEach(m => {
          if (m.id === imp.id) {
            // Conservation de la valeur d'origine immuable
            if (m.initialEstimatedHours === undefined) {
              m.initialEstimatedHours = m.estimatedHours;
            }
            const baseHours = m.initialEstimatedHours || m.estimatedHours || 10;
            m.estimatedHours = Math.max(2, Math.round(baseHours * 0.75));
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

