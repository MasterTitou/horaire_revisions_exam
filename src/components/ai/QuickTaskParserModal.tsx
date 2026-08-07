import React, { useState, useEffect } from 'react';
import { Sparkles, X, Check, AlertCircle, Clock } from 'lucide-react';
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

      setParsedResult(data.data);
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

  const handleConfirmAdd = () => {
    if (!parsedResult) return;

    onAddParsedTask({
      projectId: selectedProjectId || undefined,
      projectName: parsedResult.project_name || 'Projet Principal',
      title: parsedResult.title,
      category: parsedResult.category,
      difficultyScore: parsedResult.difficulty_score,
      estimatedHours: parsedResult.estimated_hours,
      cognitiveLoad: parsedResult.cognitive_load,
      deadline: parsedResult.deadline,
      isHardDeadline: parsedResult.is_hard_deadline,
      subtasks: parsedResult.subtasks || []
    });

    onClose();
    setPrompt('');
    setParsedResult(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="card max-w-lg w-full p-6 space-y-4 shadow-2xl relative border" style={{ background: 'var(--bg-card, #ffffff)', borderColor: 'var(--border)' }}>
        
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
          /* Prévisualisation et validation du résultat parsé */
          <div className="space-y-4">
            <div className="p-4 rounded-2xl border space-y-2 text-xs" style={{ background: 'var(--bg, #f8fafc)', borderColor: 'var(--border)' }}>
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] uppercase font-bold text-teal-600 px-2 py-0.5 rounded-full bg-teal-500/10">
                    {parsedResult.category}
                  </span>
                  <h4 className="font-extrabold text-sm mt-1">{parsedResult.title}</h4>
                </div>
                <div className="text-right">
                  <span className="font-bold text-teal-700">{parsedResult.estimated_hours}h estimées</span>
                  <p className="text-[10px] text-gray-500">Difficulté: {parsedResult.difficulty_score}/5</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                <div>
                  <span className="text-gray-500">Charge mentale :</span>{' '}
                  <strong className="capitalize">{parsedResult.cognitive_load}</strong>
                </div>
                <div>
                  <span className="text-gray-500">Échéance :</span>{' '}
                  <strong>{parsedResult.deadline}</strong> ({parsedResult.is_hard_deadline ? 'Ferme' : 'Flexible'})
                </div>
              </div>

              {parsedResult.subtasks && parsedResult.subtasks.length > 0 && (
                <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                  <span className="font-bold block mb-1">Sous-tâches identifiées :</span>
                  <ul className="list-disc list-inside space-y-0.5 text-gray-600 pl-1">
                    {parsedResult.subtasks.map((st: string, idx: number) => (
                      <li key={idx}>{st}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Choix du projet de destination */}
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

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setParsedResult(null)}
                className="btn-sec text-xs px-3 py-2"
              >
                Re-saisir
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
