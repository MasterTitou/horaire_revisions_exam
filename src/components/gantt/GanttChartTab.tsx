import React from 'react';
import { Project } from '../../types';
import { Layers, Flame, Link, Calendar, CheckCircle2 } from 'lucide-react';

interface GanttChartTabProps {
  projects: Project[];
}

export const GanttChartTab: React.FC<GanttChartTabProps> = ({ projects }) => {
  // Collect all milestones across projects
  interface GanttItem {
    project: Project;
    id: string;
    title: string;
    estimatedHours: number;
    completedHours: number;
    dueDate: string;
    isCriticalPath: boolean;
    isCompleted: boolean;
    dependsOn?: string[];
  }

  const allItems: GanttItem[] = [];
  projects.forEach(p => {
    p.milestones.forEach(m => {
      allItems.push({
        project: p,
        id: m.id,
        title: m.title,
        estimatedHours: m.estimatedHours || 10,
        completedHours: m.completedHours || 0,
        dueDate: m.dueDate || p.deadline || '',
        isCriticalPath: !!m.isCriticalPath,
        isCompleted: m.isCompleted,
        dependsOn: m.dependsOn
      });
    });
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="card p-6 flex flex-col md:flex-row items-center justify-between gap-4" style={{ borderLeft: '6px solid var(--terra)' }}>
        <div>
          <h2 className="text-2xl font-black flex items-center gap-2.5" style={{ color: 'var(--text)' }}>
            <Calendar className="w-6 h-6 text-teal-700" />
            Diagramme de Gantt Interactif (Chronologie Globale)
          </h2>
          <p className="text-xs font-bold mt-1" style={{ color: 'var(--muted)' }}>
            Visualisation temporelle multi-mois de l'ensemble des projets, dépendances DAG et jalons sur le Chemin Critique.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-full text-xs font-black bg-red-500/10 text-red-600 border border-red-500/20 flex items-center gap-1">
            <Flame className="w-3.5 h-3.5" />
            Chemin Critique (Zero Slack)
          </span>
        </div>
      </div>

      {/* Main Gantt Grid */}
      <div className="card p-6 space-y-6">
        {allItems.length === 0 ? (
          <div className="text-center py-14 space-y-2">
            <div className="text-5xl mb-2">📊</div>
            <p className="text-sm font-bold" style={{ color: 'var(--muted)' }}>
              Aucun jalon WBS disponible. Ajoutez des projets et des jalons dans le planning pour afficher le Gantt !
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {projects.map(proj => {
              if (proj.milestones.length === 0) return null;

              return (
                <div key={proj.id} className="space-y-3 p-4 rounded-2xl" style={{ background: 'var(--bg)', border: '1.5px solid var(--border)' }}>
                  {/* Project Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ background: proj.color }}></div>
                      <span className="font-extrabold text-base truncate" style={{ color: 'var(--text)' }}>
                        [{proj.code}] {proj.name}
                      </span>
                    </div>
                    <span className="text-xs font-black text-muted">
                      Échéance : {proj.deadline || 'Non spécifiée'}
                    </span>
                  </div>

                  {/* Milestones Horizontal Gantt Bars */}
                  <div className="space-y-2.5 pt-1">
                    {proj.milestones.map(ms => {
                      const pct = Math.min(100, Math.round(((ms.completedHours || 0) / (ms.estimatedHours || 10)) * 100));
                      const isCritical = ms.isCriticalPath;
                      const hasParent = ms.dependsOn && ms.dependsOn.length > 0;
                      const parentMs = hasParent ? proj.milestones.find(p => p.id === ms.dependsOn![0]) : null;

                      return (
                        <div key={ms.id} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-bold gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className={`truncate ${ms.isCompleted ? 'line-through opacity-60' : ''}`} style={{ color: 'var(--text)' }}>
                                {ms.title}
                              </span>
                              {isCritical && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-black text-red-600 bg-red-500/10 border border-red-500/20 flex items-center gap-0.5 shrink-0">
                                  <Flame className="w-3 h-3" />
                                  Chemin Critique
                                </span>
                              )}
                              {parentMs && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-teal-700 bg-teal-500/10 flex items-center gap-0.5 shrink-0" title={`Bloqué jusqu'à la fin de : ${parentMs.title}`}>
                                  <Link className="w-3 h-3" />
                                  Après: {parentMs.title}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-muted shrink-0">
                              {ms.completedHours || 0}h / {ms.estimatedHours}h ({pct}%)
                            </span>
                          </div>

                          {/* Horizontal Gantt Bar */}
                          <div className="relative h-6 w-full rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                            <div
                              className="h-full rounded-xl transition-all duration-500 flex items-center justify-end pr-2 text-[10px] font-black text-white"
                              style={{
                                width: `${Math.max(8, pct)}%`,
                                background: isCritical ? 'linear-gradient(90deg, #EF4444, #DC2626)' : proj.color
                              }}
                            >
                              {pct > 15 && `${pct}%`}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
