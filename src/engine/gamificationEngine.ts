import {
  CognitiveLoad,
  DomainSkill,
  MasteryTier,
  BadgeDefinition,
  UnlockedBadge,
  GamificationAggregates,
  GamificationToast,
  Gamification,
  DynamicQuest,
  Milestone,
  Project
} from '../types';

// ==========================================
// 1. CONSTANTES ET SEUILS DE MAÎTRISE
// ==========================================

export const MASTERY_THRESHOLDS = {
  NOVICE_TO_AUTONOMOUS: 20,    // 0 -> 20h: Novice -> Débutant Autonome
  AUTONOMOUS_TO_CONFIRMED: 100, // 20 -> 100h: Débutant Autonome -> Praticien Confirmé
  CONFIRMED_TO_EXPERT: 500,    // 100 -> 500h: Praticien Confirmé -> Expert
  EXPERT_TO_MASTER: 1000       // 500 -> 1000h: Expert -> Maître
};

export const LEVEL_TITLES = [
  { maxLevel: 4, title: '🌱 Apprenti', icon: '🌱' },
  { maxLevel: 9, title: '⚒️ Artisan', icon: '⚒️' },
  { maxLevel: 14, title: '🔷 Praticien', icon: '🔷' },
  { maxLevel: 19, title: '💎 Expert', icon: '💎' },
  { maxLevel: 24, title: '👑 Légende', icon: '👑' },
  { maxLevel: Infinity, title: '🏛️ Architecte Suprême', icon: '🏛️' }
];

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  // Discipline & Rigueur WBS
  {
    id: 'sans_concession_1',
    title: 'Sans Concession',
    description: 'Livrer 1 jalon complexe (diff. 4-5) sans aucun retard',
    icon: '🎯',
    category: 'discipline',
    tier: 'bronze',
    targetValue: 1
  },
  {
    id: 'sans_concession_2',
    title: 'Métronome Sans Concession',
    description: 'Livrer 5 jalons complexes consécutifs à l\'heure',
    icon: '🎯',
    category: 'discipline',
    tier: 'silver',
    targetValue: 5
  },
  {
    id: 'sprint_ombre',
    title: 'Sprint de l\'Ombre',
    description: 'Cumuler 10h de travail concentré à haute charge cognitive dans la même semaine',
    icon: '⚡',
    category: 'discipline',
    tier: 'gold',
    targetValue: 10
  },

  // Résilience & Rattrapage
  {
    id: 'resurrection',
    title: 'Résurrection',
    description: 'Replanifier un projet en retard et rattraper la marge de sécurité',
    icon: '🔥',
    category: 'resilience',
    tier: 'silver',
    targetValue: 1
  },
  {
    id: 'regularite_fer',
    title: 'Régularité de Fer',
    description: 'Maintenir un streak de 7 jours consécutifs de révision',
    icon: '⚔️',
    category: 'discipline',
    tier: 'silver',
    targetValue: 7
  },

  // Volume & Endurance
  {
    id: 'session_10',
    title: 'Bâtisseur',
    description: 'Compléter 10 sessions de révision qualifiées',
    icon: '🧱',
    category: 'volume',
    tier: 'bronze',
    targetValue: 10
  },
  {
    id: 'session_50',
    title: 'Inoxydable',
    description: 'Compléter 50 sessions de révision qualifiées',
    icon: '🛡️',
    category: 'volume',
    tier: 'silver',
    targetValue: 50
  },
  {
    id: 'session_100',
    title: 'Grand Maître du Focus',
    description: 'Compléter 100 sessions de révision qualifiées',
    icon: '👑',
    category: 'volume',
    tier: 'gold',
    targetValue: 100
  },

  // Maîtrise par Domaine
  {
    id: 'praticien_domaine',
    title: 'Praticien Confirmé',
    description: 'Atteindre 100 heures qualifiées dans au moins 1 domaine',
    icon: '🎓',
    category: 'mastery',
    tier: 'silver',
    targetValue: 100
  },
  {
    id: 'expert_domaine',
    title: 'Expert reconnu',
    description: 'Atteindre 500 heures qualifiées dans au moins 1 domaine',
    icon: '📜',
    category: 'mastery',
    tier: 'gold',
    targetValue: 500
  }
];

// ==========================================
// 2. FORMULE PURE DE CALCUL D'XP
// ==========================================

export interface SessionXpInput {
  actualDurationMinutes: number;
  plannedDurationMinutes?: number;
  cognitiveLoad: CognitiveLoad;
  velocityIndex: number;
  isOnTime?: boolean;
}

