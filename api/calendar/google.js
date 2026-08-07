// api/calendar/google.js
// Gestion de la synchronisation bidirectionnelle Google Calendar API v3 Multi-Agendas (École, Travail, Secondaires)
// Avec persistance des tokens OAuth en BDD et souscription Webhook

import { sql } from './db.js';

function isPostgresConfigured() {
  return Boolean(process.env.POSTGRES_URL || process.env.VERCEL_POSTGRES_URL || process.env.POSTGRES_PRISMA_URL);
}

// ─── Helpers Token Persistence ────────────────────────────────────

async function storeGoogleTokens(userKey, accessToken, refreshToken) {
  if (!isPostgresConfigured()) return;
  try {
    if (refreshToken) {
      await sql`
        INSERT INTO calendar_integrations (user_key, provider, access_token, refresh_token, last_synced_at)
        VALUES (${userKey}, 'google', ${accessToken}, ${refreshToken}, NOW())
        ON CONFLICT (user_key, provider)
        DO UPDATE SET
          access_token = EXCLUDED.access_token,
          refresh_token = EXCLUDED.refresh_token,
          last_synced_at = NOW();
      `;
    } else {
      await sql`
        INSERT INTO calendar_integrations (user_key, provider, access_token, last_synced_at)
        VALUES (${userKey}, 'google', ${accessToken}, NOW())
        ON CONFLICT (user_key, provider)
        DO UPDATE SET
          access_token = EXCLUDED.access_token,
          last_synced_at = NOW();
      `;
    }
  } catch (e) {
    console.error('[Google Auth] Erreur stockage token en BDD:', e.message);
  }
}

async function getStoredGoogleTokens(userKey) {
  if (!isPostgresConfigured()) return null;
  try {
    const result = await sql`
      SELECT access_token, refresh_token, webhook_channel_id, webhook_resource_id, webhook_expiration
      FROM calendar_integrations
      WHERE user_key = ${userKey} AND provider = 'google'
      LIMIT 1;
    `;
    if (result.rows.length > 0) return result.rows[0];
  } catch (e) {
    console.error('[Google Auth] Erreur lecture tokens BDD:', e.message);
  }
  return null;
}

async function refreshAccessToken(userKey, refreshToken) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret || !refreshToken) return null;

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });

    const data = await res.json();
    if (data.access_token) {
      await storeGoogleTokens(userKey, data.access_token, null); // preserve existing refresh_token
      return data.access_token;
    }
    console.error('[Google Refresh] Échec refresh token:', data.error);
  } catch (e) {
    console.error('[Google Refresh] Erreur réseau:', e.message);
  }
  return null;
}

async function getValidAccessToken(userKey) {
  const stored = await getStoredGoogleTokens(userKey);
  if (!stored) return null;

  // Try current access_token first
  if (stored.access_token) {
    const testRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1', {
      headers: { 'Authorization': `Bearer ${stored.access_token}` }
    });
    if (testRes.ok) return stored.access_token;
  }

  // Expired → refresh
  if (stored.refresh_token) {
    return await refreshAccessToken(userKey, stored.refresh_token);
  }

  return null;
}

async function updateWebhookInfo(userKey, channelId, resourceId, expiration) {
  if (!isPostgresConfigured()) return;
  try {
    await sql`
      UPDATE calendar_integrations
      SET webhook_channel_id = ${channelId},
          webhook_resource_id = ${resourceId},
          webhook_expiration = ${expiration}
      WHERE user_key = ${userKey} AND provider = 'google';
    `;
  } catch (e) {
    console.error('[Webhook] Erreur MAJ webhook info:', e.message);
  }
}

// ─── Google Calendar Event Fetching ───────────────────────────────

