import React, { useState } from 'react';
import { Gamification } from '../../types';
import { BADGE_DEFINITIONS, calculateLevelAndTitle, evaluateDomainMastery } from '../../engine/gamificationEngine';
import { DomainRadarChart } from './DomainRadarChart';
import { Zap, Target, BookOpen, Layers, RotateCcw, AlertTriangle, Download, Upload, Award, Sparkles, Clock, ShieldCheck } from 'lucide-react';

interface ProfileTabProps {
  gamification: Gamification;
  onResetData: () => void;
  onExportData?: () => void;
  onImportData?: (json: string) => boolean;
  isDarkMode?: boolean;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
  gamification,
  onResetData,
  onExportData,
  onImportData,
  isDarkMode = false
}) => {
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [badgeFilter, setBadgeFilter] = useState<'all' | 'unlocked' | 'discipline'>('all');

  const velocity = gamification.velocityIndex || 100;
  const velocityLabel = velocity >= 90 ? '⚡ Rythme Optimal' : velocity >= 70 ? '📈 Exécution Régulière' : '⚠️ Réajustement Incurré';
  const velocityColor = velocity >= 85 ? 'var(--sage)' : velocity >= 60 ? 'var(--gold)' : '#E11D48';

  const levelInfo = calculateLevelAndTitle(gamification.xp || 0);
  const skillsList = Object.values(gamification.skills || {});
  const questsList = gamification.quests || [];

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
                title="Exporter une sauvegarde JSON"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Exporter JSON</span>
              </button>
            )}

            {onImportData && (
              <label
                className="p-2.5 rounded-2xl border hover:border-teal-500 hover:text-teal-600 transition-colors text-gray-600 dark:text-gray-300 bg-card shrink-0 flex items-center gap-1.5 text-xs font-extrabold cursor-pointer"
                title="Importer une sauvegarde JSON"
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Importer JSON</span>
                <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
              </label>
            )}

            <button
              onClick={() => setShowConfirmReset(true)}
              className="p-2.5 rounded-2xl border hover:border-red-500 hover:text-red-500 transition-colors text-gray-500 bg-card shrink-0 flex items-center gap-1.5 text-xs font-extrabold"
              title="Réinitialiser toutes les données"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">Réinitialiser</span>
            </button>
          </div>
        </div>
      </div>

      {/* Domain Radar Chart Section */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h3 className="font-extrabold text-lg flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <BookOpen className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              Signature d'Expertise (Radar Normalisé 0-100%)
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-bold mt-0.5">
              Progression relative dans le palier actuel pour chaque domaine (comparaison équitable).
            </p>
          </div>
          <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-500/20 shrink-0">
            {skillsList.length} Domaines
          </span>
        </div>

        <DomainRadarChart skills={gamification.skills || {}} isDarkMode={isDarkMode} />
      </div>

      {/* Real-time Domain Mastery Cards */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border)' }}>
          <h3 className="font-extrabold text-lg flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <Clock className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            Heures Qualifiées &amp; Paliers de Maîtrise (20h / 100h / 500h / 1000h)
          </h3>
          <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
            Active Focus
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {skillsList.map(skill => {
            const mastery = evaluateDomainMastery(skill.hoursSpent);

            return (
              <div key={skill.id} className="p-4 rounded-2xl space-y-3 bg-gray-50/50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/80">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl p-2 rounded-xl bg-card border border-gray-200 dark:border-gray-700 shadow-xs">{skill.icon}</span>
                    <div>
                      <h4 className="font-black text-sm text-gray-900 dark:text-gray-100">{skill.name}</h4>
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
                    <span>⏱ {skill.hoursSpent}h réelles accumulées</span>
                    <span>
                      {mastery.hoursRemainingInTier > 0
                        ? `Reste ${Math.round(mastery.hoursRemainingInTier)}h`
                        : 'Palier Maître'}
                    </span>
                  </div>

                  <div className="prog-track h-2.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div
                      className="prog-fill h-full rounded-full transition-all duration-300"
                      style={{ width: `${mastery.tierProgressPct}%`, background: 'var(--terra)' }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
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
              Déblocage $O(1)$ basé sur la résilience et la régularité.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <button
              onClick={() => setBadgeFilter('all')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                badgeFilter === 'all'
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
              }`}
            >
              Tous ({BADGE_DEFINITIONS.length})
            </button>
            <button
              onClick={() => setBadgeFilter('unlocked')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                badgeFilter === 'unlocked'
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
              }`}
            >
              Débloqués ({unlockedMap.size})
            </button>
            <button
              onClick={() => setBadgeFilter('discipline')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                badgeFilter === 'discipline'
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
              }`}
            >
              Discipline
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {filteredBadges.map(badge => {
            const isUnlocked = unlockedMap.has(badge.id);
            const unlockedData = unlockedMap.get(badge.id);

            const tierColor = badge.tier === 'gold' ? 'border-amber-400 text-amber-500' : badge.tier === 'silver' ? 'border-gray-400 text-gray-400' : 'border-amber-700 text-amber-700';

            return (
              <div
                key={badge.id}
                className={`p-3.5 rounded-2xl flex items-start gap-3 transition-all ${
                  isUnlocked
                    ? 'bg-card border-2 shadow-xs'
                    : 'bg-gray-50/50 dark:bg-gray-800/20 border border-dashed border-gray-300 dark:border-gray-700 opacity-60'
                } ${tierColor}`}
              >
                <span className="text-2xl p-2 rounded-xl bg-gray-100 dark:bg-gray-800 shrink-0">{badge.icon}</span>
                <div className="space-y-0.5 min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-extrabold text-xs text-gray-900 dark:text-gray-100 truncate">
                      {badge.title}
                    </h4>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800">
                      {badge.tier}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    {badge.description}
                  </p>
                  {isUnlocked && unlockedData && (
                    <span className="inline-block text-[10px] font-bold text-teal-600 dark:text-teal-400 pt-0.5">
                      ✓ Débloqué le {new Date(unlockedData.unlockedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* WBS-backed Daily Quests */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border)' }}>
          <h3 className="font-extrabold text-lg flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <Target className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            Quêtes Quotidiennes d'Exécution (Extraites du WBS)
          </h3>
          <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-500/20">
            {questsList.filter(q => q.isCompleted).length} / {questsList.length} Complétées
          </span>
        </div>

        <div className="space-y-3">
          {questsList.length === 0 ? (
            <p className="text-center text-xs py-6 text-gray-500 dark:text-gray-400">
              Aucune quête en cours. Ajoutez un projet et des jalons dans le planning !
            </p>
          ) : (
            questsList.map(q => (
              <div key={q.id} className="p-3.5 rounded-2xl flex items-center justify-between gap-4 bg-gray-50/50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--terra-l)', color: 'var(--terra)' }}>
                    <Layers className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="block font-extrabold text-xs text-gray-900 dark:text-gray-100 truncate">
                      [{q.projectCode}] {q.title}
                    </span>
                    <span className="block text-[10px] text-gray-500 dark:text-gray-400 font-bold">
                      Échéance WBS: {q.dueDate || 'À venir'} · Effort Target: {q.targetHours}h · Reward: +{q.xpReward || 50} XP
                    </span>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <span className="text-xs font-black px-3 py-1 rounded-full border" style={{ background: q.isCompleted ? 'var(--sage-l)' : 'var(--bg-card)', color: q.isCompleted ? 'var(--sage)' : 'var(--muted)', borderColor: 'var(--border)' }}>
                    {q.isCompleted ? '✓ Livré' : 'En cours'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Confirmation Reset Modal */}
      {showConfirmReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="card p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center gap-2 text-red-500 font-extrabold text-base">
              <AlertTriangle className="w-5 h-5" />
              Réinitialiser les Données &amp; Progression ?
            </div>
            <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400">
              Cette action remettra à zéro toutes vos données d'XP, badges, projets et heures qualifiées.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowConfirmReset(false)}
                className="btn-ghost text-xs py-2 px-4 font-bold"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  onResetData();
                  setShowConfirmReset(false);
                }}
                className="py-2 px-4 rounded-xl text-xs font-black text-white bg-red-600 hover:bg-red-700 transition-colors"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