export function calculateSessionXP(input: SessionXpInput): { xpGained: number; countedMinutes: number } {
  const actual = Math.max(0, isNaN(input.actualDurationMinutes) || !isFinite(input.actualDurationMinutes) ? 0 : input.actualDurationMinutes);
  const planned = Math.max(15, isNaN(input.plannedDurationMinutes || 60) || !isFinite(input.plannedDurationMinutes || 60) ? 60 : (input.plannedDurationMinutes || 60));
  // Cap anti-oubli : max planned + 20%
  const maxAllowedMinutes = Math.round(planned * 1.2);
  const countedMinutes = Math.min(actual, maxAllowedMinutes);

  // Multiplicateur cognitif
  let cognitiveMultiplier = 1.0;
  if (input.cognitiveLoad === 'high') cognitiveMultiplier = 2.5;
  else if (input.cognitiveLoad === 'medium') cognitiveMultiplier = 1.5;

  // Plancher de Vélocité à 0.5 pour ne pas détruire les efforts de rattrapage
  const rawVelocityFactor = (input.velocityIndex || 100) / 100;
  const velocityFactor = Math.max(0.5, Math.min(1.5, rawVelocityFactor));

  // Bonus Ponctualité WBS
  const punctualityFactor = input.isOnTime ? 1.25 : 1.0;

  const xpGained = Math.max(
    10,
    Math.round(countedMinutes * cognitiveMultiplier * velocityFactor * punctualityFactor)
  );

  return { xpGained, countedMinutes };
}

/**
 * Résolution déterministe du domaine cible selon la hiérarchie stricte :
 * 1. Exclure immédiatement tout domaine archivé (`archived: true`).
 * 2. Correspondance exacte sur `domainId` ou nom.
 * 3. Correspondance sur mots-clés de domaines personnalisés (`keywords`).
 * 4. Correspondance sur mots-clés de domaines système.
 * 5. Reconstitution par défaut sur le domaine "logistics" (Organisation & Logistique).
 */
export function resolveTargetDomainKey(
  noteOrTitle: string,
  domains: Record<string, any>,
  explicitDomainId?: string
): string {
  if (!domains) return 'logistics';

  const activeDomains = Object.values(domains).filter((d: any) => !d.archived);
  if (activeDomains.length === 0) return 'logistics';

  if (explicitDomainId && domains[explicitDomainId] && !domains[explicitDomainId].archived) {
    return explicitDomainId;
  }

  const query = (noteOrTitle || '').toLowerCase().trim();
  if (!query) return 'logistics';

  const exactMatch = activeDomains.find((d: any) => d.id.toLowerCase() === query || d.name.toLowerCase() === query);
  if (exactMatch) return exactMatch.id;

  for (const domain of activeDomains.filter((d: any) => !d.isSystem)) {
    if (domain.keywords && Array.isArray(domain.keywords) && domain.keywords.some((k: string) => query.includes(k.toLowerCase()))) {
      return domain.id;
    }
  }

  for (const domain of activeDomains.filter((d: any) => d.isSystem)) {
    if (domain.keywords && Array.isArray(domain.keywords) && domain.keywords.some((k: string) => query.includes(k.toLowerCase()))) {
      return domain.id;
    }
  }

  return activeDomains.find((d: any) => d.id === 'logistics')?.id || activeDomains[0].id;
}

// ==========================================
// 3. ÉVALUATION D'UN DOMAINE (NORMALISATION RADAR CHART)
// ==========================================


export function evaluateDomainMastery(hoursSpent: number): {
  level: number;
  currentTier: MasteryTier;
  tierProgressPct: number;
  hoursRemainingInTier: number;
} {
  const hours = Math.max(0, isNaN(hoursSpent) || !isFinite(hoursSpent) ? 0 : hoursSpent);
  const level = Math.floor(hours / 20) + 1;


  if (hours < MASTERY_THRESHOLDS.NOVICE_TO_AUTONOMOUS) {
    const min = 0;
    const max = MASTERY_THRESHOLDS.NOVICE_TO_AUTONOMOUS;
    const pct = Math.min(100, Math.round(((hours - min) / (max - min)) * 100));
    return {
      level,
      currentTier: 'Novice',
      tierProgressPct: pct,
      hoursRemainingInTier: Math.max(0, max - hours)
    };
  } else if (hours < MASTERY_THRESHOLDS.AUTONOMOUS_TO_CONFIRMED) {
    const min = MASTERY_THRESHOLDS.NOVICE_TO_AUTONOMOUS;
    const max = MASTERY_THRESHOLDS.AUTONOMOUS_TO_CONFIRMED;
    const pct = Math.min(100, Math.round(((hours - min) / (max - min)) * 100));
    return {
      level,
      currentTier: 'Débutant Autonome',
      tierProgressPct: pct,
      hoursRemainingInTier: Math.max(0, max - hours)
    };
  } else if (hours < MASTERY_THRESHOLDS.CONFIRMED_TO_EXPERT) {
    const min = MASTERY_THRESHOLDS.AUTONOMOUS_TO_CONFIRMED;
    const max = MASTERY_THRESHOLDS.CONFIRMED_TO_EXPERT;
    const pct = Math.min(100, Math.round(((hours - min) / (max - min)) * 100));
    return {
      level,
      currentTier: 'Praticien Confirmé',
      tierProgressPct: pct,
      hoursRemainingInTier: Math.max(0, max - hours)
    };
  } else {
    const min = MASTERY_THRESHOLDS.CONFIRMED_TO_EXPERT;
    const max = MASTERY_THRESHOLDS.EXPERT_TO_MASTER;
    const pct = Math.min(100, Math.round(((hours - min) / (max - min)) * 100));
    return {
      level,
      currentTier: hours >= max ? 'Maître' : 'Expert',
      tierProgressPct: pct,
      hoursRemainingInTier: Math.max(0, max - hours)
    };
  }
}