async function fetchAllGoogleEvents(accessToken) {
  const now = new Date();
  const timeMin = new Date(now.getTime() - 7 * 86400000).toISOString();
  const timeMax = new Date(now.getTime() + 30 * 86400000).toISOString();

  // 1. Lister tous les agendas
  const calListRes = await fetch(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList',
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );

  const calListData = await calListRes.json();
  const calendars = calListData.items || [{ id: 'primary' }];

  let allEvents = [];

  // 2. Parcourir chaque agenda
  for (const cal of calendars) {
    try {
      const gRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );

      const data = await gRes.json();
      if (data.items) {
        const calName = cal.summary || 'Agenda';
        const mapped = data.items.map(item => {
          const isAllDay = !item.start?.dateTime;

          let startTime, endTime;
          if (isAllDay) {
            // Événement all-day : borner de 00:00 à 23:59 en heure locale
            startTime = `${item.start?.date}T00:00:00`;
            endTime = `${item.end?.date || item.start?.date}T23:59:59`;
          } else {
            startTime = item.start.dateTime;
            endTime = item.end.dateTime;
          }

          return {
            id: `gcal_${item.id}`,
            title: item.summary ? `[${calName}] ${item.summary}` : `[${calName}] Événement Occupé`,
            startTime,
            endTime,
            isAllDay,
            source: 'google'
          };
        });
        allEvents = allEvents.concat(mapped);
      }
    } catch (calErr) {
      console.error(`Erreur fetch agenda ${cal.id}:`, calErr.message);
    }
  }

  return allEvents;
}

// ─── Main Handler ─────────────────────────────────────────────────

