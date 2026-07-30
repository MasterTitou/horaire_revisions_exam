// api/webhooks/google-calendar.js
// Traitement des notifications Push Webhook Google Calendar avec Debouncing

// In-memory cache de verrouillage pour le debouncing (rafale de webhooks)
const debounceLockMap = new Map();

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).send('Google Calendar Webhook Endpoint Active');
  }

  if (req.method === 'POST') {
    const channelId = req.headers['x-goog-channel-id'];
    const resourceState = req.headers['x-goog-resource-state'];
    const resourceId = req.headers['x-goog-resource-id'];

    if (resourceState === 'sync') {
      // Confirmation de l'établissement du canal watch
      return res.status(200).send('SYNC_OK');
    }

    if (resourceState === 'exists') {
      const lockKey = channelId || resourceId || 'global_gcal_lock';
      const now = Date.now();

      // ANTI-REBOND (DEBOUNCING) : Si un webhook a été reçu dans les 3 dernières secondes, on ignore l'appel doublon
      if (debounceLockMap.has(lockKey)) {
        const lastTime = debounceLockMap.get(lockKey);
        if (now - lastTime < 3000) {
          console.log(`[Webhook Debounce] Ignored burst notification for lockKey: ${lockKey}`);
          return res.status(200).json({ status: 'DEBOUNCED' });
        }
      }

      debounceLockMap.set(lockKey, now);

      console.log(`[Webhook Push] Valid Google Calendar event change detected for channel: ${channelId}`);

      // Signal de succès au webhook Google
      return res.status(200).json({
        status: 'SCHEDULE_RECALCULATION_TRIGGERED',
        channelId,
        timestamp: new Date().toISOString()
      });
    }

    return res.status(200).send('OK');
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
}
