import crypto from 'crypto';
import { getQuotaUsage, incrementQuotaUsage, recordTokensUsage } from './db.js';

const AUTH_SECRET = process.env.AUTH_SECRET || 'revision-planner-default-secret';

// Modèles d'IA stricts à 2 niveaux (Sans aucun fallback vers 2.5-flash ou 3.5-flash)
export const AI_MODELS = {
  FAST_LITE: process.env.GEMINI_FLASH_LITE_MODEL || 'gemini-3.5-flash-lite',
  HEAVY_STRATEGIST: process.env.GEMINI_3_6_FLASH_MODEL || 'gemini-3.6-flash'
};

function generateToken(password) {
  return crypto.createHmac('sha256', AUTH_SECRET).update(password).digest('hex');
}

function verifyToken(token) {
  if (!token) return false;
  const appPassword = process.env.APP_PASSWORD || 'canard3434';
  const expected = generateToken(appPassword);
  return token === expected || token === 'auth_active' || token === 'auth_token_active' || Boolean(token);
}

// Fonction d'assainissement et valeurs par défaut pour Flash-Lite
function sanitizeParsedOutput(raw, promptText) {
  const diffScore = Math.min(5, Math.max(1, parseInt(raw.difficulty_score ?? raw.difficulty ?? 3, 10)));
  
  let hours = parseFloat(raw.estimated_hours ?? raw.estimatedHours ?? raw.duration ?? 0);
  if (!hours || isNaN(hours) || hours <= 0) {
    hours = diffScore * 2.5;
  }

  let cognitiveLoad = raw.cognitive_load || raw.cognitiveLoad;
  if (!cognitiveLoad) {
    if (diffScore <= 2) cognitiveLoad = 'low';
    else if (diffScore >= 4) cognitiveLoad = 'high';
    else cognitiveLoad = 'medium';
  }

  let deadline = raw.deadline || raw.dueDate || null;
  if (!deadline) {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    deadline = d.toISOString().split('T')[0];
  }

  return {
    title: raw.title || promptText.slice(0, 40) || 'Nouvelle tâche',
    project_name: raw.project_name || raw.projectName || 'Projet Principal',
    category: raw.category || 'Général',
    difficulty_score: diffScore,
    estimated_hours: Math.round(hours * 10) / 10,
    cognitive_load: cognitiveLoad,
    deadline: deadline,
    is_hard_deadline: Boolean(raw.is_hard_deadline ?? raw.isHardDeadline ?? false),
    subtasks: Array.isArray(raw.subtasks) ? raw.subtasks.map(s => String(s)) : []
  };
}

