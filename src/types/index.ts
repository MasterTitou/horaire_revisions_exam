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

export interface Gamification {
  xp: number;
  level: number;
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
