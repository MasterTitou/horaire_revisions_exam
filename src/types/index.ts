export type CognitiveLoad = 'high' | 'medium' | 'low';

export interface Milestone {
  id: string;
  title: string;
  estimatedHours: number;
  initialEstimatedHours?: number; // Volume horaire initial immuable avant arbitrage
  completedHours: number;

  startDate?: string; // Date de début minimale (YYYY-MM-DD)
  dueDate: string;
  cognitiveLoad: CognitiveLoad;
  isHardDeadline: boolean;
  isCompleted: boolean;
  dependsOn?: string[]; // IDs des jalons prérequis obligatoires
  isCriticalPath?: boolean; // Calculé dynamiquement (Slack === 0)
  wasReduced?: boolean; // Indique si la durée estimée a été réajustée lors d'un arbitrage
}


export interface Project {
  id: string;
  name: string;
  code: string;
  color: string;
  startDate?: string; // Date de début du projet (YYYY-MM-DD)
  deadline: string;
  isHardDeadline: boolean;
  milestones: Milestone[];
}


export interface Session {
  id: string;
  projectId: string;
  milestoneId: string;
  subjectId?: string;
  note: string;
  isCompleted: boolean;
  startTime?: string; // ISO string TIMESTAMPTZ (e.g. 2026-07-30T08:00:00.000Z)
  endTime?: string;   // ISO string TIMESTAMPTZ (e.g. 2026-07-30T09:00:00.000Z)
  durationMinutes?: number;
}

export interface ExternalEvent {
  id: string;
  integrationId?: string;
  title: string;
  startTime: string; // ISO string TIMESTAMPTZ
  endTime: string;   // ISO string TIMESTAMPTZ
  isAllDay?: boolean;
  source: 'google' | 'ical' | 'manual';
}

export interface ICalFeed {
  id: string;
  name: string;
  url: string;
  eventCount: number;
  addedAt: string;
}

export interface UserSettings {
  timezone: string; // e.g. 'Europe/Paris'
  bufferMinutesBefore: number; // Default 15
  bufferMinutesAfter: number;  // Default 15
  dayStartHour: number;        // Default 8 (08:00)
  dayEndHour: number;          // Default 23 (23:00)
  slotDurationMinutes: number; // Default 60
  icalFeeds?: ICalFeed[];
  googleConnected?: boolean;
  googleAccessToken?: string;
  googleClientId?: string;
}


export interface CalendarIntegration {
  id: string;
  provider: 'google' | 'ical';
  calendarId?: string;
  icalUrl?: string;
  lastSyncedAt?: string;
  webhookExpiration?: string;
}


export type ScheduleData = Record<string, Session[]>;

export interface Streak {
  count: number;
  lastDate: string;
}

export type MasteryTier = 'Novice' | 'Débutant Autonome' | 'Praticien Confirmé' | 'Expert' | 'Maître';
export type DomainCategory = 'STEM' | 'Humanities' | 'Arts' | 'Physical' | 'Craft' | 'Custom';

export interface StudyDomain {
  id: string;
  name: string;
  category: DomainCategory;
  color: string;
  icon: string;
  isSystem: boolean;
  archived: boolean;
  hoursSpent: number;
  level: number;
  currentTier: MasteryTier;
  tierProgressPct: number; // 0 à 100% normalisé pour le Radar Chart
  hoursRemainingInTier: number;
  xpMultiplier?: number;
  keywords?: string[];
}

export type DomainSkill = StudyDomain;


export interface DynamicQuest {
  id: string;
  milestoneId: string;
  projectId: string;
  title: string;
  projectCode: string;
  dueDate: string;
  targetHours: number;
  completedHours: number;
  isCompleted: boolean;
  xpReward: number;
}

export type BadgeCategory = 'discipline' | 'volume' | 'mastery' | 'resilience';
export type BadgeTier = 'bronze' | 'silver' | 'gold';

export interface BadgeDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: BadgeCategory;
  tier: BadgeTier;
  targetValue: number;
}

export interface UnlockedBadge {
  badgeId: string;
  unlockedAt: string;
  tier: BadgeTier;
}

export interface GamificationAggregates {
  weeklyHighCognitiveHours: number;
  consecutivePunctualMilestones: number;
  lastActiveDate: string;
  resurrectedProjectsCount: number;
  totalActiveFocusSeconds: number;
}

export interface GamificationToast {
  id: string;
  type: 'xp' | 'level' | 'badge' | 'mastery';
  title: string;
  message: string;
  icon: string;
  subtext?: string;
}

export interface CalibrationLoop {
  highFactor: number;   // e.g. 1.25 for +25% correction on Arch tasks
  mediumFactor: number; // e.g. 1.10 for +10% correction on Dev tasks
  lowFactor: number;    // e.g. 1.00
  lastCalibrated: string;
}

export interface Gamification {
  xp: number;
  level: number;
  title: string;
  xpToNextLevel: number;
  velocityIndex: number;
  calibration: CalibrationLoop;
  skills: Record<string, DomainSkill>;
  quests: DynamicQuest[];
  badges: string[]; // Legacy array for backward compatibility
  unlockedBadges: UnlockedBadge[];
  aggregates: GamificationAggregates;
  toastQueue: GamificationToast[];
  pomodorosCompleted: number;
  sessionsCompleted: number;
  bestStreak: number;
  earlyBird?: boolean;
  nightOwl?: boolean;
  perfectWeek?: boolean;
  pomoSettings: {
    focus: number;
    break: number;
    sound: string | null;
  };
  subjectPomoStats: Record<string, number>;
}


export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface ChatThread {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

