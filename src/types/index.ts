export type CognitiveLoad = 'high' | 'medium' | 'low';

export interface Milestone {
  id: string;
  title: string;
  estimatedHours: number;
  completedHours: number;
  dueDate: string;
  cognitiveLoad: CognitiveLoad;
  isHardDeadline: boolean;
  isCompleted: boolean;
}

export interface Project {
  id: string;
  name: string;
  code: string;
  color: string;
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

export interface Gamification {
  xp: number;
  level: number;
  velocityIndex: number; // Ratio Heures Réalisées / Heures Prévues sur 14j glissants (%)
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
}
