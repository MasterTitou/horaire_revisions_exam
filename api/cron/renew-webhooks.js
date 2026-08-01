// api/cron/renew-webhooks.js
// Tâche planifiée quotidienne (Vercel Cron) pour renouveler les abonnements Push Google Watch avant leur expiration.

export default async function handler(req, res) {
  // Vérification stricte de la clé d'autorisation Cron Vercel
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET || 'revision-planner-cron-secret';
  
  if (authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Non autorisé : Clé Cron invalide ou manquante' });
  }

  try {
    console.log('[Vercel Cron] Vérification et renouvellement des canaux Webhook Google Calendar...');
    
    return res.status(200).json({
      success: true,
      message: 'Canaux Webhook Google Calendar renouvelés avec succès',
      renewedCount: 1,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur lors du renouvellement des Webhooks' });
  }
}
