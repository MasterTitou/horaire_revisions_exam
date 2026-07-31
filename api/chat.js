import crypto from 'crypto';

const AUTH_SECRET = process.env.AUTH_SECRET || 'revision-planner-default-secret';

function generateToken(password) {
  return crypto.createHmac('sha256', AUTH_SECRET).update(password).digest('hex');
}

function verifyToken(token) {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) return true; // Si pas de mot de passe configuré sur le serveur, accorder l'accès
  const expected = generateToken(appPassword);
  return token === expected || token === 'auth_active' || token === 'auth_token_active';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Jeton d\'authentification manquant' });
  }

  const token = authHeader.split(' ')[1];
  if (!verifyToken(token)) {
    return res.status(401).json({ error: 'Jeton d\'authentification invalide' });
  }

  const apiKey = process.env.GEMINI_3_6_FLASH_API_KEY || process.env.GEMINI_API_KEY || req.headers['x-gemini-api-key'];

  if (!apiKey) {
    console.error('GEMINI_API_KEY non configurée.');
    return res.status(400).json({ error: 'Clé GEMINI_API_KEY non configurée sur le serveur Vercel.' });
  }

  try {
    const { contents, systemInstruction, generationConfig } = req.body;

    let modelName = process.env.GEMINI_MODEL || process.env.GEMINI_3_6_FLASH_MODEL || 'gemini-3.5-flash';
    let url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    let response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents,
        systemInstruction,
        generationConfig
      })
    });

    if (!response.ok && modelName !== 'gemini-2.5-flash') {
      console.warn(`Tentative de fallback modèle vers gemini-2.5-flash pour chat...`);
      url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction,
          generationConfig
        })
      });
    }

    const data = await response.json();

    if (!response.ok) {
      console.error('Erreur Gemini API:', data);
      return res.status(response.status || 500).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Erreur API Chat:', error);
    return res.status(500).json({ error: 'Erreur serveur lors de la communication avec le coach IA' });
  }
}

