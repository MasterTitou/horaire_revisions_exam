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

  // Vérification Auth
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(404).end();
  }
  const token = authHeader.split(' ')[1];
  if (!verifyToken(token)) {
    return res.status(404).end();
  }

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;

  if (!kvUrl || !kvToken) {
    console.error('Vercel KV non configuré.');
    return res.status(404).end();
  }

  try {
    const data = req.body;

    // On stocke les données sous la clé "user_data" (clé unique car propriétaire unique)
    const response = await fetch(`${kvUrl}/set/user_data`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${kvToken}`,
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error('Erreur KV storage');
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Erreur Save API:', error);
    return res.status(404).end();
  }
}
