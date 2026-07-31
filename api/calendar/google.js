// api/calendar/google.js
// Gestion de la synchronisation bidirectionnelle Google Calendar API v3

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

  if (req.method === 'POST' && action === 'fetch_events') {
    const { accessToken } = req.body;
    if (!accessToken) {
      return res.status(400).json({ error: 'Jeton d\'accès (accessToken) requis' });
    }

    try {
      const now = new Date();
      const timeMin = new Date(now.setDate(now.getDate() - 7)).toISOString();
      const timeMax = new Date(now.setDate(now.getDate() + 30)).toISOString();

      const gRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      const data = await gRes.json();
      if (data.error) {
        return res.status(400).json({ error: data.error.message });
      }

      const events = (data.items || []).map(item => ({
        id: `gcal_${item.id}`,
        title: item.summary || 'Événement Externe',
        startTime: item.start?.dateTime || item.start?.date || new Date().toISOString(),
        endTime: item.end?.dateTime || item.end?.date || new Date().toISOString(),
        isAllDay: !item.start?.dateTime,
        source: 'google'
      }));

      return res.status(200).json({ success: true, events });
    } catch (err) {
      return res.status(500).json({ error: 'Erreur lors de la récupération des événements Google Calendar' });
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
