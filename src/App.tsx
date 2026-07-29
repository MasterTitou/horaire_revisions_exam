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
import { AICoachTab } from './components/ai/AICoachTab';
import { ProfileTab } from './components/profile/ProfileTab';

export const App: React.FC = () => {
  const {
    projects,
    scheduleData,
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
    toggleTheme,
    setChatHistory
  } = useProjectStore();

  const [activeTab, setActiveTab] = useState('planner');

  const handleLogin = (pwd: string) => {
    if (pwd === 'canard3434' || pwd.length >= 4) {
      localStorage.setItem('authToken', 'auth_token_active');
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  return (
    <div className="min-h-screen relative">
      {/* Background Shapes */}
      <BackgroundBlobs />

      {/* Authentication */}
      {!isAuthenticated && <LoginOverlay onLogin={handleLogin} />}

      {/* Main SaaS Container */}
      <div id="appContainer" className="relative z-10 max-w-7xl mx-auto px-3 md:px-6 pt-4 md:pt-8 pb-28 md:pb-10">
        <Header
          streak={streak}
          gamification={gamification}
          isDarkMode={isDarkMode}
          toggleTheme={toggleTheme}
          syncStatus={syncStatus}
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
                  currentWeekStart={currentWeekStart}
                  onChangeWeek={changeWeek}
                  onRegenerate={() => changeWeek(0)}
                  onToggleSession={toggleSession}
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
            <ProfileTab gamification={gamification} />
          </div>
        )}

        {/* Floating Pomodoro Dock */}
        <PomodoroDock />
      </div>
    </div>
  );
};

export default App;
