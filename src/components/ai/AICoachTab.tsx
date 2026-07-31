import React, { useState, useEffect } from 'react';
import { Project, ChatMessage } from '../../types';
import { Send, Bot, Sliders, Zap, ShieldAlert, Cpu, CheckCircle } from 'lucide-react';
import { evaluatePlanningConflicts, resolveConflictsHeuristically } from '../../engine/scheduler';

interface AICoachTabProps {
  projects: Project[];
  chatHistory: ChatMessage[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  authToken: string;
  onUpdateProjects?: (updated: Project[]) => void;
}

export const AICoachTab: React.FC<AICoachTabProps> = ({
  projects,
  chatHistory,
  setChatHistory,
  authToken,
  onUpdateProjects
}) => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [arbitrating, setArbitrating] = useState(false);
  
  const [quotas, setQuotas] = useState<{
    lite: { used: number; limit: number };
    heavy: { used: number; limit: number };
  } | null>(null);

  const [lastArbitrageNotice, setLastArbitrageNotice] = useState<{
    source: 'gemini' | 'heuristic';
    message: string;
    details?: string[];
  } | null>(null);

  useEffect(() => {
    fetchQuotas();
  }, []);

  const fetchQuotas = async () => {
    try {
      const res = await fetch('/api/ai/quota', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setQuotas({
          lite: data.lite,
          heavy: data.heavy
        });
      }
    } catch (e) {
      console.error('Erreur chargement quotas IA:', e);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput('');
    const newHistory: ChatMessage[] = [...chatHistory, { role: 'user', content: userText }];
    setChatHistory(newHistory);
    setLoading(true);

    try {
      let context = `=== CONTEXTE SYSTÈME DE GESTION DE PROJETS UNIVERSEL ===\n`;
      context += `PROJETS EN COURS (${projects.length}):\n`;
      projects.forEach(p => {
        context += `- Projet [${p.code}] ${p.name} (Échéance: ${p.deadline || 'N/A'}, ${p.isHardDeadline ? 'Ferme' : 'Filée'})\n`;
        p.milestones.forEach(m => {
          context += `   • Jalon WBS: ${m.title} | ${m.estimatedHours}h | Effort: ${m.cognitiveLoad}\n`;
        });
      });

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: `Tu es un coach universel expert en gestion de projets tout domaine. Tu réponds avec bienveillance et rigueur.\n\n${context}` }] },
          contents: newHistory.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
        })
      });

      const data = await res.json();
      if (res.ok) {
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Réponse non disponible.";
        setChatHistory([...newHistory, { role: 'assistant', content: reply }]);
      } else {
        const errMsg = data.error?.message || data.error || "Erreur de connexion au serveur IA.";
        setChatHistory([...newHistory, { role: 'assistant', content: `⚠️ ${errMsg}` }]);
      }
    } catch (err) {
      setChatHistory([...newHistory, { role: 'assistant', content: "⚠️ Erreur réseau : Impossible de contacter l'API du Coach IA." }]);
    } finally {

      setLoading(false);
      fetchQuotas();
    }
  };

  // Déclenchement de l'Arbitrage Strategique 3.6 Flash avec Fallback Heuristique
  const handleRunArbitrage = async () => {
    if (arbitrating) return;
    setArbitrating(true);
    setLastArbitrageNotice(null);

    const report = evaluatePlanningConflicts(projects, {});
    
    try {
      const res = await fetch('/api/ai/arbitrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          conflictSummary: report,
          scheduleState: projects.map(p => ({ id: p.id, name: p.name, deadline: p.deadline, milestonesCount: p.milestones.length })),
          userGoal: "Résoudre la surcharge et optimiser l'agenda"
        })
      });

      const data = await res.json();

      if (res.status === 429 || data.quotaExhausted) {
        // Quota Gemini 3.6 Flash épuisé -> Exécution du Fallback Heuristique Déterministe !
        const fallbackResult = resolveConflictsHeuristically(projects, report);
        if (onUpdateProjects) {
          onUpdateProjects(fallbackResult.updatedProjects);
        }

        setLastArbitrageNotice({
          source: 'heuristic',
          message: "Quota quotidien Gemini 3.6 Flash atteint (20/j).",
          details: fallbackResult.actionsTaken
        });

        setChatHistory(prev => [
          ...prev,
          {
            role: 'assistant',
            content: `⚡ **Arbitrage Déterministe de Repli (Quota 3.6 Épuisé) :**\n\n${fallbackResult.actionsTaken.join('\n')}`
          }
        ]);
      } else if (res.ok && data.success) {
        setLastArbitrageNotice({
          source: 'gemini',
          message: "Arbitrage stratégique effectué par Gemini 3.6 Flash."
        });

        const advice = data.strategicAdvice || (data.recommendations ? data.recommendations.join('\n') : "Optimisation appliquée.");
        setChatHistory(prev => [
          ...prev,
          {
            role: 'assistant',
            content: `🎯 **Arbitrage Stratégique Gemini 3.6 Flash :**\n\n${advice}`
          }
        ]);
      } else {
        throw new Error(data.error || "Erreur d'arbitrage");
      }
    } catch (err) {
      console.error('Erreur arbitrage:', err);
      // Fallback de sécurité
      const fallbackResult = resolveConflictsHeuristically(projects, report);
      if (onUpdateProjects) onUpdateProjects(fallbackResult.updatedProjects);

      setLastArbitrageNotice({
        source: 'heuristic',
        message: "Arbitrage déterministe TS de repli appliqué.",
        details: fallbackResult.actionsTaken
      });
    } finally {
      setArbitrating(false);
      fetchQuotas();
    }
  };

  return (
    <div className="card p-5 md:p-6 space-y-4 max-w-3xl mx-auto">
      
      {/* Barre des Quotas Serveur IA en Temps Réel */}
      {quotas && (
        <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 text-xs">
            <Cpu className="w-4 h-4 text-teal-600" />
            <div>
              <span className="font-bold block">3.5 Flash-Lite (Parsing)</span>
              <span className="text-gray-500">{quotas.lite.used} / {quotas.lite.limit} req / jour</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Zap className="w-4 h-4 text-amber-500" />
            <div>
              <span className="font-bold block">Gemini 3.6 Flash (Arbitrage)</span>
              <span className="text-gray-500">{quotas.heavy.used} / {quotas.heavy.limit} req / jour</span>
            </div>
          </div>
        </div>
      )}

      {/* Rétro-étalonnage IA Calibration Banner */}
      <div className="p-4 rounded-2xl space-y-2" style={{ background: 'var(--terra-l)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-black text-xs" style={{ color: 'var(--terra)' }}>
            <Sliders className="w-4 h-4" />
            <span>RÉTRO-ÉTALONNAGE D'EFFORT IA (CALIBRATION LOOP)</span>
          </div>
          <button
            onClick={handleRunArbitrage}
            disabled={arbitrating}
            className="btn-main text-xs px-3 py-1.5 flex items-center gap-1.5 shadow-sm"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{arbitrating ? "Arbitrage en cours..." : "Optimiser mon planning"}</span>
          </button>
        </div>
        <p className="text-xs font-bold" style={{ color: 'var(--text)' }}>
          🤖 <strong>Analyse d'étalonnage :</strong> Vos tâches stratégiques s'exécutent avec un facteur correcteur de <strong>1.25×</strong>. Le bouton ci-dessus déclenche l'arbitrage haute stratégie (Gemini 3.6) ou le repli déterministe.
        </p>
      </div>

      {/* Notification d'Arbitrage Récent */}
      {lastArbitrageNotice && (
        <div className={`p-4 rounded-2xl border text-xs space-y-1 ${
          lastArbitrageNotice.source === 'heuristic'
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-800'
            : 'bg-teal-500/10 border-teal-500/30 text-teal-800'
        }`}>
          <div className="flex items-center gap-2 font-bold">
            {lastArbitrageNotice.source === 'heuristic' ? (
              <ShieldAlert className="w-4 h-4 text-amber-600" />
            ) : (
              <CheckCircle className="w-4 h-4 text-teal-600" />
            )}
            <span>{lastArbitrageNotice.message}</span>
          </div>
          {lastArbitrageNotice.details && (
            <ul className="list-disc list-inside space-y-0.5 pt-1 pl-1 text-[11px]">
              {lastArbitrageNotice.details.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* En-tête */}
      <div className="flex items-center gap-3 border-b pb-3" style={{ borderColor: 'var(--border)' }}>
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-teal-100 text-teal-800 font-bold">
          <Bot className="w-6 h-6" />
        </div>
        <div>
          <h2 className="font-extrabold text-lg" style={{ color: 'var(--text)' }}>Coach IA Universel &amp; Arbitrage Stratégique</h2>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>Formatage Flash-Lite, Moteur TS déterministe et Conseils 3.6 Flash.</p>
        </div>
      </div>

      {/* Historique du Chat */}
      <div className="h-80 overflow-y-auto space-y-3 p-3 rounded-2xl scr" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
        {chatHistory.length === 0 ? (
          <div className="text-center py-10 text-xs" style={{ color: 'var(--muted)' }}>
            Posez une question au Coach IA ou déclenchez l'optimisation de votre agenda ci-dessus.
          </div>
        ) : (
          chatHistory.map((msg, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-2xl text-xs max-w-[85%] ${
                msg.role === 'user'
                  ? 'ml-auto text-white'
                  : 'mr-auto card'
              }`}
              style={{
                background: msg.role === 'user' ? 'linear-gradient(135deg, #0E8478, #0B6B61)' : undefined
              }}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
            </div>
          ))
        )}
        {(loading || arbitrating) && (
          <div className="p-3 rounded-2xl text-xs max-w-[85%] mr-auto card animate-pulse">
            Analyse et réflexion du coach…
          </div>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Pose ta question sur n'importe quel projet..."
          className="inp text-xs flex-grow"
        />
        <button type="submit" disabled={loading || arbitrating} className="btn-main px-4 text-xs flex items-center gap-1">
          <Send className="w-3.5 h-3.5" />
          <span>Envoyer</span>
        </button>
      </form>
    </div>
  );
};
