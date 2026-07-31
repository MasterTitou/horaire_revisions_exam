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
