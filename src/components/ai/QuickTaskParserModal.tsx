import React, { useState, useEffect } from 'react';
import { Sparkles, X, Check, AlertCircle, Clock, Plus, Trash2, Pencil } from 'lucide-react';
import { Project } from '../../types';

interface QuickTaskParserModalProps {
  isOpen: boolean;
  onClose: () => void;
  authToken: string;
  projects: Project[];
  onAddParsedTask: (parsedData: {
    projectId?: string;
    projectName: string;
    title: string;
    category: string;
    difficultyScore: number;
    estimatedHours: number;
    cognitiveLoad: 'low' | 'medium' | 'high';
    deadline: string;
    isHardDeadline: boolean;
    subtasks: string[];
  }) => void;
}

export const QuickTaskParserModal: React.FC<QuickTaskParserModalProps> = ({
  isOpen,
  onClose,
  authToken,
  projects,
  onAddParsedTask
}) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotaInfo, setQuotaInfo] = useState<{ used: number; limit: number } | null>(null);
  
  const [parsedResult, setParsedResult] = useState<any | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      fetchQuota();
    }
  }, [isOpen]);

  const fetchQuota = async () => {
    try {
      const res = await fetch('/api/ai?action=quota', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setQuotaInfo(data.lite);
      }
    } catch (e) {
      console.error('Erreur chargement quota:', e);
    }
  };

  if (!isOpen) return null;

  const handleParse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setError(null);
    setParsedResult(null);

    try {
      const res = await fetch('/api/ai?action=parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ prompt: prompt.trim() })
      });


      const data = await res.json();

      if (res.status === 429) {
        setError("Quota quotidien de parsing rapide Flash-Lite (500/j) atteint.");
        if (data.quotaUsage) setQuotaInfo(data.quotaUsage);
        return;
      }

      if (!res.ok || !data.success) {
        setError(data.error || "Échec du parsing de la tâche.");
        return;
      }

      const raw = data.data || {};
      setParsedResult({
        ...raw,
        title: raw.title || '',
        project_name: raw.project_name || 'Projet Principal',
        category: raw.category || 'Général',
        difficulty_score: Number(raw.difficulty_score) || 3,
        estimated_hours: Number(raw.estimated_hours) || 2,
        cognitive_load: (raw.cognitive_load === 'low' || raw.cognitive_load === 'high' || raw.cognitive_load === 'medium') ? raw.cognitive_load : 'medium',
        deadline: raw.deadline ? String(raw.deadline).split('T')[0] : '',
        is_hard_deadline: raw.is_hard_deadline !== false,
        subtasks: Array.isArray(raw.subtasks) ? raw.subtasks : []
      });
      if (data.quotaUsage) {
        setQuotaInfo(data.quotaUsage);
      }

      const matchingProj = projects.find(p => p.name.toLowerCase() === (data.data.project_name || '').toLowerCase());
      if (matchingProj) {
        setSelectedProjectId(matchingProj.id);
      } else {
        setSelectedProjectId('');
      }
    } catch (err) {
      console.error('Erreur QuickTaskParserModal:', err);
      setError("Impossible d'effectuer le parsing. Vérifiez votre connexion.");
    } finally {
      setLoading(false);
    }
  };

  const updateParsedField = (field: string, value: any) => {
    setParsedResult((prev: any) => (prev ? { ...prev, [field]: value } : prev));
  };

  const updateSubtask = (idx: number, value: string) => {
    setParsedResult((prev: any) => {
      if (!prev) return prev;
      const next = [...(prev.subtasks || [])];
      next[idx] = value;
      return { ...prev, subtasks: next };
    });
  };

  const removeSubtask = (idx: number) => {
    setParsedResult((prev: any) => {
      if (!prev) return prev;
      const next = (prev.subtasks || []).filter((_: string, i: number) => i !== idx);
      return { ...prev, subtasks: next };
    });
  };

  const addSubtask = () => {
    setParsedResult((prev: any) => {
      if (!prev) return prev;
      return { ...prev, subtasks: [...(prev.subtasks || []), ''] };
    });
  };

  const handleConfirmAdd = () => {
    if (!parsedResult) return;

    const cleanSubtasks = (parsedResult.subtasks || [])
      .map((s: string) => s.trim())
      .filter(Boolean);

    onAddParsedTask({
      projectId: selectedProjectId || undefined,
      projectName: (parsedResult.project_name || '').trim() || 'Projet Principal',
      title: (parsedResult.title || '').trim() || 'Nouvelle tâche',
      category: (parsedResult.category || '').trim() || 'Général',
      difficultyScore: Math.min(5, Math.max(1, Number(parsedResult.difficulty_score) || 3)),
      estimatedHours: Math.max(0.5, Number(parsedResult.estimated_hours) || 1),
      cognitiveLoad: parsedResult.cognitive_load || 'medium',
      deadline: parsedResult.deadline || new Date().toISOString().split('T')[0],
      isHardDeadline: !!parsedResult.is_hard_deadline,
      subtasks: cleanSubtasks
    });

    onClose();
    setPrompt('');
    setParsedResult(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="card max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl relative border" style={{ background: 'var(--bg-card, #ffffff)', borderColor: 'var(--border)' }}>
        
        {/* En-tête avec bouton fermeture */}
        <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base">Saisie Rapide IA (Flash-Lite)</h3>
              <p className="text-xs text-muted-foreground">Parsing sémantique instantané en 1 clic</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-black/5 text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Badge Quotas Flash-Lite */}
        {quotaInfo && (
          <div className="flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-semibold" style={{ background: 'var(--terra-l, #f0fdf4)', color: '#0E8478' }}>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Quota Flash-Lite Quotidien</span>
            </span>
            <span className="font-bold">
              {quotaInfo.used} / {quotaInfo.limit} req (Reste: {Math.max(0, quotaInfo.limit - quotaInfo.used)})
            </span>
          </div>
        )}

        {/* Message d'erreur */}
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Formulaire de prompt */}
        {!parsedResult ? (
          <form onSubmit={handleParse} className="space-y-3">
            <div>
              <label className="block text-xs font-bold mb-1">Décrivez votre tâche ou projet en langage naturel :</label>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                rows={3}
                placeholder="Ex: Réviser l'algorithme CPM et les DAG pour le contrôle final du 15 mai, environ 8h de boulot très dur"
                className="inp text-xs w-full p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="btn-sec text-xs px-4 py-2">
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading || !prompt.trim()}
                className="btn-main text-xs px-4 py-2 flex items-center gap-1.5"
              >
                {loading ? (
                  <span>Parsing en cours...</span>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Parser avec Flash-Lite</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* Prévisualisation éditable et validation du résultat parsé */
          <div className="space-y-4">
            <div className="p-4 rounded-2xl border space-y-3 text-xs" style={{ background: 'var(--bg, #f8fafc)', borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between text-[11px] font-bold text-teal-600">
                <span className="flex items-center gap-1.5">
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Vérifiez et modifiez directement les champs si besoin :</span>
                </span>
              </div>

              {/* Intitulé de la tâche */}
              <div>
                <label className="block text-[11px] font-bold mb-1 opacity-75">Intitulé de la tâche / jalon</label>
                <input
                  type="text"
                  value={parsedResult.title || ''}
                  onChange={e => updateParsedField('title', e.target.value)}
                  className="inp text-xs font-bold w-full p-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Titre de la tâche..."
                />
              </div>

              {/* Heures estimées, Charge mentale, Difficulté */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold mb-1 opacity-75">Heures estimées</label>
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={parsedResult.estimated_hours ?? 1}
                    onChange={e => updateParsedField('estimated_hours', parseFloat(e.target.value) || 0.5)}
                    className="inp text-xs font-bold w-full p-2 rounded-xl border"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold mb-1 opacity-75">Charge mentale</label>
                  <select
                    value={parsedResult.cognitive_load || 'medium'}
                    onChange={e => updateParsedField('cognitive_load', e.target.value)}
                    className="inp text-xs font-bold w-full p-2 rounded-xl border"
                  >
                    <option value="low">Faible (Low)</option>
                    <option value="medium">Moyenne (Medium)</option>
                    <option value="high">Élevée (High)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold mb-1 opacity-75">Difficulté (1-5)</label>
                  <select
                    value={parsedResult.difficulty_score ?? 3}
                    onChange={e => updateParsedField('difficulty_score', parseInt(e.target.value, 10))}
                    className="inp text-xs font-bold w-full p-2 rounded-xl border"
                  >
                    {[1, 2, 3, 4, 5].map(score => (
                      <option key={score} value={score}>{score} / 5</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Échéance, Type d'échéance, Catégorie */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold mb-1 opacity-75">Échéance</label>
                  <input
                    type="date"
                    value={parsedResult.deadline || ''}
                    onChange={e => updateParsedField('deadline', e.target.value)}
                    className="inp text-xs font-bold w-full p-2 rounded-xl border"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold mb-1 opacity-75">Contrainte</label>
                  <select
                    value={parsedResult.is_hard_deadline ? 'hard' : 'soft'}
                    onChange={e => updateParsedField('is_hard_deadline', e.target.value === 'hard')}
                    className="inp text-xs font-bold w-full p-2 rounded-xl border"
                  >
                    <option value="hard">Ferme</option>
                    <option value="soft">Flexible</option>
                  </select>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[11px] font-bold mb-1 opacity-75">Catégorie</label>
                  <input
                    type="text"
                    value={parsedResult.category || ''}
                    onChange={e => updateParsedField('category', e.target.value)}
                    className="inp text-xs font-bold w-full p-2 rounded-xl border"
                    placeholder="Ex: Révisions"
                  />
                </div>
              </div>

              {/* Sous-tâches éditables */}
              <div className="pt-2 border-t space-y-2" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11px]">
                    Sous-tâches / jalons ({(parsedResult.subtasks || []).length}) :
                  </span>
                  <button
                    type="button"
                    onClick={addSubtask}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-600 hover:text-teal-500 px-2 py-0.5 rounded-lg bg-teal-500/10"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Ajouter</span>
                  </button>
                </div>

                {(parsedResult.subtasks || []).length > 0 ? (
                  <div className="space-y-1.5">
                    {(parsedResult.subtasks || []).map((st: string, idx: number) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={st}
                          onChange={e => updateSubtask(idx, e.target.value)}
                          placeholder={`Sous-tâche ${idx + 1}...`}
                          className="inp text-xs w-full p-2 rounded-xl border"
                        />
                        <button
                          type="button"
                          onClick={() => removeSubtask(idx)}
                          className="p-2 rounded-xl text-rose-500 hover:bg-rose-500/10 transition shrink-0"
                          title="Supprimer cette sous-tâche"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] italic opacity-60">Aucune sous-tâche (un seul jalon sera créé).</p>
                )}
              </div>
            </div>

            {/* Choix du projet de destination + édition du nom si nouveau projet */}
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-bold mb-1">Rattacher au projet :</label>
                <select
                  value={selectedProjectId}
                  onChange={e => setSelectedProjectId(e.target.value)}
                  className="inp text-xs w-full p-2.5 rounded-xl border font-medium"
                >
                  <option value="">
                    ✨ + Créer un nouveau projet [{parsedResult.project_name || 'Projet Principal'}]
                  </option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      📁 [{p.code}] {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {!selectedProjectId && (
                <div>
                  <label className="block text-[11px] font-bold mb-1 opacity-75">Nom du nouveau projet :</label>
                  <input
                    type="text"
                    value={parsedResult.project_name || ''}
                    onChange={e => updateParsedField('project_name', e.target.value)}
                    placeholder="Nom du projet..."
                    className="inp text-xs font-bold w-full p-2 rounded-xl border"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setParsedResult(null)}
                className="btn-sec text-xs px-3 py-2"
              >
                Re-saisir le prompt
              </button>
              <button
                type="button"
                onClick={handleConfirmAdd}
                className="btn-main text-xs px-4 py-2 flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Ajouter à mon Planning</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
