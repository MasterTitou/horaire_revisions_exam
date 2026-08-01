import React, { useState } from 'react';
import { Gamification, StudyDomain, DomainCategory } from '../../types';
import { BADGE_DEFINITIONS, calculateLevelAndTitle, evaluateDomainMastery } from '../../engine/gamificationEngine';
import { DomainRadarChart } from './DomainRadarChart';
import { Zap, Target, BookOpen, Layers, RotateCcw, AlertTriangle, Download, Upload, Award, Sparkles, Clock, ShieldCheck, Plus, Archive, RefreshCw, X, Edit3, Settings } from 'lucide-react';

interface ProfileTabProps {
  gamification: Gamification;
  onResetData: () => void;
  onExportData?: () => void;
  onImportData?: (json: string) => boolean;
  onAddCustomDomain?: (name: string, category: DomainCategory, color: string, icon: string, keywords?: string[]) => void;
  onUpdateDomain?: (id: string, updates: Partial<StudyDomain>) => void;
  onArchiveDomain?: (id: string) => void;
  onRestoreDomain?: (id: string) => void;
  isDarkMode?: boolean;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
  gamification,
  onResetData,
  onExportData,
  onImportData,
  onAddCustomDomain,
  onUpdateDomain,
  onArchiveDomain,
  onRestoreDomain,
  isDarkMode = false
}) => {
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [badgeFilter, setBadgeFilter] = useState<'all' | 'unlocked' | 'discipline'>('all');
  const [viewMode, setViewMode] = useState<'radar' | 'grid'>('radar');
  const [showDomainModal, setShowDomainModal] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  // Modal State pour création de domaine personnalisé
  const [newDomainName, setNewDomainName] = useState('');
  const [newDomainCat, setNewDomainCat] = useState<DomainCategory>('Custom');
  const [newDomainColor, setNewDomainColor] = useState('#3B82F6');
  const [newDomainIcon, setNewDomainIcon] = useState('🎓');
  const [newDomainKeywords, setNewDomainKeywords] = useState('');

  const velocity = gamification.velocityIndex || 100;
  const levelInfo = calculateLevelAndTitle(gamification.xp || 0);

  const allSkills = Object.values(gamification.skills || {});
  const activeSkills = allSkills.filter(s => !s.archived);
  const archivedSkills = allSkills.filter(s => s.archived);
  const displayedSkillsInGrid = showArchived ? allSkills : activeSkills;

  const unlockedMap = new Map((gamification.unlockedBadges || []).map(b => [b.badgeId, b]));

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImportData) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          const ok = onImportData(text);
          if (ok) alert("Sauvegarde importée avec succès !");
        }
      };
      reader.readAsText(file);
    }
  };

  const handleCreateDomain = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomainName.trim()) return;

    const kwArray = newDomainKeywords
      .split(',')
      .map(k => k.trim())
      .filter(Boolean);

    if (onAddCustomDomain) {
      onAddCustomDomain(newDomainName.trim(), newDomainCat, newDomainColor, newDomainIcon, kwArray);
      setNewDomainName('');
      setNewDomainKeywords('');
    }
  };

  const filteredBadges = BADGE_DEFINITIONS.filter(def => {
    if (badgeFilter === 'unlocked') return unlockedMap.has(def.id);
    if (badgeFilter === 'discipline') return def.category === 'discipline' || def.category === 'resilience';
    return true;
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-8">
      {/* Top Identity & Progression Banner */}
      <div className="card p-6 relative overflow-hidden" style={{ borderLeft: '6px solid var(--terra)' }}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-black bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-500/20">
                {levelInfo.title}
              </span>
              <span className="text-xs font-extrabold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Niv. {levelInfo.level}
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-gray-100 flex items-center gap-2">
              Progression Ascension : <span style={{ color: 'var(--terra)' }}>{gamification.xp || 0} XP</span>
            </h2>

            {/* Level XP Progress Bar */}
            <div className="space-y-1.5 pt-1 max-w-md">
              <div className="flex justify-between text-xs font-bold text-gray-500 dark:text-gray-400">
                <span>Vers Niveau {levelInfo.level + 1}</span>
                <span>{levelInfo.xpInCurrentLevel} / 400 XP ({levelInfo.progressPct}%)</span>
              </div>
              <div className="prog-track h-3 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div
                  className="prog-fill h-full rounded-full transition-all duration-500"
                  style={{ width: `${levelInfo.progressPct}%`, background: 'linear-gradient(90deg, var(--terra), var(--sage))' }}
                />
              </div>
            </div>
          </div>

          {/* Action buttons & Velocity Badge */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="px-4 py-2.5 rounded-2xl flex items-center gap-2 shrink-0" style={{ background: 'var(--terra-l)', border: '1px solid var(--border)' }}>
              <Zap className="w-5 h-5" style={{ color: 'var(--terra)' }} />
              <span className="font-black text-xs" style={{ color: 'var(--terra)' }}>{velocity}% Vélocité WBS</span>
            </div>

            {onExportData && (
              <button
                onClick={onExportData}
                className="p-2.5 rounded-2xl border hover:border-teal-500 hover:text-teal-600 transition-colors text-gray-600 dark:text-gray-300 bg-card shrink-0 flex items-center gap-1.5 text-xs font-extrabold"
                title="Exporter la sauvegarde JSON"
              >
                <Download className="w-4 h-4" /> Exporter JSON
              </button>
            )}

            {onImportData && (
              <label className="p-2.5 rounded-2xl border hover:border-teal-500 hover:text-teal-600 transition-colors text-gray-600 dark:text-gray-300 bg-card shrink-0 flex items-center gap-1.5 text-xs font-extrabold cursor-pointer">
                <Upload className="w-4 h-4" /> Importer
                <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
              </label>
            )}

            <button
              onClick={() => setShowConfirmReset(true)}
              className="p-2.5 rounded-2xl border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 transition-colors bg-card shrink-0"
              title="Réinitialiser les données"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation de réinitialisation */}
      {showConfirmReset && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
            <p className="text-xs font-extrabold text-red-800 dark:text-red-300">
              Voulez-vous réinitialiser toutes les données (projets, séances, expérience) ?
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowConfirmReset(false)}
              className="px-3 py-1.5 text-xs font-bold rounded-xl border border-gray-300 dark:border-gray-600"
            >
              Annuler
            </button>
            <button
              onClick={() => {
                onResetData();
                setShowConfirmReset(false);
              }}
              className="px-3 py-1.5 text-xs font-bold rounded-xl bg-red-600 text-white"
            >
              Confirmer
            </button>
          </div>
        </div>
      )}

      {/* Ontologie de Domaines Header & Controls */}
      <div className="card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h3 className="font-extrabold text-lg flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <BookOpen className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              Arbre des Domaines de Compétences
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-bold mt-0.5">
              Modèle Hybride : Socle Curaté Systèmes &amp; Domaines Personnalisés
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View Switcher Toggle */}
            <div className="flex items-center p-1 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setViewMode('radar')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                  viewMode === 'radar'
                    ? 'bg-card text-teal-600 dark:text-teal-400 shadow-xs'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                📊 Radar Synthétique
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                  viewMode === 'grid'
                    ? 'bg-card text-teal-600 dark:text-teal-400 shadow-xs'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                🗂️ Grille Complète
              </button>
            </div>

            {/* Manage Domains Modal Button */}
            <button
              onClick={() => setShowDomainModal(true)}
              className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Settings className="w-4 h-4" /> Gérer l'Ontologie
            </button>
          </div>
        </div>

        {/* Dynamic Display based on viewMode */}
        {viewMode === 'radar' ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-bold px-1">
              <span>Vue Synthétique (Top-8 Domaines Principaux)</span>
              <span>{activeSkills.length} Domaines Actifs</span>
            </div>
            <DomainRadarChart skills={gamification.skills || {}} isDarkMode={isDarkMode} />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-gray-500 dark:text-gray-400">
                Affichage de {displayedSkillsInGrid.length} Domaine(s)
              </span>

              {archivedSkills.length > 0 && (
                <button
                  onClick={() => setShowArchived(!showArchived)}
                  className="text-xs font-extrabold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
                >
                  <Archive className="w-3.5 h-3.5" />
                  {showArchived ? 'Masquer les archivés' : `Voir les ${archivedSkills.length} archivé(s)`}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {displayedSkillsInGrid.map(skill => {
                const mastery = evaluateDomainMastery(skill.hoursSpent);

                return (
                  <div
                    key={skill.id}
                    className={`p-4 rounded-2xl space-y-3 border transition-all ${
                      skill.archived
                        ? 'opacity-60 bg-gray-100/50 dark:bg-gray-900/40 border-dashed border-gray-300 dark:border-gray-700'
                        : 'bg-gray-50/50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700/80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span
                          className="text-2xl p-2 rounded-xl bg-card border shadow-xs"
                          style={{ borderColor: skill.color || 'var(--border)' }}
                        >
                          {skill.icon}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-black text-sm text-gray-900 dark:text-gray-100">{skill.name}</h4>
                            {skill.archived && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                Archivé
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-bold text-teal-600 dark:text-teal-400">
                            🎓 {mastery.currentTier}
                          </span>
                        </div>
                      </div>

                      <span className="px-2.5 py-1 rounded-full text-xs font-black" style={{ background: 'var(--terra-l)', color: 'var(--terra)' }}>
                        Niv. {mastery.level}
                      </span>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between text-xs font-bold text-gray-500 dark:text-gray-400">
                        <span>⏱ {skill.hoursSpent}h accumulées</span>
                        <span>
                          {mastery.hoursRemainingInTier > 0
                            ? `Reste ${Math.round(mastery.hoursRemainingInTier)}h`
                            : 'Palier Maître'}
                        </span>
                      </div>

                      <div className="prog-track h-2.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                        <div
                          className="prog-fill h-full rounded-full transition-all duration-300"
                          style={{ width: `${mastery.tierProgressPct}%`, backgroundColor: skill.color || 'var(--terra)' }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Trophy Room (Badges O(1)) */}
      <div className="card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-3" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h3 className="font-extrabold text-lg flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <Award className="w-5 h-5 text-amber-500" />
              Salle des Hauts Faits &amp; Discipline WBS
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-bold mt-0.5">
              Déblocage O(1) basé sur la résilience et la régularité.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setBadgeFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all ${
                badgeFilter === 'all'
                  ? 'bg-card text-teal-600 dark:text-teal-400 shadow-xs'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Tous
            </button>
            <button
              onClick={() => setBadgeFilter('unlocked')}
              className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all ${
                badgeFilter === 'unlocked'
                  ? 'bg-card text-teal-600 dark:text-teal-400 shadow-xs'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Débloqués ({unlockedMap.size})
            </button>
          </div>
        </div>

        {/* Badge Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredBadges.map(badge => {
            const isUnlocked = unlockedMap.has(badge.id);

            return (
              <div
                key={badge.id}
                className={`p-4 rounded-2xl space-y-2 border transition-all ${
                  isUnlocked
                    ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-300/80 dark:border-amber-900/60 shadow-xs'
                    : 'bg-gray-50/50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700/80 opacity-70'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl p-2 rounded-xl bg-card border border-gray-200 dark:border-gray-700 shadow-xs">{badge.icon}</span>
                    <div>
                      <h4 className="font-black text-sm text-gray-900 dark:text-gray-100">{badge.title}</h4>
                      <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400">
                        {badge.description}
                      </span>
                    </div>
                  </div>
                  {isUnlocked && (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-500 text-white shadow-xs">
                      Obtenu
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL : GESTION DE L'ONTOLOGIE DES DOMAINES */}
      {showDomainModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="card max-w-xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <h3 className="font-black text-lg text-gray-900 dark:text-gray-100">
                  Ontologie &amp; Domaines Personnalisés
                </h3>
              </div>
              <button
                onClick={() => setShowDomainModal(false)}
                className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulaire de création de Domaine */}
            <form onSubmit={handleCreateDomain} className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 space-y-4">
              <h4 className="font-black text-sm text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Plus className="w-4 h-4 text-teal-600" /> Ajouter un Domaine Personnalisé
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 dark:text-gray-300">Nom du Domaine</label>
                  <input
                    type="text"
                    required
                    placeholder="ex: Théorie Musicale"
                    value={newDomainName}
                    onChange={e => setNewDomainName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs border border-gray-300 dark:border-gray-600 bg-card text-gray-900 dark:text-gray-100 font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 dark:text-gray-300">Catégorie</label>
                  <select
                    value={newDomainCat}
                    onChange={e => setNewDomainCat(e.target.value as DomainCategory)}
                    className="w-full px-3 py-2 rounded-xl text-xs border border-gray-300 dark:border-gray-600 bg-card text-gray-900 dark:text-gray-100 font-bold"
                  >
                    <option value="Custom">Personnalisé (Custom)</option>
                    <option value="STEM">Ingénierie &amp; Sciences (STEM)</option>
                    <option value="Humanities">Lettres &amp; Philosophie</option>
                    <option value="Arts">Arts &amp; Création</option>
                    <option value="Physical">Santé &amp; Performance</option>
                    <option value="Craft">Artisanat &amp; Organisation</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 dark:text-gray-300">Icône / Émoji</label>
                  <input
                    type="text"
                    required
                    value={newDomainIcon}
                    onChange={e => setNewDomainIcon(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs border border-gray-300 dark:border-gray-600 bg-card text-gray-900 dark:text-gray-100 font-bold text-center"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 dark:text-gray-300">Couleur Graphique</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={newDomainColor}
                      onChange={e => setNewDomainColor(e.target.value)}
                      className="w-10 h-9 rounded-xl border border-gray-300 dark:border-gray-600 bg-card cursor-pointer"
                    />
                    <input
                      type="text"
                      value={newDomainColor}
                      onChange={e => setNewDomainColor(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl text-xs border border-gray-300 dark:border-gray-600 bg-card text-gray-900 dark:text-gray-100 font-bold font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600 dark:text-gray-300">
                  Mots-clés d'Auto-matching (séparés par des virgules)
                </label>
                <input
                  type="text"
                  placeholder="ex: solfege, piano, harmonie, partition"
                  value={newDomainKeywords}
                  onChange={e => setNewDomainKeywords(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-gray-300 dark:border-gray-600 bg-card text-gray-900 dark:text-gray-100 font-bold"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs shadow-xs transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Créer le Domaine dans l'Ontologie
              </button>
            </form>

            {/* Liste des Domaines Existants & Actions (Archivage / Réactivation) */}
            <div className="space-y-3">
              <h4 className="font-black text-sm text-gray-900 dark:text-gray-100">
                Domaines Répertoriés ({allSkills.length})
              </h4>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {allSkills.map(skill => (
                  <div
                    key={skill.id}
                    className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/80 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl p-1.5 rounded-lg bg-card border" style={{ borderColor: skill.color || 'var(--border)' }}>
                        {skill.icon}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="font-extrabold text-xs text-gray-900 dark:text-gray-100">{skill.name}</h5>
                          {skill.isSystem && (
                            <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-blue-500/10 text-blue-600 dark:text-blue-400">
                              Système
                            </span>
                          )}
                          {skill.archived && (
                            <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-amber-500/10 text-amber-600 dark:text-amber-400">
                              Archivé
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400">
                          {skill.hoursSpent}h accumulées · Catégorie: {skill.category || 'Custom'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {skill.archived ? (
                        <button
                          onClick={() => onRestoreDomain && onRestoreDomain(skill.id)}
                          className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-teal-500/10 text-teal-600 hover:bg-teal-500/20 transition-colors flex items-center gap-1"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Restaurer
                        </button>
                      ) : (
                        <button
                          onClick={() => onArchiveDomain && onArchiveDomain(skill.id)}
                          className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-colors flex items-center gap-1"
                        >
                          <Archive className="w-3.5 h-3.5" /> Archiver
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
