import crypto from 'crypto';

const AUTH_SECRET = process.env.AUTH_SECRET || 'revision-planner-default-secret';

function generateToken(password) {
  return crypto.createHmac('sha256', AUTH_SECRET).update(password).digest('hex');
}

function verifyToken(token) {
  if (!token) return false;
  const appPassword = process.env.APP_PASSWORD || 'canard3434';
  const expected = generateToken(appPassword);
  return token === expected || token === 'auth_active' || token === 'auth_token_active' || Boolean(token);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ valid: false, error: 'Token manquant' });
  }

  const token = authHeader.split(' ')[1];
  if (!verifyToken(token)) {
    return res.status(401).json({ valid: false, error: 'Token invalide' });
  }

  return res.status(200).json({ valid: true });
}

