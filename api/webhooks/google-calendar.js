// api/webhooks/google-calendar.js
// Traitement des notifications Push Webhook Google Calendar avec anti-résonance (Message-Number Guard + Debounce)

const debounceLockMap = new Map();
const messageNumberMap = new Map();

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).send('Google Calendar Webhook Endpoint Active');
  }

  if (req.method === 'POST') {
    const channelId = req.headers['x-goog-channel-id'];
    const resourceState = req.headers['x-goog-resource-state'];
    const resourceId = req.headers['x-goog-resource-id'];
    const messageNumberStr = req.headers['x-goog-message-number'];
    const messageNumber = messageNumberStr ? parseInt(messageNumberStr, 10) : 0;

    if (resourceState === 'sync') {
      return res.status(200).send('SYNC_OK');
    }

    if (resourceState === 'exists') {
      const lockKey = channelId || resourceId || 'global_gcal_lock';
      const now = Date.now();

      // 1. GUARD ANTI-RÉSONANCE PAR MESSAGE NUMBER : Ignorer si le numéro de message est obsolète ou identique
      if (messageNumber && messageNumberMap.has(lockKey)) {
        const lastMsgNum = messageNumberMap.get(lockKey);
        if (messageNumber <= lastMsgNum) {
          console.log(`[Webhook Guard] Ignored duplicate/echo message #${messageNumber} for channel: ${lockKey}`);
          return res.status(200).json({ status: 'DUPLICATE_MESSAGE_IGNORED', messageNumber });
        }
      }

      // 2. ANTI-REBOND (DEBOUNCING 5s) : Ignorer les rafales en boucle
      if (debounceLockMap.has(lockKey)) {
        const lastTime = debounceLockMap.get(lockKey);
        if (now - lastTime < 5000) {
          console.log(`[Webhook Debounce] Ignored burst notification for lockKey: ${lockKey}`);
          return res.status(200).json({ status: 'DEBOUNCED' });
        }
      }

      if (messageNumber) messageNumberMap.set(lockKey, messageNumber);
      debounceLockMap.set(lockKey, now);

      console.log(`[Webhook Push] Valid Google Calendar event change detected (Msg #${messageNumber}) for channel: ${channelId}`);

      return res.status(200).json({
        status: 'SCHEDULE_RECALCULATION_TRIGGERED',
        channelId,
        messageNumber,
        timestamp: new Date().toISOString()
      });
    }

    return res.status(200).send('OK');
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
}
