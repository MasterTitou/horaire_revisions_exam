export default async function handler(req, res) {
  // Seul le POST est autorisé
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ 
      error: 'Clé API non configurée sur le serveur. Veuillez ajouter GEMINI_API_KEY dans les variables d\'environnement Vercel.' 
    });
  }

  try {
    const { contents, systemInstruction, generationConfig } = req.body;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
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
      return res.status(response.status).json({
        error: data.error?.message || 'Erreur lors de la communication avec Gemini'
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Erreur API Chat:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}
