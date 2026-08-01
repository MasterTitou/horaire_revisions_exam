import React from 'react';
import { Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
} from 'chart.js';
import { StudyDomain } from '../../types';
import { evaluateDomainMastery } from '../../engine/gamificationEngine';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

interface DomainRadarChartProps {
  skills: Record<string, StudyDomain>;
  isDarkMode?: boolean;
}

export const DomainRadarChart: React.FC<DomainRadarChartProps> = ({ skills, isDarkMode }) => {
  // Exclure les domaines archivés
  const skillList = Object.values(skills || {}).filter(s => !s.archived);

  // Trier par heures décroissantes pour faire émerger le Top-8
  const sortedSkills = [...skillList].sort((a, b) => b.hoursSpent - a.hoursSpent);

  let displayedSkills: { name: string; icon: string; pct: number; hours: number; color: string }[] = [];

  if (sortedSkills.length <= 8) {
    displayedSkills = sortedSkills.map(s => {
      const mastery = evaluateDomainMastery(s.hoursSpent);
      return {
        name: `${s.icon} ${s.name}`,
        icon: s.icon,
        pct: mastery.tierProgressPct,
        hours: s.hoursSpent,
        color: s.color || '#3B82F6'
      };
    });
  } else {
    // 7 principaux + 1 regroupe "Autres Domaines"
    const top7 = sortedSkills.slice(0, 7).map(s => {
      const mastery = evaluateDomainMastery(s.hoursSpent);
      return {
        name: `${s.icon} ${s.name}`,
        icon: s.icon,
        pct: mastery.tierProgressPct,
        hours: s.hoursSpent,
        color: s.color || '#3B82F6'
      };
    });

    const others = sortedSkills.slice(7);
    const avgHours = others.reduce((acc, curr) => acc + curr.hoursSpent, 0) / others.length;
    const masteryOthers = evaluateDomainMastery(avgHours);

    displayedSkills = [
      ...top7,
      {
        name: '🌐 Autres Domaines',
        icon: '🌐',
        pct: masteryOthers.tierProgressPct,
        hours: Math.round(avgHours),
        color: '#64748B'
      }
    ];
  }

  const labels = displayedSkills.map(d => d.name);
  const dataValues = displayedSkills.map(d => d.pct);

  const mainColor = 'rgba(14, 132, 120, 0.85)';
  const fillColor = isDarkMode ? 'rgba(20, 184, 166, 0.25)' : 'rgba(14, 132, 120, 0.18)';
  const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)';
  const textColor = isDarkMode ? '#CBD5E1' : '#334155';

  const data = {
    labels,
    datasets: [
      {
        label: 'Progression dans le Palier (%)',
        data: dataValues,
        backgroundColor: fillColor,
        borderColor: mainColor,
        borderWidth: 2,
        pointBackgroundColor: displayedSkills.map(d => d.color),
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: mainColor,
        pointRadius: 5
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        angleLines: {
          color: gridColor
        },
        grid: {
          color: gridColor
        },
        pointLabels: {
          color: textColor,
          font: {
            size: 11,
            weight: 'bold' as const,
            family: 'Inter, sans-serif'
          }
        },
        ticks: {
          display: false,
          min: 0,
          max: 100,
          stepSize: 25
        },
        suggestedMin: 0,
        suggestedMax: 100
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const idx = context.dataIndex;
            const item = displayedSkills[idx];
            return ` Progression: ${item.pct}% (${item.hours}h réelles)`;
          }
        }
      }
    }
  };

  return (
    <div className="w-full h-[280px] sm:h-[320px] relative flex items-center justify-center p-2">
      <Radar data={data} options={options} />
    </div>
  );
};
