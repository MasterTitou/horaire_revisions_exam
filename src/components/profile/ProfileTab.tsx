import React, { useState } from 'react';
import { Gamification } from '../../types';
import { Zap, Target, BookOpen, Layers, RotateCcw, AlertTriangle } from 'lucide-react';

interface ProfileTabProps {
  gamification: Gamification;
  onResetData: () => void;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({ gamification, onResetData }) => {
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  const velocity = gamification.velocityIndex || 100;
  const velocityLabel = velocity >= 90 ? '⚡ Rythme Optimal' : velocity >= 70 ? '📈 Exécution Régulière' : '⚠️ Réajustement Incurré';
  const velocityColor = velocity >= 85 ? 'var(--sage)' : velocity >= 60 ? 'var(--gold)' : '#E11D48';

  const skillsList = Object.values(gamification.skills || {});
  const questsList = gamification.quests || [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Banner: Velocity & Performance Metric */}
      <div className="card p-6 flex flex-col md:flex-row items-center justify-between gap-6" style={{ borderLeft: '6px solid var(--terra)' }}>
        <div className="space-y-1 text-center md:text-left">
          <span className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
            Métrique de Performance SaaS (14 jours glissants)
          </span>
          <h2 className="text-2xl font-black flex items-center justify-center md:justify-start gap-2" style={{ color: 'var(--text)' }}>
            Indice de Vélocité : <span style={{ color: velocityColor }}>{velocity}%</span>
          </h2>
          <p className="text-xs font-bold" style={{ color: 'var(--muted)' }}>
            Rapport exact entre le temps prévu dans le planning et les heures réellement complétées.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-5 py-3 rounded-2xl flex flex-col items-center justify-center shrink-0" style={{ background: 'var(--terra-l)', border: '1px solid var(--border)' }}>
            <Zap className="w-7 h-7 mb-1" style={{ color: 'var(--terra)' }} />
            <span className="font-black text-sm" style={{ color: 'var(--terra)' }}>{velocityLabel}</span>
          </div>

          <button
            onClick={() => setShowConfirmReset(true)}
            className="p-3 rounded-2xl border hover:border-red-500 hover:text-red-500 transition-colors text-gray-500 bg-card shrink-0 flex items-center gap-1.5 text-xs font-extrabold"
            title="Réinitialiser toutes les données & statistiques"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">Réinitialiser Stats</span>
          </button>
        </div>
      </div>

      {/* Arbre de Compétences par Domaine (Skill Tree) */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border)' }}>
          <h3 className="font-extrabold text-lg flex items-center gap-2" style={{ color: 'var(--text)' }}>
            <BookOpen className="w-5 h-5 text-teal-700" />
            Arbre de Compétences &amp; Maîtrise par Domaine
          </h3>
          <span className="text-xs font-extrabold px-2.5 py-1 rounded-full" style={{ background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
            Effort Cumulé
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {skillsList.map(skill => {
            const levelXp = skill.level * 10;
            const pct = Math.min(100, Math.round(((skill.hoursSpent % 10) / 10) * 100));

            return (
              <div key={skill.id} className="p-4 rounded-2xl space-y-2" style={{ background: 'var(--bg)', border: '1.5px solid var(--border)' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{skill.icon}</span>
                    <div>
                      <h4 className="font-extrabold text-sm" style={{ color: 'var(--text)' }}>{skill.name}</h4>
                      <span className="text-[10px] font-bold" style={{ color: 'var(--muted)' }}>⏱ {skill.hoursSpent}h pratiquées</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-black" style={{ background: 'var(--terra-l)', color: 'var(--terra)' }}>
                    Niv. {skill.level}
                  </span>
                </div>

                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[10px] font-extrabold" style={{ color: 'var(--muted)' }}>
                    <span>Progression</span>
                    <span>{pct}% vers Niv.{skill.level + 1}</span>
                  </div>
                  <div className="prog-track" style={{ height: '7px' }}>
                    <div className="prog-fill" style={{ width: `${pct}%`, background: 'var(--terra)' }}></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quêtes Dynamiques issues des Jalons WBS */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border)' }}>
          <h3 className="font-extrabold text-lg flex items-center gap-2" style={{ color: 'var(--text)' }}>
            <Target className="w-5 h-5 text-teal-700" />
            Quêtes Hebdomadaires (Jalons WBS)
          </h3>
          <span className="text-xs font-extrabold px-2.5 py-1 rounded-full" style={{ background: 'var(--terra-l)', color: 'var(--terra)' }}>
            Objectifs Urgents
          </span>
        </div>

        <div className="space-y-3">
          {questsList.length === 0 ? (
            <p className="text-center text-xs py-6" style={{ color: 'var(--muted)' }}>
              Aucune quête en cours. Ajoutez un projet et des jalons dans le planning !
            </p>
          ) : (
            questsList.map(q => (
              <div key={q.id} className="p-3.5 rounded-2xl flex items-center justify-between gap-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--terra-l)', color: 'var(--terra)' }}>
                    <Layers className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="block font-extrabold text-xs truncate" style={{ color: 'var(--text)' }}>
                      [{q.projectCode}] {q.title}
                    </span>
                    <span className="block text-[10px]" style={{ color: 'var(--muted)' }}>
                      Échéance: {q.dueDate || 'À venir'} · Target: {q.targetHours}h
                    </span>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <span className="text-xs font-black px-2.5 py-1 rounded-full" style={{ background: q.isCompleted ? 'var(--sage-l)' : 'var(--bg-card)', color: q.isCompleted ? 'var(--sage)' : 'var(--muted)', border: '1px solid var(--border)' }}>
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
              Réinitialiser les Statistiques &amp; Données ?
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
              Cette action remettra à zéro toutes vos statistiques, projets actuels et heures cumulées pour démarrer avec des données 100% neuves.
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
                Confirmer la Réinitialisation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
