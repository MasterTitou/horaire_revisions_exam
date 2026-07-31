import crypto from 'crypto';

const AUTH_SECRET = process.env.AUTH_SECRET || 'revision-planner-default-secret';

function generateToken(password) {
  return crypto.createHmac('sha256', AUTH_SECRET).update(password).digest('hex');
}

function verifyToken(token) {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) return false;
  const expected = generateToken(appPassword);
  return token === expected;
}

export default async function handler(req, res) {
  // Seul le POST est autorisé
  if (req.method !== 'POST') {
    return res.status(404).end();
  }

  // --- Vérification du token d'authentification ---
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(404).end();
  }

  const token = authHeader.split(' ')[1];
  if (!verifyToken(token)) {
    return res.status(404).end();
  }

  // --- Clé API Gemini ---
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('GEMINI_API_KEY non configurée.');
    return res.status(404).end();
  }

  try {
    const { contents, systemInstruction, generationConfig } = req.body;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
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

    const data = await response.json();

    if (!response.ok) {
      console.error('Erreur Gemini API:', data);
      return res.status(404).end();
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Erreur API Chat:', error);
    return res.status(404).end();
  }
}
