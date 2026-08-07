import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Project, CognitiveLoad } from '../../types';
import { Layers, Trash2, X, Link, Flame, ChevronDown, ChevronUp, Plus, Calendar, Clock } from 'lucide-react';

const todayISO = new Date().toISOString().split('T')[0];

interface ProjectWBSCardProps {
  projects: Project[];
  onAddProject: (name: string, code: string, deadline: string, isHardDeadline: boolean, startDate?: string) => void;
  onAddMilestone: (projId: string, title: string, dueDate: string, estimatedHours: number, cognitiveLoad: CognitiveLoad, dependsOn?: string[], startDate?: string) => void;
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
  // Mobile UI States
  const [selectedFilterProjectId, setSelectedFilterProjectId] = useState<string>('all');
  const [expandedProjectIds, setExpandedProjectIds] = useState<Record<string, boolean>>(() => {
    // Par défaut, étendre le 1er projet s'il existe
    if (projects.length > 0) return { [projects[0].id]: true };
    return {};
  });

  // Modal / Bottom Sheet States
  const [showProjModal, setShowProjModal] = useState(false);
  const [activeProjForMs, setActiveProjForMs] = useState<Project | null>(null);

  // New Project Form State
  const [projName, setProjName] = useState('');
  const [projCode, setProjCode] = useState('');
  const [projStartDate, setProjStartDate] = useState(todayISO);
  const [projDeadline, setProjDeadline] = useState('');
  const [projType, setProjType] = useState<'hard' | 'soft'>('hard');

  // New Milestone Form State
  const [msTitle, setMsTitle] = useState('');
  const [msStartDate, setMsStartDate] = useState(todayISO);
  const [msDate, setMsDate] = useState('');
  const [msHours, setMsHours] = useState(10);
  const [msCognitive, setMsCognitive] = useState<CognitiveLoad>('medium');
  const [selectedParentId, setSelectedParentId] = useState<string>('');

