// api/calendar/google.js
// Gestion de la synchronisation bidirectionnelle Google Calendar API v3 Multi-Agendas (École, Travail, Secondaires)
// Avec persistance des tokens OAuth en BDD, souscription Webhook et exportations nommées pour Cron & Webhooks

import { sql, initSchema } from '../db.js';

function isPostgresConfigured() {
  return Boolean(process.env.POSTGRES_URL || process.env.VERCEL_POSTGRES_URL || process.env.POSTGRES_PRISMA_URL);
}

const DEFAULT_ACTIVATION_URL = 'https://console.developers.google.com/apis/api/calendar-json.googleapis.com/overview';

const IGNORED_CALENDAR_SUFFIXES = [
  '#contacts@group.v.calendar.google.com',
  '#weeknum@group.v.calendar.google.com',
  '#holiday@group.v.calendar.google.com'
];

function extractActivationUrl(errData) {
  const details = errData?.error?.details || [];
  for (const d of details) {
    if (d?.metadata?.activationUrl) return d.metadata.activationUrl;
    if (Array.isArray(d?.links)) {
      const match = d.links.find(l => l?.url && l.url.includes('calendar-json.googleapis.com'));
      if (match) return match.url;
    }
  }
  const msg = errData?.error?.message || '';
  const urlMatch = msg.match(/https:\/\/console\.developers\.google\.com\/apis\/api\/calendar-json\.googleapis\.com[^\s]*/);
  return urlMatch ? urlMatch[0] : DEFAULT_ACTIVATION_URL;
}

function buildGoogleApiError(status, errData, fallbackMsg) {
  const err = new Error(errData?.error?.message || fallbackMsg);
  err.status = status;
  if (status === 403 || errData?.error?.status === 'PERMISSION_DENIED') {
    err.status = 403;
    err.serviceDisabled = true;
    err.activationUrl = extractActivationUrl(errData);
  }
  return err;
}

// ─── Helpers Token Persistence & Webhooks ─────────────────────────

