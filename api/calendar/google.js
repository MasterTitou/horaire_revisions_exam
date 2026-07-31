// api/calendar/google.js
// Gestion de la synchronisation bidirectionnelle Google Calendar API v3 Multi-Agendas (École, Travail, Secondaires)

export default async function handler(req, res) {
  const { action } = req.query;

  if (req.method === 'GET' && action === 'auth_url') {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.status(400).json({
        error: 'GOOGLE_CLIENT_ID non configuré',
        message: 'Veuillez ajouter la variable GOOGLE_CLIENT_ID dans Vercel ou utiliser le bouton 📅 1-clic direct sur les créneaux.'
      });
    }

    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://horaire-revisions-exam.vercel.app/api/calendar/google?action=callback';
    const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly');

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&access_type=offline&prompt=consent`;

    return res.status(200).json({ url: authUrl });
  }

  // Callback OAuth2 d'échange de code contre Access Token
  if (req.method === 'GET' && action === 'callback') {
    const { code } = req.query;
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://horaire-revisions-exam.vercel.app/api/calendar/google?action=callback';

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

  // Récupération Multi-Agendas (Primary + Agendas Secondaires / École / Travail)
  if (req.method === 'POST' && action === 'fetch_events') {
    const { accessToken } = req.body;
    if (!accessToken) {
      return res.status(400).json({ error: 'Jeton d\'accès (accessToken) requis' });
    }

    try {
      const now = new Date();
      const timeMin = new Date(now.setDate(now.getDate() - 7)).toISOString();
      const timeMax = new Date(now.setDate(now.getDate() + 30)).toISOString();

      // 1. Lister tous les agendas liés au compte Google (Principal + École + Secondaires)
      const calListRes = await fetch(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList',
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );

      const calListData = await calListRes.json();
      const calendars = calListData.items || [{ id: 'primary' }];

      let allEvents = [];

      // 2. Parcourir chaque agenda (École, Travail, Personnel) pour extraire les événements
      for (const cal of calendars) {
        try {
          const gRes = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
          );

          const data = await gRes.json();
          if (data.items) {
            const calName = cal.summary || 'Agenda';
            const mapped = data.items.map(item => ({
              id: `gcal_${item.id}`,
              title: item.summary ? `[${calName}] ${item.summary}` : `[${calName}] Événement Occupé`,
              startTime: item.start?.dateTime || item.start?.date || new Date().toISOString(),
              endTime: item.end?.dateTime || item.end?.date || new Date().toISOString(),
              isAllDay: !item.start?.dateTime,
              source: 'google'
            }));
            allEvents = allEvents.concat(mapped);
          }
        } catch (calErr) {
          console.error(`Erreur fetch agenda ${cal.id}:`, calErr.message);
        }
      }

      return res.status(200).json({ success: true, events: allEvents });
    } catch (err) {
      return res.status(500).json({ error: 'Erreur lors de la récupération des événements multi-agendas Google Calendar' });
    }
  }

  if (req.method === 'POST' && action === 'sync_session') {
    const { accessToken, session } = req.body;
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

  return res.status(400).json({ error: 'Action invalide' });
}
