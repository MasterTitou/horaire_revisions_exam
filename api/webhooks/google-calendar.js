// api/webhooks/google-calendar.js
// Traitement des notifications Push Webhook Google Calendar avec re-sync réelle
// Anti-résonance (Message-Number Guard + Debounce) + Persistance BDD

import { sql } from '../db.js';
import { getValidAccessToken, fetchAllGoogleEvents } from '../calendar/google.js';

function isPostgresConfigured() {
  return Boolean(process.env.POSTGRES_URL || process.env.VERCEL_POSTGRES_URL || process.env.POSTGRES_PRISMA_URL);
}

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

    // Sync confirmation
    if (resourceState === 'sync') {
      return res.status(200).send('SYNC_OK');
    }

    if (resourceState === 'exists') {
      const lockKey = channelId || resourceId || 'global_gcal_lock';
      const now = Date.now();

      // 1. GUARD ANTI-RÉSONANCE PAR MESSAGE NUMBER
      if (messageNumber && messageNumberMap.has(lockKey)) {
        const lastMsgNum = messageNumberMap.get(lockKey);
        if (messageNumber <= lastMsgNum) {
          return res.status(200).json({ status: 'DUPLICATE_MESSAGE_IGNORED', messageNumber });
        }
      }

      // 2. ANTI-REBOND (DEBOUNCING 5s)
      if (debounceLockMap.has(lockKey)) {
        const lastTime = debounceLockMap.get(lockKey);
        if (now - lastTime < 5000) {
          return res.status(200).json({ status: 'DEBOUNCED' });
        }
      }

      if (messageNumber) messageNumberMap.set(lockKey, messageNumber);
      debounceLockMap.set(lockKey, now);

      console.log(`[Webhook Push] Valid Google Calendar change (Msg #${messageNumber}) for channel: ${channelId}`);

      // 3. RE-SYNC RÉELLE : Récupérer les événements mis à jour depuis Google
      try {
        const userKey = 'default_user';
        const accessToken = await getValidAccessToken(userKey);

        if (accessToken) {
          const events = await fetchAllGoogleEvents(accessToken);

          // Persister les événements mis à jour dans app_metadata
          if (isPostgresConfigured() && events.length > 0) {
            try {
              // Lire le payload actuel
              const metaRes = await sql`
                SELECT payload FROM app_metadata WHERE id = 'global_state';
              `;

              if (metaRes.rows.length > 0) {
                const currentPayload = metaRes.rows[0].payload || {};
                const existingEvents = currentPayload.externalEvents || [];

                // Remplacer uniquement les événements Google (conserver manuels + iCal)
                const nonGoogleEvents = existingEvents.filter(
                  ev => !ev.id?.startsWith('gcal_') && ev.source !== 'google'
                );
                const updatedEvents = [...nonGoogleEvents, ...events];

                const updatedPayload = {
                  ...currentPayload,
                  externalEvents: updatedEvents
                };

                await sql`
                  UPDATE app_metadata
                  SET payload = ${JSON.stringify(updatedPayload)}::jsonb,
                      updated_at = NOW()
                  WHERE id = 'global_state';
                `;

                console.log(`[Webhook Sync] ${events.length} événements Google mis à jour en BDD`);
              }
            } catch (dbErr) {
              console.error('[Webhook Sync] Erreur BDD:', dbErr.message);
            }
          }

          return res.status(200).json({
            status: 'SYNC_COMPLETED',
            channelId,
            messageNumber,
            eventsUpdated: events.length,
            timestamp: new Date().toISOString()
          });
        } else {
          console.warn('[Webhook] Aucun token Google valide, re-sync impossible');
          return res.status(200).json({
            status: 'SYNC_SKIPPED_NO_TOKEN',
            channelId,
            messageNumber
          });
        }
      } catch (syncErr) {
        console.error('[Webhook Sync] Erreur:', syncErr.message);
        return res.status(200).json({
          status: 'SYNC_ERROR',
          error: syncErr.message
        });
      }
    }

    return res.status(200).send('OK');
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
}