// ==========================================
// 4. CALCUL DE NIVEAU ET TITRE GLOBAUX
// ==========================================

export function calculateLevelAndTitle(totalXp: number): {
  level: number;
  title: string;
  xpInCurrentLevel: number;
  xpToNextLevel: number;
  progressPct: number;
} {
  const XP_PER_LEVEL = 400;
  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
  const xpInCurrentLevel = totalXp % XP_PER_LEVEL;
  const xpToNextLevel = XP_PER_LEVEL - xpInCurrentLevel;
  const progressPct = Math.round((xpInCurrentLevel / XP_PER_LEVEL) * 100);

  const matched = LEVEL_TITLES.find(t => level <= t.maxLevel) || LEVEL_TITLES[LEVEL_TITLES.length - 1];

  return {
    level,
    title: matched.title,
    xpInCurrentLevel,
    xpToNextLevel,
    progressPct
  };
}

// ==========================================
// 5. EXTRACTION DE QUÊTES WBS DÉTERMINISTES
// ==========================================

export function extractDailyQuestsFromWBS(projects: Project[]): DynamicQuest[] {
  const quests: DynamicQuest[] = [];

  projects.forEach(p => {
    p.milestones.forEach(ms => {
      if (!ms.isCompleted && quests.length < 5) {
        let xpReward = 50;
        if (ms.cognitiveLoad === 'high') xpReward = 150;
        else if (ms.cognitiveLoad === 'medium') xpReward = 100;

        quests.push({
          id: `q_wbs_${ms.id}`,
          milestoneId: ms.id,
          projectId: p.id,
          title: ms.title,
          projectCode: p.code,
          dueDate: ms.dueDate || p.deadline,
          targetHours: ms.estimatedHours,
          completedHours: ms.completedHours,
          isCompleted: ms.isCompleted,
          xpReward
        });
      }
    });
  });

  return quests;
}

// ==========================================
// 6. ÉVALUATION OPTIMISÉE O(1) DES BADGES
// ==========================================

export function checkBadgeUnlocks(
  gamification: Gamification,
  newAggregates: GamificationAggregates
): {
  newlyUnlocked: UnlockedBadge[];
  toastsToPush: GamificationToast[];
} {
  const currentUnlocked = new Set((gamification.unlockedBadges || []).map(b => b.badgeId));
  const newlyUnlocked: UnlockedBadge[] = [];
  const toastsToPush: GamificationToast[] = [];

  const nowStr = new Date().toISOString();

  BADGE_DEFINITIONS.forEach(def => {
    if (currentUnlocked.has(def.id)) return;

    let isUnlocked = false;

    if (def.id === 'sans_concession_1' && (newAggregates.consecutivePunctualMilestones || 0) >= 1) {
      isUnlocked = true;
    } else if (def.id === 'sans_concession_2' && (newAggregates.consecutivePunctualMilestones || 0) >= 5) {
      isUnlocked = true;
    } else if (def.id === 'sprint_ombre' && (newAggregates.weeklyHighCognitiveHours || 0) >= 10) {
      isUnlocked = true;
    } else if (def.id === 'resurrection' && (newAggregates.resurrectedProjectsCount || 0) >= 1) {
      isUnlocked = true;
    } else if (def.id === 'regularite_fer' && (gamification.bestStreak || 0) >= 7) {
      isUnlocked = true;
    } else if (def.id === 'session_10' && (gamification.sessionsCompleted || 0) >= 10) {
      isUnlocked = true;
    } else if (def.id === 'session_50' && (gamification.sessionsCompleted || 0) >= 50) {
      isUnlocked = true;
    } else if (def.id === 'session_100' && (gamification.sessionsCompleted || 0) >= 100) {
      isUnlocked = true;
    } else if (def.id === 'praticien_domaine') {
      const maxHours = Math.max(...Object.values(gamification.skills || {}).map(s => s.hoursSpent), 0);
      if (maxHours >= 100) isUnlocked = true;
    } else if (def.id === 'expert_domaine') {
      const maxHours = Math.max(...Object.values(gamification.skills || {}).map(s => s.hoursSpent), 0);
      if (maxHours >= 500) isUnlocked = true;
    }

    if (isUnlocked) {
      const unlockedItem: UnlockedBadge = {
        badgeId: def.id,
        unlockedAt: nowStr,
        tier: def.tier
      };
      newlyUnlocked.push(unlockedItem);

      toastsToPush.push({
        id: `toast_badge_${def.id}_${Date.now()}`,
        type: 'badge',
        title: `Haut Fait Débloqué !`,
        message: `${def.icon} ${def.title}`,
        icon: def.icon,
        subtext: def.description
      });
    }
  });

  return { newlyUnlocked, toastsToPush };
}
