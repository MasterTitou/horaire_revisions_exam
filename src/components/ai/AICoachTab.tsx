import React, { useState } from 'react';
import { Project, ChatMessage } from '../../types';
import { Send, Bot } from 'lucide-react';

interface AICoachTabProps {
  projects: Project[];
  chatHistory: ChatMessage[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  authToken: string;
}

export const AICoachTab: React.FC<AICoachTabProps> = ({ projects, chatHistory, setChatHistory, authToken }) => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput('');
    const newHistory: ChatMessage[] = [...chatHistory, { role: 'user', content: userText }];
    setChatHistory(newHistory);
    setLoading(true);

    try {
      // Build SaaS Context
      let context = `=== CONTEXTE SYSTÈME DE GESTION DE PROJETS SAAS ===\n`;
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
          systemInstruction: { parts: [{ text: `Tu es un coach SaaS expert en gestion de projets complexes sous contraintes d'effort cognitif.\n\n${context}` }] },
          contents: newHistory.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
        })
      });

      if (res.ok) {
        const data = await res.json();
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Réponse non disponible.";
        setChatHistory([...newHistory, { role: 'assistant', content: reply }]);
      } else {
        setChatHistory([...newHistory, { role: 'assistant', content: "Option IA disponible lors de la connexion serveur." }]);
      }
    } catch (err) {
      setChatHistory([...newHistory, { role: 'assistant', content: "Le coach IA est prêt pour l'intégration avec votre API backend." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-5 md:p-6 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 border-b pb-3" style={{ borderColor: 'var(--border)' }}>
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-teal-100 text-teal-800 font-bold">
          <Bot className="w-6 h-6" />
        </div>
        <div>
          <h2 className="font-extrabold text-lg" style={{ color: 'var(--text)' }}>Coach IA SaaS &amp; Optimisation Temporelle</h2>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>Analyse tes jalons WBS, ta charge cognitive et tes priorités de livraison.</p>
        </div>
      </div>

      <div className="h-80 overflow-y-auto space-y-3 p-3 rounded-2xl scr" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
        {chatHistory.length === 0 ? (
          <div className="text-center py-10 text-xs" style={{ color: 'var(--muted)' }}>
            Pose une question au Coach IA (ex: « Comment optimiser le jalon BDD cette semaine ? »)
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
        {loading && (
          <div className="p-3 rounded-2xl text-xs max-w-[85%] mr-auto card animate-pulse">
            Réflexion du coach…
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Pose ta question sur ton projet..."
          className="inp text-xs flex-grow"
        />
        <button type="submit" disabled={loading} className="btn-main px-4 text-xs flex items-center gap-1">
          <Send className="w-3.5 h-3.5" />
          <span>Envoyer</span>
        </button>
      </form>
    </div>
  );
};
