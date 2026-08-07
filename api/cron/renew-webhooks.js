// api/cron/renew-webhooks.js
// Tâche planifiée quotidienne (Vercel Cron) pour renouveler les abonnements Push Google Watch avant leur expiration.

import { getValidAccessToken, getStoredGoogleTokens, updateWebhookInfo } from '../calendar/google.js';

export default async function handler(req, res) {
  // 1. Vérification sécurisée de la clé d'autorisation Cron Vercel
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET || 'revision-planner-cron-secret';

  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Non autorisé : Clé Cron invalide ou manquante' });
  }

  try {
    console.log('[Vercel Cron] Vérification et renouvellement des canaux Webhook Google Calendar...');
    const userKey = 'default_user';

    // 2. Récupérer le token valide et les infos de webhook enregistrées
    const accessToken = await getValidAccessToken(userKey);
    if (!accessToken) {
      return res.status(200).json({
        success: true,
        message: 'Aucun compte Google connecté ou token inaccessible.',
        renewedCount: 0,
        timestamp: new Date().toISOString()
      });
    }

    const storedInfo = await getStoredGoogleTokens(userKey);
    const nowMs = Date.now();
    const expirationMs = storedInfo?.webhook_expiration ? new Date(storedInfo.webhook_expiration).getTime() : 0;
    const twoDaysMs = 48 * 3600 * 1000;

    // Renouveler uniquement si pas de webhook actif ou expiration dans moins de 48h
    if (!storedInfo?.webhook_channel_id || expirationMs - nowMs < twoDaysMs) {
      const webhookUrl = process.env.GOOGLE_WEBHOOK_URL || 'https://horaire-revisions-exam.vercel.app/api/webhooks/google-calendar';
      const channelId = `cron_watch_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const newExpirationDate = new Date(Date.now() + 7 * 24 * 3600 * 1000); // 7 jours

      const watchRes = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events/watch',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            id: channelId,
            type: 'web_hook',
            address: webhookUrl,
            expiration: newExpirationDate.getTime()
          })
        }
      );

      const watchData = await watchRes.json();

      if (watchRes.ok && watchData.id) {
        const parsedExpiration = new Date(parseInt(watchData.expiration)).toISOString();
        await updateWebhookInfo(userKey, watchData.id, watchData.resourceId, parsedExpiration);

        console.log(`[Vercel Cron] Webhook Google renouvelé avec succès (Channel ID: ${watchData.id})`);
        return res.status(200).json({
          success: true,
          message: 'Canal Webhook Google Calendar renouvelé avec succès.',
          renewedCount: 1,
          channelId: watchData.id,
          expiration: parsedExpiration,
          timestamp: new Date().toISOString()
        });
      } else {
        console.error('[Vercel Cron] Échec du renouvellement du Webhook Google:', watchData);
        return res.status(400).json({
          error: 'Échec de la souscription Webhook lors du Cron',
          details: watchData
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Le canal Webhook Google est encore valide (pas de renouvellement requis).',
      renewedCount: 0,
      expiration: storedInfo.webhook_expiration,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[Vercel Cron] Erreur renouvellement Webhook:', err.message);
    return res.status(500).json({ error: 'Erreur serveur lors du renouvellement des Webhooks', details: err.message });
  }
}
