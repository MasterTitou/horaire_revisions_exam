export type CognitiveLoad = 'high' | 'medium' | 'low';

export interface Milestone {
  id: string;
  title: string;
  estimatedHours: number;
  completedHours: number;
  startDate?: string; // Date de début minimale (YYYY-MM-DD)
  dueDate: string;
  cognitiveLoad: CognitiveLoad;
  isHardDeadline: boolean;
  isCompleted: boolean;
  dependsOn?: string[]; // IDs des jalons prérequis obligatoires
  isCriticalPath?: boolean; // Calculé dynamiquement (Slack === 0)
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

export interface UserSettings {
  timezone: string; // e.g. 'Europe/Paris'
  bufferMinutesBefore: number; // Default 15
  bufferMinutesAfter: number;  // Default 15
  dayStartHour: number;        // Default 8 (08:00)
  dayEndHour: number;          // Default 23 (23:00)
  slotDurationMinutes: number; // Default 60
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

export interface DomainSkill {
  id: string;
  name: string;
  icon: string;
  hoursSpent: number;
  level: number;
}

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
  velocityIndex: number;
  calibration: CalibrationLoop;
  skills: Record<string, DomainSkill>;
  quests: DynamicQuest[];
  badges: string[];
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