export default async function handler(req, res) {
  const { action } = req.query;

  // ─── AUTH URL ───
  if (req.method === 'GET' && action === 'auth_url') {
    const clientId = (process.env.GOOGLE_CLIENT_ID || req.query.client_id || '').trim().replace(/^["']|["']$/g, '');
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_CLIENT_ID',
        message: 'GOOGLE_CLIENT_ID non configuré sur le serveur Vercel.'
      });
    }

    const host = req.headers['x-forwarded-host'] || req.headers.host || 'horaire-revisions-exam.vercel.app';
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const defaultRedirectUri = `${proto}://${host}/api/calendar/google?action=callback`;
    const redirectUri = (process.env.GOOGLE_REDIRECT_URI || defaultRedirectUri).trim().replace(/^["']|["']$/g, '');

    const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly');
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&access_type=offline&prompt=consent`;

    return res.status(200).json({ url: authUrl });
  }

  // ─── OAUTH2 CALLBACK ───
  if (req.method === 'GET' && action === 'callback') {
    const { code } = req.query;
    const clientId = (process.env.GOOGLE_CLIENT_ID || req.query.client_id || '').trim().replace(/^["']|["']$/g, '');
    const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim().replace(/^["']|["']$/g, '');
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'horaire-revisions-exam.vercel.app';
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const defaultRedirectUri = `${proto}://${host}/api/calendar/google?action=callback`;
    const redirectUri = (process.env.GOOGLE_REDIRECT_URI || defaultRedirectUri).trim().replace(/^["']|["']$/g, '');

    if (!code || !clientId || !clientSecret) {
      return res.status(400).send('Variables GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET requises dans Vercel.');
    }

    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code'
        })
      });

      const tokenData = await tokenRes.json();
      if (tokenData.access_token) {
        // C3: Stocker les tokens en BDD
        const userKey = 'default_user';
        await storeGoogleTokens(userKey, tokenData.access_token, tokenData.refresh_token || null);

        return res.send(`
          <!DOCTYPE html>
          <html>
            <head><title>Google Auth Success</title></head>
            <body style="font-family: sans-serif; text-align: center; padding: 40px; background: #0F172A; color: white;">
              <h2>✅ Synchronisation Multi-Agendas Google Réussie !</h2>
              <p>Tous vos agendas liés (École, Travail, Personnel) sont connectés.</p>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS', token: '${tokenData.access_token}' }, '*');
                  setTimeout(() => window.close(), 1500);
                }
              </script>
            </body>
          </html>
        `);
      } else {
        return res.status(400).send(`Erreur échange OAuth: ${tokenData.error_description || tokenData.error}`);
      }
    } catch (e) {
      return res.status(500).send('Erreur serveur lors de l\'échange de jeton Google');
    }
  }

  // ─── FETCH EVENTS (Multi-Agendas) ───
  if (req.method === 'POST' && action === 'fetch_events') {
    let accessToken = req.body?.accessToken;

    // Si pas de token dans le body, essayer de le récupérer depuis la BDD
    if (!accessToken) {
      const userKey = 'default_user';
      accessToken = await getValidAccessToken(userKey);
    }

    if (!accessToken) {
      return res.status(400).json({ error: 'Jeton d\'accès (accessToken) requis ou expiré.' });
    }

    try {
      const allEvents = await fetchAllGoogleEvents(accessToken);
      return res.status(200).json({ success: true, events: allEvents });
    } catch (err) {
      return res.status(500).json({ error: 'Erreur lors de la récupération des événements multi-agendas Google Calendar' });
    }
  }

  // ─── SYNC SESSION TO GOOGLE ───
  if (req.method === 'POST' && action === 'sync_session') {
    let accessToken = req.body?.accessToken;
    const session = req.body?.session;

    if (!accessToken) {
      accessToken = await getValidAccessToken('default_user');
    }

    if (!accessToken || !session) {
      return res.status(400).json({ error: 'accessToken et session requis' });
    }

    try {
      const eventBody = {
        summary: `📘 ${session.note || 'Session de travail'}`,
        description: 'Session de révision générée automatiquement par CalendrierRevisions',
        start: {
          dateTime: session.startTime || new Date().toISOString()
        },
        end: {
          dateTime: session.endTime || new Date(Date.now() + 3600000).toISOString()
        }
      };

      const gRes = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(eventBody)
        }
      );

      const createdEvent = await gRes.json();
      return res.status(200).json({ success: true, eventId: createdEvent.id });
    } catch (err) {
      return res.status(500).json({ error: 'Erreur lors de la création dans Google Calendar' });
    }
  }

  // ─── C4: SUBSCRIBE WEBHOOK ───
  if (req.method === 'POST' && action === 'subscribe_webhook') {
    const userKey = 'default_user';
    const accessToken = await getValidAccessToken(userKey);

    if (!accessToken) {
      return res.status(400).json({ error: 'Aucun token Google valide pour créer le webhook.' });
    }

    const webhookUrl = process.env.GOOGLE_WEBHOOK_URL || 'https://horaire-revisions-exam.vercel.app/api/webhooks/google-calendar';
    const channelId = `cal_watch_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const expiration = new Date(Date.now() + 7 * 24 * 3600 * 1000); // 7 jours

    try {
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
            expiration: expiration.getTime()
          })
        }
      );

      const watchData = await watchRes.json();

      if (watchRes.ok && watchData.id) {
        await updateWebhookInfo(
          userKey,
          watchData.id,
          watchData.resourceId,
          new Date(parseInt(watchData.expiration)).toISOString()
        );

        return res.status(200).json({
          success: true,
          channelId: watchData.id,
          resourceId: watchData.resourceId,
          expiration: watchData.expiration
        });
      } else {
        return res.status(400).json({ error: 'Échec création webhook Google', details: watchData });
      }
    } catch (err) {
      return res.status(500).json({ error: 'Erreur réseau lors de la souscription webhook' });
    }
  }

  // ─── REFRESH TOKEN ENDPOINT ───
  if (req.method === 'POST' && action === 'refresh_token') {
    const userKey = 'default_user';
    const newToken = await getValidAccessToken(userKey);
    if (newToken) {
      return res.status(200).json({ success: true, accessToken: newToken });
    }
    return res.status(401).json({ error: 'Impossible de rafraîchir le token Google' });
  }

  return res.status(400).json({ error: 'Action invalide' });
}

// Export for use by webhook and cron handlers
export { getValidAccessToken, fetchAllGoogleEvents, getStoredGoogleTokens, updateWebhookInfo };
