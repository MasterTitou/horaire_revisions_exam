import crypto from 'crypto';

const AUTH_SECRET = process.env.AUTH_SECRET || 'revision-planner-default-secret';

// Génère un token déterministe à partir du mot de passe
function generateToken(password) {
  return crypto.createHmac('sha256', AUTH_SECRET).update(password).digest('hex');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const appPassword = process.env.APP_PASSWORD;

  if (!appPassword) {
    return res.status(500).json({
      error: 'APP_PASSWORD non configuré. Ajoutez-le dans les variables d\'environnement Vercel.'
    });
  }

  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Mot de passe requis' });
    }

    if (password !== appPassword) {
      return res.status(401).json({ error: 'Mot de passe incorrect' });
    }

    // Générer un token signé
    const token = generateToken(appPassword);

    return res.status(200).json({ authenticated: true, token });
  } catch (error) {
    console.error('Erreur auth:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

// Export pour réutilisation dans chat.js
export { generateToken };
