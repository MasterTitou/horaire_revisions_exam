import React, { useState } from 'react';
import { useProjectStore } from './store/useProjectStore';
import { BackgroundBlobs } from './components/layout/BackgroundBlobs';
import { Header } from './components/layout/Header';
import { Navbar } from './components/layout/Navbar';
import { LoginOverlay } from './components/layout/LoginOverlay';
import { ProjectWBSCard } from './components/planner/ProjectWBSCard';
import { PlanningCalendar } from './components/planner/PlanningCalendar';
import { StatWidgets } from './components/planner/StatWidgets';
import { PomodoroDock } from './components/planner/PomodoroDock';
import { AnalyticsDashboard } from './components/analytics/AnalyticsDashboard';
import { GanttChartTab } from './components/gantt/GanttChartTab';
import { CalendarTab } from './components/calendar/CalendarTab';
import { AICoachTab } from './components/ai/AICoachTab';
import { ProfileTab } from './components/profile/ProfileTab';
import { QuickTaskParserModal } from './components/ai/QuickTaskParserModal';


import { GamificationToastQueue } from './components/common/GamificationToastQueue';

export const App: React.FC = () => {
  const {
    projects,
    scheduleData,
    externalEvents,
    userSettings,
    streak,
    gamification,
    chatHistory,
    currentWeekStart,
    isDarkMode,
    isAuthenticated,
    setIsAuthenticated,
    syncStatus,
    addProject,
    addMilestone,
    deleteProject,
    deleteMilestone,
    toggleSession,
    changeWeek,
    regenerateSchedule,
    toggleTheme,
    resetAllData,
    exportDataJSON,
    importDataJSON,
    setChatHistory,
    updateUserSettings,
    setExternalEvents,
    addExternalEvent,
    dismissToast
  } = useProjectStore();

  const [activeTab, setActiveTab] = useState('planner');
  const [isQuickParserOpen, setIsQuickParserOpen] = useState(false);

  const handleLogin = (pwd: string) => {
    if (pwd === 'canard3434' || pwd.length >= 4) {
      localStorage.setItem('authToken', 'auth_token_active');
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  const handleAddParsedTask = (parsed: {
    projectId?: string;
    projectName: string;
    title: string;
    category: string;
    difficultyScore: number;
    estimatedHours: number;
    cognitiveLoad: 'low' | 'medium' | 'high';
    deadline: string;
    isHardDeadline: boolean;
    subtasks: string[];
  }) => {
    let targetProjectId = parsed.projectId;

    if (!targetProjectId) {
      const newProjCode = parsed.projectName.slice(0, 4).toUpperCase() || 'PRJ';
      addProject(
        parsed.projectName,
        newProjCode,
        parsed.deadline,
        parsed.isHardDeadline
      );
      if (projects.length > 0) {
        targetProjectId = projects[projects.length - 1].id;
      }
    }

    if (targetProjectId) {
      addMilestone(
        targetProjectId,
        parsed.title,
        parsed.deadline,
        parsed.estimatedHours,
        parsed.cognitiveLoad
      );
    } else {
      regenerateSchedule();
    }
  };



  return (
    <div className="min-h-screen relative">
      {/* Background Shapes */}
      <BackgroundBlobs />

      {/* Authentication */}
      {!isAuthenticated && <LoginOverlay onLogin={handleLogin} />}

      {/* Main SaaS Container */}
      <div
        id="appContainer"
        className="relative z-10 max-w-7xl mx-auto px-3 md:px-6 pb-28 md:pb-10"
        style={{ paddingTop: 'max(2.2rem, env(safe-area-inset-top))' }}
      >
        <Header
          streak={streak}
          gamification={gamification}
          isDarkMode={isDarkMode}
          toggleTheme={toggleTheme}
          syncStatus={syncStatus}
          onOpenQuickParser={() => setIsQuickParserOpen(true)}
        />

        <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* TAB: PLANNER */}
        {activeTab === 'planner' && (
          <div className="tab-panel space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Column: Projects & WBS */}
              <div className="lg:col-span-5 space-y-5">
                <ProjectWBSCard
                  projects={projects}
                  onAddProject={addProject}
                  onAddMilestone={addMilestone}
                  onDeleteProject={deleteProject}
                  onDeleteMilestone={deleteMilestone}
                />
              </div>

              {/* Right Column: Planning Calendar & Widgets */}
              <div className="lg:col-span-7 space-y-5">
                <PlanningCalendar
                  projects={projects}
                  scheduleData={scheduleData}
                  externalEvents={externalEvents}
                  userSettings={userSettings}
                  currentWeekStart={currentWeekStart}
                  onChangeWeek={changeWeek}
                  onRegenerate={regenerateSchedule}
                  onToggleSession={toggleSession}
                  onUpdateSettings={updateUserSettings}
                  onAddExternalEvent={addExternalEvent}
                  onSetExternalEvents={setExternalEvents}
                />


                <StatWidgets
                  projects={projects}
                  scheduleData={scheduleData}
                  currentWeekStart={currentWeekStart}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB: CALENDAR */}
        {activeTab === 'calendar' && (
          <div className="tab-panel">
            <CalendarTab
              projects={projects}
              scheduleData={scheduleData}
              externalEvents={externalEvents}
              userSettings={userSettings}
              currentWeekStart={currentWeekStart}
              onChangeWeek={changeWeek}
              onRegenerate={regenerateSchedule}
              onToggleSession={toggleSession}
              onUpdateSettings={updateUserSettings}
              onAddExternalEvent={addExternalEvent}
              onSetExternalEvents={setExternalEvents}
            />
          </div>
        )}


        {/* TAB: ANALYTICS */}
        {activeTab === 'analytics' && (
          <div className="tab-panel">
            <AnalyticsDashboard
              projects={projects}
              scheduleData={scheduleData}
              isDarkMode={isDarkMode}
            />
          </div>
        )}

        {/* TAB: AI COACH */}
        {activeTab === 'ai' && (
          <div className="tab-panel">
            <AICoachTab
              projects={projects}
              chatHistory={chatHistory}
              setChatHistory={setChatHistory}
              authToken="auth_active"
            />
          </div>
        )}

        {/* TAB: PROFILE */}
        {activeTab === 'profile' && (
          <div className="tab-panel">
            <ProfileTab
              gamification={gamification}
              onResetData={resetAllData}
              onExportData={exportDataJSON}
              onImportData={importDataJSON}
              isDarkMode={isDarkMode}
            />
          </div>
        )}

        {/* Modal de Saisie Rapide IA Flash-Lite */}
        <QuickTaskParserModal
          isOpen={isQuickParserOpen}
          onClose={() => setIsQuickParserOpen(false)}
          authToken="auth_active"
          projects={projects}
          onAddParsedTask={handleAddParsedTask}
        />

        {/* Floating Gamification Toast Queue */}
        <GamificationToastQueue
          toasts={gamification.toastQueue || []}
          onDismiss={dismissToast}
        />

        {/* Floating Pomodoro Dock */}
        <PomodoroDock />
      </div>
    </div>
  );
};


export default App;

