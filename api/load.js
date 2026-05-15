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
  if (req.method !== 'GET') { // Load peut être un GET
    return res.status(404).end();
  }

  // Vérification Auth
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(404).end();
  }
  const token = authHeader.split(' ')[1];
  if (!verifyToken(token)) {
    return res.status(404).end();
  }

  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!kvUrl || !kvToken) {
    console.error('Base de données Redis (Vercel KV / Upstash) non configurée.');
    return res.status(404).end();
  }

  try {
    const response = await fetch(`${kvUrl}/get/user_data`, {
      headers: {
        Authorization: `Bearer ${kvToken}`,
      }
    });

    if (!response.ok) {
      throw new Error('Erreur KV storage');
    }

    const kvData = await response.json();
    // Le format de réponse Redis via REST est { result: "..." }
    const result = kvData.result ? JSON.parse(kvData.result) : null;

    return res.status(200).json(result);
  } catch (error) {
    console.error('Erreur Load API:', error);
    return res.status(404).end();
  }
}
