import { useState, useEffect, useCallback } from 'react';
import { Project, ScheduleData, Streak, Gamification, ChatMessage } from '../types';
import { generateSchedule, getStartOfWeek } from '../engine/scheduler';

const COLORS = [
  "#0E8478", "#6B46C1", "#2E7D32", "#FF6B35", "#3B82F6", "#D946EF",
  "#059669", "#E11D48", "#F59E0B", "#8B5CF6", "#14B8A6", "#EC4899"
];

const DEFAULT_GAMIFICATION: Gamification = {
  xp: 0,
  level: 1,
  badges: [],
  pomodorosCompleted: 0,
  sessionsCompleted: 0,
  bestStreak: 0,
  pomoSettings: { focus: 25, break: 5, sound: null },
  subjectPomoStats: {}
};

export function useProjectStore() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [scheduleData, setScheduleData] = useState<ScheduleData>({});
  const [streak, setStreak] = useState<Streak>({ count: 0, lastDate: '' });
  const [gamification, setGamification] = useState<Gamification>(DEFAULT_GAMIFICATION);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getStartOfWeek(new Date()));
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [authToken, setAuthToken] = useState<string>(localStorage.getItem('authToken') || '');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!localStorage.getItem('authToken'));
  const [syncStatus, setSyncStatus] = useState<'synced' | 'saving' | 'loading' | 'error'>('synced');

  // Local storage loading & auto-migration
  useEffect(() => {
    const saved = localStorage.getItem('revisionCalendarData');
    if (saved) {
      try {
        const d = JSON.parse(saved);
        let projs: Project[] = d.projects || [];
        const subjs = d.subjects || [];

        // Auto-migration from subjects to projects
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

        setProjects(projs);
        setScheduleData(d.scheduleData || {});
        setStreak(d.streak || { count: 0, lastDate: '' });
        setGamification(d.gamification || DEFAULT_GAMIFICATION);
        setChatHistory(d.chatHistory || []);
        setIsDarkMode(!!d.isDarkMode);
        if (d.isDarkMode) {
          document.documentElement.classList.add('dark');
        }
      } catch (e) {
        console.error('Failed to parse revisionCalendarData:', e);
      }
    }
  }, []);

  // Persistence handler
  const saveAll = useCallback((
    newProjects: Project[],
    newSchedule: ScheduleData,
    newStreak: Streak,
    newGamification: Gamification,
    newDark: boolean
  ) => {
    const payload = {
      projects: newProjects,
      scheduleData: newSchedule,
      streak: newStreak,
      gamification: newGamification,
      chatHistory,
      isDarkMode: newDark
    };
    localStorage.setItem('revisionCalendarData', JSON.stringify(payload));
  }, [chatHistory]);

  const addProject = (name: string, code: string, deadline: string, isHardDeadline: boolean) => {
    const newProj: Project = {
      id: `prj_${Date.now()}`,
      name,
      code: code.toUpperCase() || 'PRJ',
      color: COLORS[projects.length % COLORS.length],
      deadline,
      isHardDeadline,
      milestones: []
    };
    const updatedProjects = [...projects, newProj];
    const updatedSchedule = generateSchedule(updatedProjects, currentWeekStart, scheduleData);
    setProjects(updatedProjects);
    setScheduleData(updatedSchedule);
    saveAll(updatedProjects, updatedSchedule, streak, gamification, isDarkMode);
  };

  const addMilestone = (
    projId: string,
    title: string,
    dueDate: string,
    estimatedHours: number,
    cognitiveLoad: 'high' | 'medium' | 'low'
  ) => {
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
              dueDate: dueDate || p.deadline,
              cognitiveLoad,
              isHardDeadline: p.isHardDeadline,
              isCompleted: false
            }
          ]
        };
      }
      return p;
    });
    const updatedSchedule = generateSchedule(updatedProjects, currentWeekStart, scheduleData);
    setProjects(updatedProjects);
    setScheduleData(updatedSchedule);
    saveAll(updatedProjects, updatedSchedule, streak, gamification, isDarkMode);
  };

  const deleteProject = (projId: string) => {
    const updatedProjects = projects.filter(p => p.id !== projId);
    const updatedSchedule = generateSchedule(updatedProjects, currentWeekStart, scheduleData);
    setProjects(updatedProjects);
    setScheduleData(updatedSchedule);
    saveAll(updatedProjects, updatedSchedule, streak, gamification, isDarkMode);
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
    const updatedSchedule = generateSchedule(updatedProjects, currentWeekStart, scheduleData);
    setProjects(updatedProjects);
    setScheduleData(updatedSchedule);
    saveAll(updatedProjects, updatedSchedule, streak, gamification, isDarkMode);
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
      updatedGamification.sessionsCompleted += 1;
      updatedGamification.xp += 25;
    }

    setScheduleData(updatedSchedule);
    setGamification(updatedGamification);
    saveAll(projects, updatedSchedule, streak, updatedGamification, isDarkMode);
  };

  const changeWeek = (offset: number) => {
    const nextWeek = new Date(currentWeekStart);
    nextWeek.setDate(nextWeek.getDate() + offset * 7);
    setCurrentWeekStart(nextWeek);
    const updatedSchedule = generateSchedule(projects, nextWeek, scheduleData);
    setScheduleData(updatedSchedule);
    saveAll(projects, updatedSchedule, streak, gamification, isDarkMode);
  };

  const toggleTheme = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    document.documentElement.classList.toggle('dark', nextDark);
    saveAll(projects, scheduleData, streak, gamification, nextDark);
  };

  return {
    projects,
    scheduleData,
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
    toggleTheme,
    setChatHistory
  };
}