export async function storeGoogleTokens(userKey, accessToken, refreshToken) {
  if (!isPostgresConfigured()) return;
  try {
    await initSchema();
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

export async function getStoredGoogleTokens(userKey) {
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

export async function refreshAccessToken(userKey, refreshToken) {
  const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim().replace(/^["']|["']$/g, '');
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim().replace(/^["']|["']$/g, '');
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
      await storeGoogleTokens(userKey, data.access_token, null);
      return data.access_token;
    }
  } catch (e) {
    console.error('[Google Refresh] Erreur réseau:', e.message);
  }
  return null;
}

export async function getValidAccessToken(userKey) {
  const stored = await getStoredGoogleTokens(userKey);
  if (!stored) return null;

  if (stored.access_token) {
    try {
      const testRes = await fetch(
        `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(stored.access_token)}`
      );
      if (testRes.ok) return stored.access_token;
    } catch (e) {
      console.error('[Google Auth] Erreur vérification tokeninfo:', e.message);
    }
  }

  if (stored.refresh_token) {
    return await refreshAccessToken(userKey, stored.refresh_token);
  }

  return null;
}

export async function updateWebhookInfo(userKey, channelId, resourceId, expiration) {
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

async function persistGoogleSyncToGlobalState({ connected, accessToken, events, onlyIfExists = false }) {
  if (!isPostgresConfigured()) return;
  try {
    await initSchema();
    const metaRes = await sql`SELECT payload FROM app_metadata WHERE id = 'global_state' LIMIT 1;`;
    const rowExists = Boolean(metaRes && metaRes.rows && metaRes.rows.length > 0);
    if (onlyIfExists && !rowExists) return;

    const currentPayload = rowExists ? (metaRes.rows[0].payload || {}) : {};
    const prevSettings = currentPayload.userSettings || {
      timezone: 'Europe/Paris',
      bufferMinutesBefore: 15,
      bufferMinutesAfter: 15,
      dayStartHour: 8,
      dayEndHour: 23,
      slotDurationMinutes: 60
    };

    const nextSettings = {
      ...prevSettings,
      ...(connected !== undefined ? { googleConnected: connected } : {}),
      ...(accessToken ? { googleAccessToken: accessToken } : {})
    };

    let nextExternalEvents = Array.isArray(currentPayload.externalEvents) ? currentPayload.externalEvents : [];
    if (Array.isArray(events)) {
      const nonGoogleEvents = nextExternalEvents.filter(
        ev => !ev.id?.startsWith('gcal_') && ev.source !== 'google'
      );
      nextExternalEvents = [...nonGoogleEvents, ...events];
    }

    const nowIso = new Date().toISOString();
    const updatedPayload = {
      ...currentPayload,
      userSettings: nextSettings,
      externalEvents: nextExternalEvents,
      updatedAt: nowIso
    };

    await sql`
      INSERT INTO app_metadata (id, payload, updated_at)
      VALUES ('global_state', ${JSON.stringify(updatedPayload)}::jsonb, ${nowIso}::timestamptz)
      ON CONFLICT (id) DO UPDATE SET
        payload = EXCLUDED.payload,
        updated_at = EXCLUDED.updated_at;
    `;
  } catch (e) {
    console.error('[Google Sync] Erreur persistance global_state:', e.message);
  }
}

export async function fetchAllGoogleEvents(accessToken) {
  const now = new Date();
  const timeMin = new Date(now.getTime() - 30 * 86400000).toISOString();
  const timeMax = new Date(now.getTime() + 90 * 86400000).toISOString();

  const calListRes = await fetch(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList',
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );

  if (calListRes.status === 401) {
    const err = new Error('Google accessToken expired or invalid (401)');
    err.status = 401;
    throw err;
  }

  if (!calListRes.ok) {
    const errData = await calListRes.json().catch(() => ({}));
    throw buildGoogleApiError(calListRes.status, errData, `Google Calendar API error (${calListRes.status})`);
  }

  const calListData = await calListRes.json().catch(() => ({}));
  const rawCalendars = (calListData.items && calListData.items.length > 0)
    ? calListData.items
    : [{ id: 'primary', summary: 'Google Agenda' }];

  const calendars = rawCalendars.filter(
    cal => cal?.id && !IGNORED_CALENDAR_SUFFIXES.some(suffix => cal.id.includes(suffix))
  );
  const targetCalendars = calendars.length > 0 ? calendars : [{ id: 'primary', summary: 'Google Agenda' }];

  const perCalendarResults = await Promise.all(
    targetCalendars.map(async (cal) => {
      const gRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?timeMin=${timeMin}&timeMax=${timeMax}&maxResults=250&singleEvents=true&orderBy=startTime`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );

      if (gRes.status === 401) {
        const err = new Error('Google accessToken expired or invalid (401)');
        err.status = 401;
        throw err;
      }

      if (!gRes.ok) {
        const errData = await gRes.json().catch(() => ({}));
        if (gRes.status === 403 || errData?.error?.status === 'PERMISSION_DENIED') {
          throw buildGoogleApiError(gRes.status, errData, `Google Calendar API forbidden (${gRes.status})`);
        }
        console.warn(`Erreur fetch agenda ${cal.id} (${gRes.status}):`, errData?.error?.message || '');
        return [];
      }

      const data = await gRes.json().catch(() => ({}));
      if (!data.items || !Array.isArray(data.items)) return [];

      const calName = cal.summary || 'Google Agenda';
      return data.items
        .filter(item => item.status !== 'cancelled' && item.transparency !== 'transparent')
        .map(item => {
          const isAllDay = !item.start?.dateTime;
          let startTime, endTime;
          if (isAllDay) {
            const startDateStr = item.start?.date;
            let endDateStr = item.end?.date || startDateStr;
            if (endDateStr && startDateStr && endDateStr > startDateStr) {
              const endD = new Date(`${endDateStr}T00:00:00Z`);
              endD.setUTCDate(endD.getUTCDate() - 1);
              endDateStr = endD.toISOString().split('T')[0];
            }
            startTime = `${startDateStr}T00:00:00`;
            endTime = `${endDateStr}T23:59:59`;
          } else {
            startTime = item.start.dateTime;
            endTime = item.end?.dateTime || item.start.dateTime;
          }

          return {
            id: `gcal_${item.id}`,
            title: item.summary ? `[Google · ${calName}] ${item.summary}` : `[Google · ${calName}] Occupé`,
            startTime,
            endTime,
            isAllDay,
            source: 'google'
          };
        });
    })
  );

  const uniqueById = new Map();
  perCalendarResults.flat().forEach(ev => {
    if (ev && ev.id && !uniqueById.has(ev.id)) {
      uniqueById.set(ev.id, ev);
    }
  });

  const allEvents = Array.from(uniqueById.values());
  allEvents.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  return allEvents;
}

// ─── Main Handler ─────────────────────────────────────────────────

export default async function handler(req, res) {
  const { action } = req.query;

  // ─── 1. AUTH URL ───
  if (req.method === 'GET' && action === 'auth_url') {
    const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim().replace(/^["']|["']$/g, '');
    if (!clientId) {
      return res.status(400).json({
        error: 'GOOGLE_CLIENT_ID non configuré',
        message: 'Veuillez ajouter la variable GOOGLE_CLIENT_ID dans Vercel ou utiliser le bouton 📅 1-clic direct sur les créneaux.'
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

  // ─── 2. OAUTH2 CALLBACK ───
  if (req.method === 'GET' && action === 'callback') {
    const { code } = req.query;
    const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim().replace(/^["']|["']$/g, '');
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
        await storeGoogleTokens('default_user', tokenData.access_token, tokenData.refresh_token || null);

        let initialEvents = null;
        try {
          initialEvents = await fetchAllGoogleEvents(tokenData.access_token);
        } catch (syncErr) {
          console.warn('[Google Callback] Sync initiale différée:', syncErr.message);
        }

        await persistGoogleSyncToGlobalState({
          connected: true,
          accessToken: tokenData.access_token,
          events: initialEvents,
          onlyIfExists: false
        });

        const safeTokenLiteral = JSON.stringify(tokenData.access_token);
        return res.send(`
          <!DOCTYPE html>
          <html lang="fr">
            <head>
              <meta charset="UTF-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
              <title>Google Auth Success</title>
            </head>
            <body style="font-family: sans-serif; text-align: center; padding: 40px 20px; background: #0F172A; color: white;">
              <h2>✅ Synchronisation Multi-Agendas Google Réussie !</h2>
              <p style="color: #94A3B8; margin-bottom: 24px;">Tous vos agendas liés (École, Travail, Personnel) sont connectés.</p>
              <a href="/?google_connected=1" style="display: inline-block; padding: 12px 20px; background: #0E8478; color: white; text-decoration: none; border-radius: 10px; font-weight: bold;">
                Retourner à l'application
              </a>
              <script>
                (function () {
                  var tok = ${safeTokenLiteral};
                  try { localStorage.setItem('google_access_token', tok); } catch (e) {}
                  if (window.opener) {
                    window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS', token: tok }, '*');
                    setTimeout(function () { window.close(); }, 1000);
                  } else {
                    setTimeout(function () { window.location.replace('/?google_connected=1'); }, 800);
                  }
                })();
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

  // ─── 3. FETCH EVENTS ───
  if (req.method === 'POST' && action === 'fetch_events') {
    let accessToken = req.body?.accessToken;
    let refreshedToken = null;

    if (!accessToken) {
      accessToken = await getValidAccessToken('default_user');
      refreshedToken = accessToken;
    }

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        tokenExpired: true,
        error: 'Session Google expirée ou absente. Veuillez reconnecter Google Calendar.'
      });
    }

    try {
      const allEvents = await fetchAllGoogleEvents(accessToken);
      const effectiveToken = refreshedToken || accessToken;
      await persistGoogleSyncToGlobalState({
        connected: true,
        accessToken: effectiveToken,
        events: allEvents,
        onlyIfExists: true
      });
      return res.status(200).json({
        success: true,
        events: allEvents,
        accessToken: effectiveToken
      });
    } catch (err) {
      if (err.status === 403 || err.serviceDisabled) {
        return res.status(403).json({
          success: false,
          serviceDisabled: true,
          activationUrl: err.activationUrl || DEFAULT_ACTIVATION_URL,
          error: "L'API Google Calendar n'est pas encore activée dans votre projet Google Cloud (1 clic requis) ou utilisez votre lien iCal secret Google."
        });
      }

      if (err.status === 401) {
        // Le token fourni par le client a expiré : tenter un refresh via la BDD
        const dbToken = await getValidAccessToken('default_user');
        if (dbToken && dbToken !== accessToken) {
          try {
            const allEvents = await fetchAllGoogleEvents(dbToken);
            await persistGoogleSyncToGlobalState({
              connected: true,
              accessToken: dbToken,
              events: allEvents,
              onlyIfExists: true
            });
            return res.status(200).json({
              success: true,
              events: allEvents,
              accessToken: dbToken
            });
          } catch (retryErr) {
            if (retryErr.status === 403 || retryErr.serviceDisabled) {
              return res.status(403).json({
                success: false,
                serviceDisabled: true,
                activationUrl: retryErr.activationUrl || DEFAULT_ACTIVATION_URL,
                error: "L'API Google Calendar n'est pas encore activée dans votre projet Google Cloud (1 clic requis) ou utilisez votre lien iCal secret Google."
              });
            }
          }
        }
        return res.status(401).json({
          success: false,
          tokenExpired: true,
          error: 'Votre jeton Google Calendar a expiré. Cliquez sur Reconnecter Google Calendar.'
        });
      }
      return res.status(500).json({ error: 'Erreur lors de la récupération des événements multi-agendas Google Calendar' });
    }
  }

  // ─── 4. SYNC SESSION ───
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

  // ─── 5. SUBSCRIBE WEBHOOK ───
  if (req.method === 'POST' && action === 'subscribe_webhook') {
    const userKey = 'default_user';
    const accessToken = await getValidAccessToken(userKey);

    if (!accessToken) {
      return res.status(400).json({ error: 'Aucun token Google valide pour créer le webhook.' });
    }

    const webhookUrl = process.env.GOOGLE_WEBHOOK_URL || 'https://horaire-revisions-exam.vercel.app/api/webhooks/google-calendar';
    const channelId = `cal_watch_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const expiration = new Date(Date.now() + 7 * 24 * 3600 * 1000);

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

  return res.status(400).json({ error: 'Action invalide' });
}