  const toggleProjectExpand = (projId: string) => {
    setExpandedProjectIds(prev => ({
      ...prev,
      [projId]: !prev[projId]
    }));
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projName.trim()) return;
    onAddProject(projName.trim(), projCode.trim() || 'PRJ', projDeadline, projType === 'hard', projStartDate);
    setProjName('');
    setProjCode('');
    setProjStartDate(todayISO);
    setProjDeadline('');
    setShowProjModal(false);
  };

  const handleCreateMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProjForMs || !msTitle.trim()) return;
    const dependsOn = selectedParentId ? [selectedParentId] : [];
    onAddMilestone(activeProjForMs.id, msTitle.trim(), msDate, msHours, msCognitive, dependsOn, msStartDate);
    setMsTitle('');
    setMsStartDate(todayISO);
    setMsDate('');
    setSelectedParentId('');
    setActiveProjForMs(null);
  };

  // Universal Effort Badges
  const cogBadges: Record<CognitiveLoad, React.ReactNode> = {
    high: <span className="px-2 py-0.5 rounded-full text-[10px] font-black shrink-0" style={{ background: 'rgba(107,70,193,0.15)', color: 'var(--plum)' }}>🧠 Stratégie</span>,
    medium: <span className="px-2 py-0.5 rounded-full text-[10px] font-black shrink-0" style={{ background: 'var(--terra-l)', color: 'var(--terra)' }}>⚙️ Exécution</span>,
    low: <span className="px-2 py-0.5 rounded-full text-[10px] font-black shrink-0" style={{ background: 'var(--sage-l)', color: 'var(--sage)' }}>📝 Logistique</span>
  };

  // Filtrage des projets
  const filteredProjects = selectedFilterProjectId === 'all'
    ? projects
    : projects.filter(p => p.id === selectedFilterProjectId);

  return (
    <div className="card p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-extrabold text-lg md:text-xl flex items-center gap-2.5" style={{ color: 'var(--text)' }}>
          <span className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0" style={{ background: '#DDF2ED', color: 'var(--terra)' }}>
            <Layers className="w-5 h-5" />
          </span>
          Projets &amp; Jalons (WBS)
        </h2>
        <button
          onClick={() => setShowProjModal(true)}
          className="btn-main text-xs py-2 px-3 flex items-center gap-1 font-extrabold shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Projet</span>
        </button>
      </div>

      {/* Pilules de filtrage par projet (Horizontal Scroll UI) */}
      {projects.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 pt-1 -mx-1 px-1">
          <button
            onClick={() => setSelectedFilterProjectId('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold shrink-0 transition-all ${selectedFilterProjectId === 'all' ? 'shadow-sm' : ''}`}
            style={{
              background: selectedFilterProjectId === 'all' ? 'var(--terra)' : 'var(--bg)',
              color: selectedFilterProjectId === 'all' ? '#FFFFFF' : 'var(--muted)',
              border: '1px solid var(--border)'
            }}
          >
            Tous ({projects.length})
          </button>

          {projects.map(proj => {
            const isSelected = selectedFilterProjectId === proj.id;
            return (
              <button
                key={proj.id}
                onClick={() => setSelectedFilterProjectId(proj.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold shrink-0 flex items-center gap-1.5 transition-all ${isSelected ? 'shadow-sm' : ''}`}
                style={{
                  background: isSelected ? 'var(--terra)' : 'var(--bg)',
                  color: isSelected ? '#FFFFFF' : 'var(--text)',
                  border: '1px solid var(--border)'
                }}
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: proj.color }}></span>
                <span>{proj.code}</span>
                <span className="opacity-70 text-[10px]">({proj.milestones.length})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Projects List with Collapsible Accordions & Lazy Milestone Rendering */}
      <div className="space-y-3">
        {projects.length === 0 ? (
          <div className="text-center py-8 space-y-3 rounded-2xl p-4" style={{ background: 'var(--bg)', border: '1px border-dashed var(--border)' }}>
            <p className="text-xs font-extrabold" style={{ color: 'var(--muted)' }}>
              Aucun projet configuré
            </p>
            <button onClick={() => setShowProjModal(true)} className="btn-main text-xs py-2 px-4 font-extrabold inline-flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              Créer votre premier projet
            </button>
          </div>
        ) : (
          filteredProjects.map(proj => {
            const isExpanded = !!expandedProjectIds[proj.id];

            // Calcul du taux de réussite/progression
            const totalMs = proj.milestones.length;
            const completedCount = 0;
            const progressPercent = totalMs > 0 ? Math.round((completedCount / totalMs) * 100) : 0;

            const hardBadge = proj.isHardDeadline ? (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-black shrink-0" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>🔴 Ferme</span>
            ) : (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-black shrink-0" style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>🔵 Filée</span>
            );

            return (
              <div
                key={proj.id}
                className="rounded-2xl transition-all overflow-hidden"
                style={{ background: 'var(--bg)', border: '1.5px solid var(--border)' }}
              >
                {/* Accordion Header */}
                <div className="p-3.5 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    {/* Touch Area to Toggle Expand */}
                    <button
                      onClick={() => toggleProjectExpand(proj.id)}
                      className="flex items-center gap-2 min-w-0 text-left flex-grow cursor-pointer group"
                    >
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ background: proj.color }}></div>
                      <span className="font-extrabold text-sm truncate group-hover:text-teal-600 transition-colors" style={{ color: 'var(--text)' }}>
                        {proj.name}
                      </span>
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded shrink-0" style={{ background: 'var(--terra-l)', color: 'var(--terra)' }}>
                        {proj.code}
                      </span>
                      {hardBadge}
                    </button>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setActiveProjForMs(proj)}
                        className="btn-soft text-[11px] py-1 px-2.5 font-extrabold flex items-center gap-1"
                        title="Ajouter un Jalon"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Jalon</span>
                      </button>
                      <button
                        onClick={() => onDeleteProject(proj.id)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-red-500/10 hover:text-red-500 text-xs transition-all"
                        style={{ color: 'var(--muted)' }}
                        title="Supprimer Projet"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toggleProjectExpand(proj.id)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center transition-transform duration-200"
                        style={{ color: 'var(--terra)' }}
                        aria-label="Toggle Accordion"
                      >
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Progress & Milestone Count Indicator */}
                  <div
                    onClick={() => toggleProjectExpand(proj.id)}
                    className="flex items-center gap-3 cursor-pointer pt-1"
                  >
                    <div className="flex-grow bg-black/5 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.max(progressPercent, totalMs > 0 ? 15 : 0)}%`,
                          background: proj.color || 'var(--terra)'
                        }}
                      ></div>
                    </div>
                    <span className="text-[10px] font-bold shrink-0" style={{ color: 'var(--muted)' }}>
                      {totalMs === 0 ? 'Aucun jalon' : `${totalMs} jalon${totalMs > 1 ? 's' : ''}`}
                    </span>
                  </div>
                </div>

                {/* Accordion Content : RENDU LAZY OPTIMISÉ GPU (Unmounted when collapsed) */}
                {isExpanded && (
                  <div className="px-3.5 pb-3.5 pt-1 space-y-2 border-t" style={{ borderColor: 'var(--border)' }}>
                    {proj.milestones.length === 0 ? (
                      <div className="text-center py-4 space-y-2">
                        <p className="text-xs italic" style={{ color: 'var(--muted)' }}>
                          Aucun jalon dans ce projet
                        </p>
                        <button
                          onClick={() => setActiveProjForMs(proj)}
                          className="btn-soft text-xs py-1.5 px-3 font-bold inline-flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" /> Ajouter le premier jalon
                        </button>
                      </div>
                    ) : (
                      /* Timeline Vertical Stepper */
                      <div className="relative pl-3 space-y-3 pt-2">
                        {/* Ligne verticale de connexion timeline */}
                        <div className="absolute left-[15px] top-3 bottom-3 w-0.5 bg-teal-500/20 rounded-full"></div>

                        {proj.milestones.map((ms, index) => {
                          const isCritical = ms.isCriticalPath;
                          const hasParent = ms.dependsOn && ms.dependsOn.length > 0;
                          const parentMs = hasParent ? proj.milestones.find(p => p.id === ms.dependsOn![0]) : null;

                          return (
                            <div
                              key={ms.id}
                              className={`relative flex items-start gap-3 p-3 rounded-2xl text-xs transition-all ${isCritical ? 'ring-1 ring-red-500/40 bg-red-500/5' : ''}`}
                              style={{
                                background: isCritical ? undefined : 'var(--bg-card)',
                                border: '1px solid var(--border)'
                              }}
                            >
                              {/* Stepper Node Number */}
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center font-black text-[11px] shrink-0 z-10 shadow-sm"
                                style={{
                                  background: isCritical ? '#ef4444' : 'var(--terra)',
                                  color: '#FFFFFF'
                                }}
                              >
                                {index + 1}
                              </div>

                              {/* Milestone Content */}
                              <div className="min-w-0 flex-grow space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-extrabold text-xs" style={{ color: 'var(--text)' }}>
                                    {ms.title}
                                  </span>
                                  <button
                                    onClick={() => onDeleteMilestone(proj.id, ms.id)}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-500/10 hover:text-red-500 transition-all shrink-0"
                                    style={{ color: 'var(--muted)' }}
                                    title="Supprimer jalon"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>

                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {cogBadges[ms.cognitiveLoad]}
                                  {isCritical && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 flex items-center gap-1" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                                      <Flame className="w-3 h-3 text-red-500" />
                                      Chemin Critique
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-3 text-[11px] pt-0.5 flex-wrap" style={{ color: 'var(--muted)' }}>
                                  <span className="flex items-center gap-1 font-bold">
                                    <Clock className="w-3.5 h-3.5 text-teal-600" />
                                    {ms.estimatedHours}h estimées
                                  </span>
                                  {ms.dueDate && (
                                    <span className="flex items-center gap-1 font-bold">
                                      <Calendar className="w-3.5 h-3.5 text-teal-600" />
                                      {ms.dueDate}
                                    </span>
                                  )}
                                  {parentMs && (
                                    <span className="flex items-center gap-1 text-teal-600 font-extrabold" title={`Dépend de : ${parentMs.title}`}>
                                      <Link className="w-3 h-3" />
                                      Après : {parentMs.title}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* iOS BOTTOM SHEET MODAL — Nouveau Projet */}
      {typeof document !== 'undefined' && createPortal(
        <>
          <div
            className={`bottom-sheet-backdrop ${showProjModal ? 'active' : ''}`}
            onClick={() => setShowProjModal(false)}
          />
          <div className={`bottom-sheet-modal ${showProjModal ? 'active' : ''}`}>
            <div className="w-12 h-1.5 bg-black/15 dark:bg-white/20 rounded-full mx-auto mb-4"></div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold flex items-center gap-2" style={{ color: 'var(--text)' }}>
                <Layers className="w-5 h-5" style={{ color: 'var(--terra)' }} />
                Nouveau Projet Universel
              </h3>
              <button
                onClick={() => setShowProjModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5"
                style={{ color: 'var(--muted)' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-xs font-extrabold block mb-1" style={{ color: 'var(--muted)' }}>Nom du Projet</label>
                  <input
                    type="text"
                    value={projName}
                    onChange={e => setProjName(e.target.value)}
                    placeholder="ex: Potager Bio, Financement"
                    className="inp text-xs h-11"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-extrabold block mb-1" style={{ color: 'var(--muted)' }}>Code (3-4 lettres)</label>
                  <input
                    type="text"
                    value={projCode}
                    onChange={e => setProjCode(e.target.value)}
                    placeholder="AGRI"
                    className="inp text-xs uppercase h-11"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-extrabold block mb-1" style={{ color: 'var(--muted)' }}>Date de Début</label>
                  <input
                    type="date"
                    value={projStartDate}
                    onChange={e => setProjStartDate(e.target.value)}
                    className="inp text-xs h-11"
                  />
                </div>
                <div>
                  <label className="text-xs font-extrabold block mb-1" style={{ color: 'var(--muted)' }}>Échéance Globale</label>
                  <input
                    type="date"
                    value={projDeadline}
                    onChange={e => setProjDeadline(e.target.value)}
                    className="inp text-xs h-11"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-extrabold block mb-1" style={{ color: 'var(--muted)' }}>Type d'Échéance</label>
                <select
                  value={projType}
                  onChange={e => setProjType(e.target.value as 'hard' | 'soft')}
                  className="inp text-xs font-bold h-11"
                >
                  <option value="hard">🔴 Ferme (Impérative - ex: examen, date limite de dépôt)</option>
                  <option value="soft">🔵 Filée (Souple - ex: objectif personnel)</option>
                </select>
              </div>

              <button type="submit" className="btn-main w-full text-sm h-12 font-extrabold mt-2 flex items-center justify-center gap-2">
                <Plus className="w-5 h-5" />
                Créer le Projet
              </button>
            </form>
          </div>
        </>,
        document.body
      )}

      {/* iOS BOTTOM SHEET MODAL — Nouveau Jalon WBS */}
      {typeof document !== 'undefined' && createPortal(
        <>
          <div
            className={`bottom-sheet-backdrop ${activeProjForMs ? 'active' : ''}`}
            onClick={() => setActiveProjForMs(null)}
          />
          <div className={`bottom-sheet-modal ${activeProjForMs ? 'active' : ''}`}>
            <div className="w-12 h-1.5 bg-black/15 dark:bg-white/20 rounded-full mx-auto mb-4"></div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-extrabold flex items-center gap-2" style={{ color: 'var(--text)' }}>
                  <Plus className="w-5 h-5" style={{ color: 'var(--terra)' }} />
                  Ajouter un Jalon WBS
                </h3>
                <p className="text-xs font-bold" style={{ color: 'var(--terra)' }}>
                  Projet : {activeProjForMs?.name} ({activeProjForMs?.code})
                </p>
              </div>
              <button
                onClick={() => setActiveProjForMs(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5"
                style={{ color: 'var(--muted)' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMilestone} className="space-y-4">
              <div>
                <label className="text-xs font-extrabold block mb-1" style={{ color: 'var(--muted)' }}>Intitulé du Jalon</label>
                <input
                  type="text"
                  value={msTitle}
                  onChange={e => setMsTitle(e.target.value)}
                  placeholder="ex: Système d'irrigation, Levée de fonds Série A"
                  className="inp text-xs h-11"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-extrabold block mb-1" style={{ color: 'var(--muted)' }}>Date Début</label>
                  <input
                    type="date"
                    value={msStartDate}
                    onChange={e => setMsStartDate(e.target.value)}
                    className="inp text-xs h-11"
                  />
                </div>
                <div>
                  <label className="text-xs font-extrabold block mb-1" style={{ color: 'var(--muted)' }}>Date Échéance Jalon</label>
                  <input
                    type="date"
                    value={msDate}
                    onChange={e => setMsDate(e.target.value)}
                    className="inp text-xs h-11"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-extrabold block mb-1" style={{ color: 'var(--muted)' }}>Charge Estimée (heures)</label>
                  <input
                    type="number"
                    value={msHours}
                    onChange={e => setMsHours(parseInt(e.target.value) || 10)}
                    min="1"
                    max="200"
                    className="inp text-xs font-bold h-11"
                  />
                </div>
                <div>
                  <label className="text-xs font-extrabold block mb-1" style={{ color: 'var(--muted)' }}>Niveau d'Effort Requis</label>
                  <select
                    value={msCognitive}
                    onChange={e => setMsCognitive(e.target.value as CognitiveLoad)}
                    className="inp text-xs font-bold h-11"
                  >
                    <option value="high">🧠 Stratégie</option>
                    <option value="medium">⚙️ Exécution</option>
                    <option value="low">📝 Logistique</option>
                  </select>
                </div>
              </div>

              {/* Séquençage / Dépendance DAG */}
              {activeProjForMs && activeProjForMs.milestones.length > 0 && (
                <div>
                  <label className="text-xs font-extrabold block mb-1" style={{ color: 'var(--muted)' }}>
                    🔗 Dépendance obligatoire (Séquençage DAG) :
                  </label>
                  <select
                    value={selectedParentId}
                    onChange={e => setSelectedParentId(e.target.value)}
                    className="inp text-xs font-bold h-11"
                  >
                    <option value="">Aucune (Démarre immédiatement)</option>
                    {activeProjForMs.milestones.map(m => (
                      <option key={m.id} value={m.id}>
                        🔒 Après : {m.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button type="submit" className="btn-main w-full text-sm h-12 font-extrabold mt-2 flex items-center justify-center gap-2">
                <Plus className="w-5 h-5" />
                Enregistrer le Jalon
              </button>
            </form>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};
