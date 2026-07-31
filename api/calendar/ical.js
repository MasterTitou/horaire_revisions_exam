// api/calendar/ical.js
// Support iCal pour import des événements externes et export des séances de travail sous format .ics

/**
 * Parse un fichier .ics brut et extrait les événements avec leurs horodatages ISO UTC.
 */
export function parseICalFeed(icsText) {
  const events = [];
  const lines = icsText.split(/\r\n|\n|\r/);
  
  let currentEvent = null;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (line === 'BEGIN:VEVENT') {
      currentEvent = { id: 'ical_' + Math.random().toString(36).substr(2, 9), source: 'ical' };
    } else if (line === 'END:VEVENT') {
      if (currentEvent && currentEvent.startTime && currentEvent.endTime) {
        events.push(currentEvent);
      }
      currentEvent = null;
    } else if (currentEvent) {
      if (line.startsWith('SUMMARY:')) {
        currentEvent.title = line.substring(8);
      } else if (line.startsWith('DTSTART')) {
        const val = line.split(':')[1];
        currentEvent.startTime = parseICalDate(val);
      } else if (line.startsWith('DTEND')) {
        const val = line.split(':')[1];
        currentEvent.endTime = parseICalDate(val);
      }
    }
  }

  return events;
}

function parseICalDate(dateStr) {
  if (!dateStr) return new Date().toISOString();
  
  const clean = dateStr.replace(/[^0-9T]/g, '');
  if (clean.length >= 15) {
    const year = clean.substring(0, 4);
    const month = clean.substring(4, 6);
    const day = clean.substring(6, 8);
    const hour = clean.substring(9, 11);
    const min = clean.substring(11, 13);
    const sec = clean.substring(13, 15);
    return `${year}-${month}-${day}T${hour}:${min}:${sec}.000Z`;
  } else if (clean.length >= 8) {
    const year = clean.substring(0, 4);
    const month = clean.substring(4, 6);
    const day = clean.substring(6, 8);
    return `${year}-${month}-${day}T00:00:00.000Z`;
  }
  return new Date().toISOString();
}

/**
 * Génère un flux .ics iCal sortant des sessions de révision planifiées
 */
export function generateICalExport(sessions, timezone = 'Europe/Paris') {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CalendrierRevisions//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-TIMEZONE:${timezone}`
  ];

  sessions.forEach(sess => {
    if (!sess.startTime || !sess.endTime) return;
    
    const startFormatted = new Date(sess.startTime).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const endFormatted = new Date(sess.endTime).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${sess.id}@calendrier-revisions.app`);
    lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
    lines.push(`DTSTART:${startFormatted}`);
    lines.push(`DTEND:${endFormatted}`);
    lines.push(`SUMMARY:📘 ${sess.note || 'Session de travail'}`);
    lines.push('STATUS:CONFIRMED');
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export default async function handler(req, res) {
  if (req.method === 'GET' && req.query.action === 'export') {
    const icsContent = generateICalExport([]);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="sessions_revision.ics"');
    return res.status(200).send(icsContent);
  }

  if (req.method === 'POST' && req.body.icalUrl) {
    try {
      const response = await fetch(req.body.icalUrl);
      const text = await response.text();
      const events = parseICalFeed(text);
      return res.status(200).json({ success: true, events });
    } catch (err) {
      return res.status(500).json({ error: 'Erreur lors du téléchargement du flux iCal' });
    }
  }

  return res.status(400).json({ error: 'Action iCal invalide' });
}
