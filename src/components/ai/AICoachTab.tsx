import React, { useState, useEffect, useRef } from 'react';
import { Project, ChatMessage, ChatThread } from '../../types';
import {
  Send, Bot, Sliders, Zap, ShieldAlert, Cpu, CheckCircle,
  Plus, Trash2, Edit3, MessageSquare, Copy, RotateCcw,
  Check, Menu, X, Sparkles
} from 'lucide-react';
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
  // Multi-threads State
  const [threads, setThreads] = useState<ChatThread[]>(() => {
    const saved = localStorage.getItem('ai_coach_threads');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error('Erreur chargement threads:', e);
      }
    }
    // Default thread migration
    return [{
      id: 'thread_default',
      title: 'Discussion Principale',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: chatHistory.length > 0 ? chatHistory : []
    }];
  });

  const [activeThreadId, setActiveThreadId] = useState<string>(() => {
    return localStorage.getItem('ai_coach_active_thread_id') || threads[0]?.id || 'thread_default';
  });

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [arbitrating, setArbitrating] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Renommage inline
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const [quotas, setQuotas] = useState<{
    lite: { used: number; limit: number; tokens?: number };
    heavy: { used: number; limit: number; tokens?: number };
  } | null>(null);

  const [lastArbitrageNotice, setLastArbitrageNotice] = useState<{
    source: 'gemini' | 'heuristic';
    message: string;
    details?: string[];
  } | null>(null);

  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Persistence local storage des threads
  useEffect(() => {
    localStorage.setItem('ai_coach_threads', JSON.stringify(threads));
    localStorage.setItem('ai_coach_active_thread_id', activeThreadId);

    // Sync legacy chatHistory prop for compatibility
    const currentThread = threads.find(t => t.id === activeThreadId);
    if (currentThread) {
      setChatHistory(currentThread.messages);
    }
  }, [threads, activeThreadId]);

  useEffect(() => {
    fetchQuotas();
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [threads, activeThreadId, loading]);

  const activeThread = threads.find(t => t.id === activeThreadId) || threads[0];

  const fetchQuotas = async () => {
    try {
      const res = await fetch('/api/ai?action=quota', {
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

  // Création d'une nouvelle discussion
  const handleCreateNewThread = () => {
    const newId = `thread_${Date.now()}`;
    const newThread: ChatThread = {
      id: newId,
      title: `Discussion ${threads.length + 1}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: []
    };
    setThreads([newThread, ...threads]);
    setActiveThreadId(newId);
    setIsSidebarOpen(false);
  };

  // Suppression d'une discussion
  const handleDeleteThread = (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (threads.length <= 1) {
      // Vider le thread si c'est le seul
      setThreads([{
        id: 'thread_default',
        title: 'Discussion Principale',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: []
      }]);
      setActiveThreadId('thread_default');
      return;
    }

    const updated = threads.filter(t => t.id !== threadId);
    setThreads(updated);
    if (activeThreadId === threadId) {
      setActiveThreadId(updated[0].id);
    }
  };

  // Vider l'historique d'une discussion
  const handleClearCurrentThread = () => {
    if (!activeThread) return;
    setThreads(prev => prev.map(t => {
      if (t.id === activeThread.id) {
        return { ...t, messages: [], updatedAt: new Date().toISOString() };
      }
      return t;
    }));
  };

  // Début du renommage
  const handleStartRename = (thread: ChatThread, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingThreadId(thread.id);
    setEditingTitle(thread.title);
  };

  // Sauvegarde du renommage
  const handleSaveRename = (threadId: string) => {
    if (editingTitle.trim()) {
      setThreads(prev => prev.map(t => {
        if (t.id === threadId) {
          return { ...t, title: editingTitle.trim() };
        }
        return t;
      }));
    }
    setEditingThreadId(null);
  };

  // Copier le message
  const handleCopyMessage = (content: string, idx: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Envoi de message
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || !activeThread) return;

    const userText = input.trim();
    setInput('');

    const userMsg: ChatMessage = {
      role: 'user',
      content: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Auto-titre basé sur le 1er message si nom par défaut
    const isDefaultTitle = activeThread.title.startsWith('Discussion');
    const newTitle = isDefaultTitle && activeThread.messages.length === 0
      ? (userText.length > 25 ? `${userText.slice(0, 25)}…` : userText)
      : activeThread.title;

    const updatedMessages = [...activeThread.messages, userMsg];

    setThreads(prev => prev.map(t => {
      if (t.id === activeThread.id) {
        return {
          ...t,
          title: newTitle,
          messages: updatedMessages,
          updatedAt: new Date().toISOString()
        };
      }
      return t;
    }));

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

      const res = await fetch('/api/ai?action=chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: `Tu es un coach universel expert en gestion de projets tout domaine. Tu réponds avec bienveillance et rigueur.\n\n${context}` }] },
          contents: updatedMessages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
        })
      });

      const data = await res.json();
      let replyMsg: ChatMessage;

      if (res.ok) {
        const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Réponse non disponible.";
        replyMsg = {
          role: 'assistant',
          content: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
      } else {
        const errMsg = data.error?.message || data.error || "Erreur de connexion au serveur IA.";
        replyMsg = {
          role: 'assistant',
          content: `⚠️ ${errMsg}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
      }

      setThreads(prev => prev.map(t => {
        if (t.id === activeThread.id) {
          return {
            ...t,
            messages: [...updatedMessages, replyMsg],
            updatedAt: new Date().toISOString()
          };
        }
        return t;
      }));

    } catch (err) {
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: "⚠️ Erreur réseau : Impossible de contacter l'API du Coach IA.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setThreads(prev => prev.map(t => {
        if (t.id === activeThread.id) {
          return {
            ...t,
            messages: [...updatedMessages, errorMsg],
            updatedAt: new Date().toISOString()
          };
        }
        return t;
      }));
    } finally {
      setLoading(false);
      fetchQuotas();
    }
  };

  // Déclenchement de l'Arbitrage Stratégique 3.6 Flash
  const handleRunArbitrage = async () => {
    if (arbitrating || !activeThread) return;
    setArbitrating(true);
    setLastArbitrageNotice(null);

    const report = evaluatePlanningConflicts(projects, {});
    
    try {
      const res = await fetch('/api/ai?action=arbitrate', {
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
      let arbitrageMsg: ChatMessage;

      if (res.status === 429 || data.quotaExhausted) {
        const fallbackResult = resolveConflictsHeuristically(projects, report);
        if (onUpdateProjects) onUpdateProjects(fallbackResult.updatedProjects);

        setLastArbitrageNotice({
          source: 'heuristic',
          message: "Quota quotidien Gemini 3.6 Flash atteint (20/j).",
          details: fallbackResult.actionsTaken
        });

        arbitrageMsg = {
          role: 'assistant',
          content: `⚡ **Arbitrage Déterministe de Repli (Quota 3.6 Épuisé) :**\n\n${fallbackResult.actionsTaken.join('\n')}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
      } else if (res.ok && data.success) {
        setLastArbitrageNotice({
          source: 'gemini',
          message: "Arbitrage stratégique effectué par Gemini 3.6 Flash."
        });

        const advice = data.strategicAdvice || (data.recommendations ? data.recommendations.join('\n') : "Optimisation appliquée.");
        arbitrageMsg = {
          role: 'assistant',
          content: `🎯 **Arbitrage Stratégique Gemini 3.6 Flash :**\n\n${advice}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
      } else {
        throw new Error(data.error || "Erreur d'arbitrage");
      }

      setThreads(prev => prev.map(t => {
        if (t.id === activeThread.id) {
          return {
            ...t,
            messages: [...t.messages, arbitrageMsg],
            updatedAt: new Date().toISOString()
          };
        }
        return t;
      }));

    } catch (err) {
      console.error('Erreur arbitrage:', err);
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
    <div className="card p-4 md:p-6 space-y-4 max-w-5xl mx-auto border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      
      {/* Barre des Quotas & Métriques IA en Temps Réel */}
      {quotas && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-2xl border shadow-xs" style={{ background: 'var(--bg, #f8fafc)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2.5 text-xs p-2 rounded-xl" style={{ background: 'var(--bg-card)' }}>
            <Cpu className="w-5 h-5 text-teal-600 shrink-0" />
            <div className="w-full">
              <div className="flex justify-between items-center font-bold">
                <span>Gemini 3.5 Flash-Lite</span>
                <span className="text-[11px] font-mono text-teal-700">{quotas.lite.used} / {quotas.lite.limit} req</span>
              </div>
              <div className="flex justify-between items-center text-[10px] text-gray-500 mt-0.5">
                <span>Parsing &amp; Chat</span>
                <span className="font-semibold text-gray-600">{quotas.lite.tokens || 0} tokens</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2.5 text-xs p-2 rounded-xl" style={{ background: 'var(--bg-card)' }}>
            <Zap className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="w-full">
              <div className="flex justify-between items-center font-bold">
                <span>Gemini 3.6 Flash</span>
                <span className="text-[11px] font-mono text-amber-700">{quotas.heavy.used} / {quotas.heavy.limit} req</span>
              </div>
              <div className="flex justify-between items-center text-[10px] text-gray-500 mt-0.5">
                <span>Haute Stratégie</span>
                <span className="font-semibold text-gray-600">{quotas.heavy.tokens || 0} tokens</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bannière Rétro-étalonnage IA */}
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
          🤖 <strong>Analyse d'étalonnage :</strong> Vos tâches stratégiques s'exécutent avec un facteur correcteur de <strong>1.25×</strong>. Le bouton ci-dessus déclenche l'arbitrage haute stratégie (Gemini 3.6).
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

      {/* Layout Multi-Discussions (Sidebar + Chat) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-[550px] relative">

        {/* Bouton Mobile Toggle Sidebar */}
        <div className="md:hidden flex items-center justify-between pb-2 border-b">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="btn-sec text-xs px-3 py-1.5 flex items-center gap-1.5"
          >
            {isSidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            <span>Discussions ({threads.length})</span>
          </button>
          <button
            onClick={handleCreateNewThread}
            className="btn-main text-xs px-3 py-1.5 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nouvelle</span>
          </button>
        </div>

        {/* Sidebar des Conversations */}
        <div className={`
          md:col-span-4 flex flex-col space-y-3 rounded-2xl p-3 border scr overflow-y-auto transition-all z-20
          ${isSidebarOpen ? 'absolute inset-0 bg-white dark:bg-gray-900 shadow-xl' : 'hidden md:flex'}
        `} style={{ background: 'var(--bg, #f8fafc)', borderColor: 'var(--border)' }}>
          
          <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: 'var(--border)' }}>
            <h3 className="font-extrabold text-xs flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-teal-600" />
              <span>Vos Discussions ({threads.length})</span>
            </h3>
            <button
              onClick={handleCreateNewThread}
              className="p-1.5 rounded-xl bg-teal-500/10 text-teal-700 hover:bg-teal-500/20 text-xs font-bold flex items-center gap-1 transition-colors"
              title="Créer une nouvelle discussion"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Nouvelle</span>
            </button>
          </div>

          <div className="space-y-1.5 flex-1 overflow-y-auto scr pr-1">
            {threads.map(thread => {
              const isActive = thread.id === activeThreadId;
              const isEditing = editingThreadId === thread.id;

              return (
                <div
                  key={thread.id}
                  onClick={() => {
                    setActiveThreadId(thread.id);
                    setIsSidebarOpen(false);
                  }}
                  className={`group relative p-2.5 rounded-xl text-xs flex items-center justify-between cursor-pointer border transition-all ${
                    isActive
                      ? 'bg-teal-500/15 border-teal-500/40 text-teal-900 font-bold shadow-xs'
                      : 'hover:bg-black/5 dark:hover:bg-white/5 border-transparent text-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0 pr-2">
                    <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-teal-600' : 'text-gray-400'}`} />
                    
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={e => setEditingTitle(e.target.value)}
                        onBlur={() => handleSaveRename(thread.id)}
                        onKeyDown={e => e.key === 'Enter' && handleSaveRename(thread.id)}
                        autoFocus
                        className="inp text-xs p-1 h-6 w-full rounded"
                      />
                    ) : (
                      <div className="truncate">
                        <span className="block truncate">{thread.title}</span>
                        <span className="text-[9px] text-gray-400 block font-normal">
                          {thread.messages.length} msg · {new Date(thread.updatedAt).toLocaleDateString([], { day: '2-digit', month: '2-digit' })}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions du Thread */}
                  {!isEditing && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={e => handleStartRename(thread, e)}
                        className="p-1 rounded hover:bg-black/10 text-gray-500"
                        title="Renommer la discussion"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={e => handleDeleteThread(thread.id, e)}
                        className="p-1 rounded hover:bg-red-500/10 text-red-500"
                        title="Supprimer la discussion"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Panneau Principal de la Chat Thread Active */}
        <div className="md:col-span-8 flex flex-col h-full rounded-2xl border p-3.5 space-y-3" style={{ background: 'var(--bg, #f8fafc)', borderColor: 'var(--border)' }}>
          
          {/* En-tête de la Conversation Active */}
          {activeThread && (
            <div className="flex items-center justify-between border-b pb-2.5" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-700 font-extrabold">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-extrabold text-sm flex items-center gap-1.5">
                    <span>{activeThread.title}</span>
                  </h2>
                  <span className="text-[10px] text-gray-500">
                    Gemini 3.5 Flash-Lite (Parsing &amp; Chat)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={handleClearCurrentThread}
                  disabled={activeThread.messages.length === 0}
                  className="btn-sec text-xs px-2.5 py-1 flex items-center gap-1 text-gray-600 disabled:opacity-40"
                  title="Vider l'historique de cette discussion"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span className="hidden sm:inline">Effacer</span>
                </button>
              </div>
            </div>
          )}

          {/* Corps des Messages */}
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto space-y-3 p-2 rounded-xl scr"
          >
            {activeThread && activeThread.messages.length === 0 ? (
              <div className="text-center py-16 space-y-2 text-xs" style={{ color: 'var(--muted)' }}>
                <Sparkles className="w-8 h-8 mx-auto text-teal-500/40 animate-pulse" />
                <p className="font-extrabold">Nouvelle Discussion avec le Coach IA</p>
                <p className="text-[11px] max-w-sm mx-auto">Posez vos questions sur la planification, l'irrigation, la tech, la finance ou demandez une réorganisation de votre emploi du temps.</p>
              </div>
            ) : (
              activeThread?.messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`group relative p-3 rounded-2xl text-xs max-w-[88%] shadow-2xs transition-all ${
                    msg.role === 'user'
                      ? 'ml-auto text-white'
                      : 'mr-auto card border'
                  }`}
                  style={{
                    background: msg.role === 'user' ? 'linear-gradient(135deg, #0E8478, #0B6B61)' : undefined
                  }}
                >
                  <div className="flex items-center justify-between mb-1 opacity-75 text-[10px]">
                    <span className="font-bold uppercase tracking-wider">{msg.role === 'user' ? 'Vous' : 'Coach IA'}</span>
                    <div className="flex items-center gap-1">
                      {msg.timestamp && <span>{msg.timestamp}</span>}
                      <button
                        onClick={() => handleCopyMessage(msg.content, idx)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-black/10 transition-opacity ml-1"
                        title="Copier le texte"
                      >
                        {copiedIndex === idx ? <Check className="w-3 h-3 text-teal-300" /> : <Copy className="w-3 h-3 opacity-70" />}
                      </button>
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>
              ))
            )}

            {loading && (
              <div className="p-3 rounded-2xl text-xs max-w-[85%] mr-auto card border animate-pulse flex items-center gap-2">
                <Bot className="w-4 h-4 text-teal-600" />
                <span>Réflexion du coach en cours…</span>
              </div>
            )}
          </div>

          {/* Formulaire d'envoi */}
          <form onSubmit={handleSend} className="flex gap-2 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Posez votre question ou demandez un conseil d'organisation..."
              className="inp text-xs flex-grow p-2.5 rounded-xl border"
            />
            <button
              type="submit"
              disabled={loading || arbitrating || !input.trim()}
              className="btn-main px-4 text-xs flex items-center gap-1.5 shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Envoyer</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
