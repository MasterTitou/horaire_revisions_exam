import React from 'react';
import { Project, ScheduleData } from '../../types';
import { Doughnut, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

interface AnalyticsDashboardProps {
  projects: Project[];
  scheduleData: ScheduleData;
  isDarkMode: boolean;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ projects, scheduleData, isDarkMode }) => {
  const chartTextColor = isDarkMode ? '#7B9C97' : '#5C7C77';

  // Distribution chart data
  const distributionData = {
    labels: projects.map(p => p.name),
    datasets: [
      {
        data: projects.map(p => p.milestones.length || 1),
        backgroundColor: projects.map(p => p.color),
        borderWidth: isDarkMode ? 2 : 1,
        borderColor: isDarkMode ? '#122421' : '#F4F8F6'
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          color: chartTextColor,
          font: { family: 'Nunito', size: 11 }
        }
      }
    }
  };

  // Global stats calculation
  let totalSessions = 0;
  let completedSessions = 0;
  Object.values(scheduleData).forEach(sessions => {
    totalSessions += sessions.length;
    completedSessions += sessions.filter(s => s.isCompleted).length;
  });

  const totalHours = Math.round(completedSessions * (10 / 3));
  const completionPct = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5 text-center">
          <span className="text-xs font-black uppercase text-muted block mb-1">Total Projets</span>
          <span className="text-3xl font-black text-teal-700">{projects.length}</span>
        </div>
        <div className="card p-5 text-center">
          <span className="text-xs font-black uppercase text-muted block mb-1">Volume Accompli</span>
          <span className="text-3xl font-black text-teal-700">{totalHours}h</span>
        </div>
        <div className="card p-5 text-center">
          <span className="text-xs font-black uppercase text-muted block mb-1">Taux d'Avancement</span>
          <span className="text-3xl font-black text-teal-700">{completionPct}%</span>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-sm font-black uppercase tracking-wider mb-4 text-center" style={{ color: 'var(--muted)' }}>
          Répartition des Projets &amp; Jalons (WBS)
        </h2>
        <div className="h-64">
          {projects.length === 0 ? (
            <p className="text-center text-xs py-10 text-muted">Aucune donnée disponible</p>
          ) : (
            <Doughnut data={distributionData} options={chartOptions} />
          )}
        </div>
      </div>
    </div>
  );
};
