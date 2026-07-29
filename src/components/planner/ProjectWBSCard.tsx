import React, { useState } from 'react';
import { Project, CognitiveLoad } from '../../types';
import { Layers, Plus, Trash2, X } from 'lucide-react';

interface ProjectWBSCardProps {
  projects: Project[];
  onAddProject: (name: string, code: string, deadline: string, isHardDeadline: boolean) => void;
  onAddMilestone: (projId: string, title: string, dueDate: string, estimatedHours: number, cognitiveLoad: CognitiveLoad) => void;
  onDeleteProject: (projId: string) => void;
  onDeleteMilestone: (projId: string, msId: string) => void;
}

export const ProjectWBSCard: React.FC<ProjectWBSCardProps> = ({
  projects,
  onAddProject,
  onAddMilestone,
  onDeleteProject,
  onDeleteMilestone
}) => {
  const [showProjForm, setShowProjForm] = useState(false);
  const [activeProjForMs, setActiveProjForMs] = useState<Project | null>(null);

  // New Project State
  const [projName, setProjName] = useState('');
  const [projCode, setProjCode] = useState('');
  const [projDeadline, setProjDeadline] = useState('');
  const [projType, setProjType] = useState<'hard' | 'soft'>('hard');

  // New Milestone State
  const [msTitle, setMsTitle] = useState('');
  const [msDate, setMsDate] = useState('');
  const [msHours, setMsHours] = useState(10);
  const [msCognitive, setMsCognitive] = useState<CognitiveLoad>('medium');

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projName.trim()) return;
    onAddProject(projName.trim(), projCode.trim() || 'PRJ', projDeadline, projType === 'hard');
    setProjName('');
    setProjCode('');
    setProjDeadline('');
    setShowProjForm(false);
  };

  const handleCreateMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProjForMs || !msTitle.trim()) return;
    onAddMilestone(activeProjForMs.id, msTitle.trim(), msDate, msHours, msCognitive);
    setMsTitle('');
    setMsDate('');
    setActiveProjForMs(null);
  };

  const cogBadges: Record<CognitiveLoad, React.ReactNode> = {
    high: <span className="px-1.5 py-0.5 rounded text-[9px] font-black shrink-0" style={{ background: 'rgba(107,70,193,0.15)', color: 'var(--plum)' }}>🧠 Arch/High</span>,
    medium: <span className="px-1.5 py-0.5 rounded text-[9px] font-black shrink-0" style={{ background: 'var(--terra-l)', color: 'var(--terra)' }}>⚙️ Dev/Mid</span>,
    low: <span className="px-1.5 py-0.5 rounded text-[9px] font-black shrink-0" style={{ background: 'var(--sage-l)', color: 'var(--sage)' }}>📝 Doc/Low</span>
  };

  return (
    <div className="card p-5 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-extrabold text-xl flex items-center gap-2.5" style={{ color: 'var(--text)' }}>
          <span className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0" style={{ background: '#DDF2ED', color: 'var(--terra)' }}>
            <Layers className="w-5 h-5" />
          </span>
          Projets &amp; Jalons (WBS)
        </h2>
        <button
          onClick={() => { setShowProjForm(!showProjForm); setActiveProjForMs(null); }}
          className="btn-soft text-xs py-1.5 px-3"
        >
          ＋ Projet
        </button>
      </div>

      {/* Projects & WBS List */}
      <div className="space-y-3 max-h-80 overflow-y-auto scr pr-1">
        {projects.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-xs font-bold mb-2" style={{ color: 'var(--muted)' }}>Aucun projet ou jalon configuré</p>
            <button onClick={() => setShowProjForm(true)} className="btn-soft text-xs py-1.5 px-3">
              ＋ Créer mon premier projet
            </button>
          </div>
        ) : (
          projects.map(proj => {
            const hardBadge = proj.isHardDeadline ? (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-black shrink-0" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>🔴 Ferme</span>
            ) : (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-black shrink-0" style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>🔵 Filée</span>
            );

            return (
              <div key={proj.id} className="p-3.5 rounded-2xl space-y-2 transition-all" style={{ background: 'var(--bg)', border: '1.5px solid var(--border)' }}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="subject-dot shrink-0" style={{ background: proj.color }}></div>
                    <span className="font-extrabold text-sm truncate" style={{ color: 'var(--text)' }}>{proj.name}</span>
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded" style={{ background: 'var(--terra-l)', color: 'var(--terra)' }}>{proj.code}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {hardBadge}
                    <button
                      onClick={() => { setActiveProjForMs(proj); setShowProjForm(false); }}
                      className="btn-soft text-[10px] py-1 px-2 font-bold"
                      title="Ajouter Jalon WBS"
                    >
                      ＋ Jalon
                    </button>
                    <button
                      onClick={() => onDeleteProject(proj.id)}
                      className="w-6 h-6 rounded flex items-center justify-center hover:text-red-500 text-xs"
                      style={{ color: 'var(--muted)' }}
                      title="Supprimer Projet"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Milestones Accordion */}
                <div className="space-y-1.5 pt-1">
                  {proj.milestones.length === 0 ? (
                    <p className="text-[10px] italic py-1 text-center" style={{ color: 'var(--muted)' }}>Aucun jalon (WBS) dans ce projet</p>
                  ) : (
                    proj.milestones.map(ms => (
                      <div key={ms.id} className="flex items-center justify-between p-2 rounded-xl text-xs gap-2" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                        <div className="min-w-0 flex-grow">
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold truncate" style={{ color: 'var(--text)' }}>{ms.title}</span>
                            {cogBadges[ms.cognitiveLoad]}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>
                            <span>⏱ {ms.estimatedHours}h estimées</span>
                            <span>📅 {ms.dueDate || 'Pas de date'}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => onDeleteMilestone(proj.id, ms.id)}
                          className="text-xs hover:text-red-500 p-1 font-bold"
                          title="Supprimer jalon"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Form: Add Project */}
      {showProjForm && (
        <form onSubmit={handleCreateProject} className="space-y-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
          <span className="text-xs font-black uppercase tracking-wider block" style={{ color: 'var(--terra)' }}>Nouveau Projet</span>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              value={projName}
              onChange={e => setProjName(e.target.value)}
              placeholder="Nom (ex: App SaaS v1)"
              className="inp col-span-2 text-xs"
            />
            <input
              type="text"
              value={projCode}
              onChange={e => setProjCode(e.target.value)}
              placeholder="Code (ex: SAAS)"
              className="inp text-xs uppercase"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-extrabold block mb-1" style={{ color: 'var(--muted)' }}>Échéance globale</label>
              <input
                type="date"
                value={projDeadline}
                onChange={e => setProjDeadline(e.target.value)}
                className="inp text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] font-extrabold block mb-1" style={{ color: 'var(--muted)' }}>Type d'échéance</label>
              <select
                value={projType}
                onChange={e => setProjType(e.target.value as 'hard' | 'soft')}
                className="inp text-xs font-bold"
              >
                <option value="hard">🔴 Ferme (Livraison)</option>
                <option value="soft">🔵 Filée (Volume)</option>
              </select>
            </div>
          </div>
          <button type="submit" className="btn-main w-full text-xs py-2.5 font-extrabold">
            Créer le projet
          </button>
        </form>
      )}

      {/* Form: Add Milestone */}
      {activeProjForMs && (
        <form onSubmit={handleCreateMilestone} className="space-y-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider block" style={{ color: 'var(--terra)' }}>Ajouter un Jalon (WBS)</span>
            <span className="text-xs font-bold text-muted">{activeProjForMs.code}</span>
          </div>
          <input
            type="text"
            value={msTitle}
            onChange={e => setMsTitle(e.target.value)}
            placeholder="Titre jalon (ex: API Auth OAuth2)"
            className="inp text-xs"
          />
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] font-extrabold block mb-1" style={{ color: 'var(--muted)' }}>Date jalon</label>
              <input
                type="date"
                value={msDate}
                onChange={e => setMsDate(e.target.value)}
                className="inp text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-extrabold block mb-1" style={{ color: 'var(--muted)' }}>Charge (h)</label>
              <input
                type="number"
                value={msHours}
                onChange={e => setMsHours(parseInt(e.target.value) || 10)}
                min="1"
                max="100"
                className="inp text-xs font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] font-extrabold block mb-1" style={{ color: 'var(--muted)' }}>Effort cognitif</label>
              <select
                value={msCognitive}
                onChange={e => setMsCognitive(e.target.value as CognitiveLoad)}
                className="inp text-xs font-bold"
              >
                <option value="high">🧠 Arch / High</option>
                <option value="medium">⚙️ Dev / Mid</option>
                <option value="low">📝 Doc / Low</option>
              </select>
            </div>
          </div>
          <button type="submit" className="btn-main w-full text-xs py-2.5 font-extrabold">
            ＋ Enregistrer le jalon
          </button>
        </form>
      )}
    </div>
  );
};
