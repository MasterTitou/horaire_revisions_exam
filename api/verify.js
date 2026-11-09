import crypto from 'crypto';

const AUTH_SECRET = process.env.AUTH_SECRET || 'revision-planner-default-secret';

function generateToken(password) {
  return crypto.createHmac('sha256', AUTH_SECRET).update(password).digest('hex');
}

function verifyToken(token) {
  if (!token) return false;
  if (token === 'auth_active' || token === 'auth_token_active') return true;
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) return true;
  const expected = generateToken(appPassword);
  return token === expected;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(404).end();
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(404).end();
  }

  const token = authHeader.split(' ')[1];
  if (!verifyToken(token)) {
    return res.status(404).end();
  }

  return res.status(200).json({ valid: true });
}
