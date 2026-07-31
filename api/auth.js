import crypto from 'crypto';

const AUTH_SECRET = process.env.AUTH_SECRET || 'revision-planner-default-secret';

// Génère un token déterministe à partir du mot de passe
function generateToken(password) {
  return crypto.createHmac('sha256', AUTH_SECRET).update(password).digest('hex');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(404).end();
  }

  const appPassword = process.env.APP_PASSWORD;

  if (!appPassword) {
    console.error('APP_PASSWORD non configuré.');
    return res.status(404).end();
  }

  try {
    const { password } = req.body;

    if (!password) {
      return res.status(404).end();
    }

    if (password !== appPassword) {
      return res.status(404).end();
    }

    // Générer un token signé
    const token = generateToken(appPassword);

    return res.status(200).json({ authenticated: true, token });
  } catch (error) {
    console.error('Erreur auth:', error);
    return res.status(404).end();
  }
}

// Export pour réutilisation dans chat.js
export { generateToken };
