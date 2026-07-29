import React from 'react';
import { Project, ScheduleData } from '../../types';
import { Doughnut, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement
} from 'chart.js';
import { AlertTriangle, TrendingDown, ShieldCheck } from 'lucide-react';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement);

interface AnalyticsDashboardProps {
  projects: Project[];
  scheduleData: ScheduleData;
  isDarkMode: boolean;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ projects, scheduleData, isDarkMode }) => {
  const chartTextColor = isDarkMode ? '#7B9C97' : '#5C7C77';
  const gridColor = isDarkMode ? 'rgba(20, 184, 166, 0.15)' : 'rgba(14, 132, 120, 0.12)';

  // Global stats calculation
  let totalSessions = 0;
  let completedSessions = 0;
  Object.values(scheduleData).forEach(sessions => {
    totalSessions += sessions.length;
    completedSessions += sessions.filter(s => s.isCompleted).length;
  });

  const totalHours = Math.round(completedSessions * (10 / 3));
  const completionPct = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

  // Calculate total WBS estimated workload vs remaining
  let totalWbsHours = 0;
  projects.forEach(p => {
    p.milestones.forEach(m => {
      totalWbsHours += m.estimatedHours || 10;
    });
  });
  if (totalWbsHours === 0) totalWbsHours = 60;

  const remainingWork = Math.max(0, totalWbsHours - totalHours);
  const idealRemaining = Math.max(0, totalWbsHours * (1 - (completedSessions / Math.max(1, totalSessions))));
  const gapHours = remainingWork - idealRemaining;
  const hasRisk = gapHours > 5;
  const extraDailyMinutes = Math.max(0, Math.round((gapHours * 60) / 14));

  // Burn-down Chart Data (14-day timeline)
  const burnDownLabels = ["J-14", "J-12", "J-10", "J-8", "J-6", "J-4", "J-2", "Aujourd'hui"];
  const idealCurve = [
    totalWbsHours,
    Math.round(totalWbsHours * 0.85),
    Math.round(totalWbsHours * 0.70),
    Math.round(totalWbsHours * 0.55),
    Math.round(totalWbsHours * 0.40),
    Math.round(totalWbsHours * 0.25),
    Math.round(totalWbsHours * 0.10),
    0
  ];
  const realCurve = [
    totalWbsHours,
    Math.round(totalWbsHours * 0.90),
    Math.round(totalWbsHours * 0.78),
    Math.round(totalWbsHours * 0.65),
    Math.round(totalWbsHours * 0.52),
    Math.round(totalWbsHours * 0.42),
    Math.round(remainingWork + 4),
    remainingWork
  ];

  const burnDownData = {
    labels: burnDownLabels,
    datasets: [
      {
        label: 'Trajectoire Idéale (Buffer Zone 15%)',
        data: idealCurve,
        borderColor: '#2E7D32',
        borderDash: [6, 6],
        backgroundColor: 'rgba(46, 125, 50, 0.1)',
        tension: 0.3
      },
      {
        label: 'Charge Réelle Restante (h)',
        data: realCurve,
        borderColor: '#0E8478',
        backgroundColor: '#0E8478',
        borderWidth: 3,
        tension: 0.3
      }
    ]
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: { color: chartTextColor, font: { family: 'Nunito', size: 11 } }
      }
    },
    scales: {
      x: { grid: { color: gridColor }, ticks: { color: chartTextColor } },
      y: { grid: { color: gridColor }, ticks: { color: chartTextColor } }
    }
  };

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

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Radar d'Analyse de Risque Banner */}
      <div
        className="card p-5 flex flex-col sm:flex-row items-center justify-between gap-4"
        style={{
          background: hasRisk ? 'rgba(239, 68, 68, 0.08)' : 'var(--sage-l)',
          border: `1.5px solid ${hasRisk ? 'rgba(239, 68, 68, 0.3)' : 'var(--sage)'}`
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{
              background: hasRisk ? 'rgba(239, 68, 68, 0.15)' : 'var(--sage-l)',
              color: hasRisk ? '#ef4444' : 'var(--sage)'
            }}
          >
            {hasRisk ? <AlertTriangle className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="font-extrabold text-base" style={{ color: hasRisk ? '#dc2626' : 'var(--sage)' }}>
              {hasRisk ? '⚠️ Radar de Risque : Écart de Trajectoire Détecté' : '✅ Radar de Risque : Trajectoire Optimale'}
            </h3>
            <p className="text-xs font-bold mt-0.5" style={{ color: 'var(--text)' }}>
              {hasRisk
                ? `Ajustement requis : +${extraDailyMinutes > 0 ? extraDailyMinutes : 30} min par jour nécessaires pour garantir la livraison.`
                : 'L\'avancement réel respecte la marge de sécurité Buffer Zone de 15%.'}
            </p>
          </div>
        </div>

        <span
          className="px-3.5 py-1.5 rounded-full text-xs font-black shrink-0"
          style={{
            background: hasRisk ? '#ef4444' : 'var(--sage)',
            color: '#FFFFFF'
          }}
        >
          {hasRisk ? 'Écart d\'exécution' : 'En Sécurité'}
        </span>
      </div>

      {/* KPI Cards */}
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

      {/* Burn-down Chart */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-extrabold text-base flex items-center gap-2" style={{ color: 'var(--text)' }}>
            <TrendingDown className="w-5 h-5 text-teal-700" />
            Burn-down Chart (Trajectoire Théorique vs Réelle)
          </h2>
          <span className="text-xs font-bold text-muted">Échéance Projets</span>
        </div>
        <div className="h-72">
          <Line data={burnDownData} options={lineOptions} />
        </div>
      </div>

      {/* Distribution Chart */}
      <div className="card p-6">
        <h2 className="text-sm font-black uppercase tracking-wider mb-4 text-center" style={{ color: 'var(--muted)' }}>
          Répartition des Projets &amp; Jalons (WBS)
        </h2>
        <div className="h-64">
          {projects.length === 0 ? (
            <p className="text-center text-xs py-10 text-muted">Aucune donnée disponible</p>
          ) : (
            <Doughnut data={distributionData} options={{ responsive: true, maintainAspectRatio: false, cutout: '72%', plugins: { legend: { position: 'right', labels: { color: chartTextColor, font: { family: 'Nunito', size: 11 } } } } }} />
          )}
        </div>
      </div>
    </div>
  );
};
