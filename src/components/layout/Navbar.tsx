import React from 'react';
import { Calendar, BarChart2, Sparkles, Award, Layers } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  return (
    <>
      {/* DESKTOP TABS */}
      <nav className="hidden md:flex gap-1.5 mb-6 p-1.5 rounded-2xl w-fit card" style={{ borderRadius: '22px' }}>
        <button
          className={`tab-btn ${activeTab === 'planner' ? 'active' : ''}`}
          onClick={() => setActiveTab('planner')}
        >
          📅 Planning
        </button>
        <button
          className={`tab-btn ${activeTab === 'gantt' ? 'active' : ''}`}
          onClick={() => setActiveTab('gantt')}
        >
          📊 Gantt WBS
        </button>
        <button
          className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          📈 Analytique
        </button>
        <button
          className={`tab-btn ${activeTab === 'ai' ? 'active' : ''}`}
          onClick={() => setActiveTab('ai')}
        >
          ✨ Coach IA
        </button>
        <button
          className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          🏅 Profil
        </button>
      </nav>

      {/* MOBILE BOTTOM NAV */}
      <nav className="fixed bottom-3 left-4 right-4 max-w-md mx-auto z-40 flex justify-around items-center px-3 py-2 card shadow-xl md:hidden" style={{ borderRadius: '28px', backdropFilter: 'blur(16px)', background: 'var(--bg-card)' }}>
        <button
          onClick={() => setActiveTab('planner')}
          className={`bnav-btn ${activeTab === 'planner' ? 'active' : ''}`}
        >
          <Calendar className="bnav-icon w-5 h-5" />
          <span className="bnav-label">Planning</span>
          <div className="bnav-indicator"></div>
        </button>
        <button
          onClick={() => setActiveTab('gantt')}
          className={`bnav-btn ${activeTab === 'gantt' ? 'active' : ''}`}
        >
          <Layers className="bnav-icon w-5 h-5" />
          <span className="bnav-label">Gantt</span>
          <div className="bnav-indicator"></div>
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`bnav-btn ${activeTab === 'analytics' ? 'active' : ''}`}
        >
          <BarChart2 className="bnav-icon w-5 h-5" />
          <span className="bnav-label">Stats</span>
          <div className="bnav-indicator"></div>
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`bnav-btn ${activeTab === 'ai' ? 'active' : ''}`}
        >
          <Sparkles className="bnav-icon w-5 h-5" />
          <span className="bnav-label">Coach</span>
          <div className="bnav-indicator"></div>
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`bnav-btn ${activeTab === 'profile' ? 'active' : ''}`}
        >
          <Award className="bnav-icon w-5 h-5" />
          <span className="bnav-label">Profil</span>
          <div className="bnav-indicator"></div>
        </button>
      </nav>
    </>
  );
};