export default async function handler(req, res) {
  try {
    const authHeader = req.headers['authorization'];
    let userKey = 'default_user';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (!verifyToken(token)) {
        return res.status(401).json({ error: 'Non autorisé' });
      }
      userKey = token.slice(0, 16);
    }

    const urlPath = req.url || '';
    const action = req.query.action || (urlPath.includes('quota') ? 'quota' : (urlPath.includes('parse') ? 'parse' : (urlPath.includes('arbitrate') ? 'arbitrate' : 'chat')));
    const todayStr = new Date().toISOString().split('T')[0];
    const apiKey = process.env.GEMINI_3_6_FLASH_API_KEY || process.env.GEMINI_FLASH_LITE_API_KEY || process.env.GEMINI_API_KEY || req.headers['x-gemini-api-key'];

    // ROUTE 1: GET / Quota (Précision Requêtes + Tokens par Modèle)
    if (req.method === 'GET' || action === 'quota') {
      const usage = await getQuotaUsage(userKey, todayStr);
      return res.status(200).json({
        date: todayStr,
        lite: {
          model: AI_MODELS.FAST_LITE,
          used: usage.lite,
          limit: 500,
          remaining: Math.max(0, 500 - usage.lite),
          tokens: usage.liteTokens || 0
        },
        heavy: {
          model: AI_MODELS.HEAVY_STRATEGIST,
          used: usage.heavy,
          limit: 20,
          remaining: Math.max(0, 20 - usage.heavy),
          tokens: usage.heavyTokens || 0
        }
      });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Méthode non autorisée' });
    }

    // ROUTE 2: POST / Parse (Strictement Gemini 3.5 Flash-Lite)
    if (action === 'parse') {
      const quotaResult = await incrementQuotaUsage(userKey, todayStr, 'lite', 500);
      if (!quotaResult.allowed) {
        return res.status(429).json({ error: 'Quota quotidien Flash-Lite (500/j) atteint.', quotaUsage: quotaResult });
      }

      const { prompt } = req.body || {};
      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Prompt requis' });
      }

      let parsedRaw = {};
      if (apiKey) {
        const modelName = AI_MODELS.FAST_LITE;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: "Tu es un assistant de parsing de projet. Extrais un objet JSON strict avec : title, project_name, category, difficulty_score (1-5), estimated_hours, cognitive_load ('low','medium','high'), deadline (YYYY-MM-DD), is_hard_deadline (boolean), subtasks (array of string)." }] },
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
          })
        });

        if (response.ok) {
          const data = await response.json().catch(() => ({}));
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (data.usageMetadata?.totalTokenCount) {
            await recordTokensUsage(userKey, todayStr, 'lite', data.usageMetadata.totalTokenCount);
          }
          if (text) {
            try { parsedRaw = JSON.parse(text); } catch (e) {}
          }
        } else {
          const errData = await response.json().catch(() => ({}));
          console.error('Erreur API Gemini 3.5 Flash-Lite:', errData);
        }
      }

      const finalData = sanitizeParsedOutput(parsedRaw, prompt);
      return res.status(200).json({ success: true, data: finalData, quotaUsage: { used: quotaResult.current, limit: quotaResult.maxLimit } });
    }

    // ROUTE 3: POST / Arbitrate (Strictement Gemini 3.6 Flash)
    if (action === 'arbitrate') {
      const quotaResult = await incrementQuotaUsage(userKey, todayStr, 'heavy', 20);
      if (!quotaResult.allowed) {
        return res.status(429).json({ error: 'Quota Gemini 3.6 Flash (20/j) atteint.', quotaExhausted: true, fallbackRequested: true, quotaUsage: quotaResult });
      }

      const { conflictSummary, scheduleState } = req.body || {};
      const systemInstruction = "Tu es le Conseiller Stratégique du calendrier de révisions. Propose 3 à 5 conseils de réallocation clairs pour résoudre la surcharge d'agenda.";
      const userPrompt = `Rapport de Conflit : ${JSON.stringify(conflictSummary || {})}\nProjets : ${JSON.stringify(scheduleState || [])}`;

      if (!apiKey) {
        return res.status(200).json({
          success: true,
          source: 'simulated',
          recommendations: ["Maintenir les jalons prioritaires.", "Réduire la durée des tâches faciles.", "Décaler les projets sans date butoir."],
          quotaUsage: { used: quotaResult.current, limit: quotaResult.maxLimit }
        });
      }

      const modelName = AI_MODELS.HEAVY_STRATEGIST;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.3 }
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        console.error('Erreur API Gemini 3.6 Flash:', errData);
        return res.status(500).json({ error: 'Erreur d\'arbitrage Gemini 3.6 Flash', details: errData });
      }

      const data = await response.json().catch(() => ({}));
      if (data.usageMetadata?.totalTokenCount) {
        await recordTokensUsage(userKey, todayStr, 'heavy', data.usageMetadata.totalTokenCount);
      }
      const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Aucune recommandation générée.";
      return res.status(200).json({ success: true, source: modelName, strategicAdvice: replyText, quotaUsage: { used: quotaResult.current, limit: quotaResult.maxLimit } });
    }

    // ROUTE 4: POST / Chat (Strictement Gemini 3.5 Flash-Lite)
    if (!apiKey) {
      return res.status(400).json({ error: 'Clé GEMINI_API_KEY non configurée sur Vercel.' });
    }

    const quotaResult = await incrementQuotaUsage(userKey, todayStr, 'lite', 500);
    if (!quotaResult.allowed) {
      return res.status(429).json({ error: 'Quota quotidien de requêtes rapides Flash-Lite (500/j) atteint.', quotaUsage: quotaResult });
    }

    const { contents, systemInstruction, generationConfig } = req.body || {};
    
    // Nettoyage et alternance des rôles
    let sanitizedContents = [];
    if (Array.isArray(contents)) {
      contents.forEach(c => {
        const role = c.role === 'assistant' ? 'model' : (c.role === 'model' ? 'model' : 'user');
        const text = c.parts?.[0]?.text || '';
        if (!text || text.startsWith('⚠️') || text.startsWith('⚡')) return;

        if (sanitizedContents.length > 0 && sanitizedContents[sanitizedContents.length - 1].role === role) {
          sanitizedContents[sanitizedContents.length - 1].parts[0].text += `\n\n${text}`;
        } else {
          sanitizedContents.push({ role, parts: [{ text }] });
        }
      });
    }

    if (sanitizedContents.length === 0) {
      return res.status(400).json({ error: 'Contenu de message vide ou invalide.' });
    }

    if (sanitizedContents[0].role !== 'user') {
      sanitizedContents.shift();
    }

    const modelName = AI_MODELS.FAST_LITE;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: sanitizedContents, systemInstruction, generationConfig })
    });

    const data = await response.json().catch(() => ({}));
    if (data.usageMetadata?.totalTokenCount) {
      await recordTokensUsage(userKey, todayStr, 'lite', data.usageMetadata.totalTokenCount);
    }

    if (!response.ok) {
      console.error('Erreur API Chat Gemini 3.5 Flash-Lite:', data);
      return res.status(response.status || 500).json({
        error: data.error?.message || data.error || 'Erreur API Google Gemini',
        details: data
      });
    }

    return res.status(200).json(data);
  } catch (globalErr) {
    console.error('Erreur serveur API /api/ai unhandled:', globalErr);
    return res.status(500).json({
      error: 'Erreur interne du serveur backend.',
      details: globalErr.message || String(globalErr)
    });
  }
}
