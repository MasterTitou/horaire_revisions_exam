// api/calendar/ical.js
// Support iCal complet : un-folding RFC 5545, extraction TZID/RRULE/EXDATE et export .ics

/**
 * Parse un fichier .ics brut, gère les lignes dépliées, les paramètres TZID,
 * l'expansion des RRULE (DAILY/WEEKLY avec COUNT/UNTIL) et le filtrage EXDATE.
 */
export function parseICalFeed(icsText) {
  if (!icsText) return [];

  // 1. Dépliage des lignes coupées RFC 5545 (lignes commençant par espace ou tabulation)
  const rawLines = icsText.split(/\r\n|\n|\r/);
  const unfoldedLines = [];
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if ((line.startsWith(' ') || line.startsWith('\t')) && unfoldedLines.length > 0) {
      unfoldedLines[unfoldedLines.length - 1] += line.substring(1);
    } else {
      unfoldedLines.push(line.trim());
    }
  }

  const rawEvents = [];
  let currentEvent = null;

  for (let i = 0; i < unfoldedLines.length; i++) {
    const line = unfoldedLines[i];
    if (line === 'BEGIN:VEVENT') {
      currentEvent = {
        id: 'ical_' + Math.random().toString(36).substr(2, 9),
        source: 'ical',
        exdates: []
      };
    } else if (line === 'END:VEVENT') {
      if (currentEvent && currentEvent.startTime && currentEvent.endTime) {
        rawEvents.push(currentEvent);
      }
      currentEvent = null;
    } else if (currentEvent) {
      if (line.startsWith('SUMMARY:')) {
        currentEvent.title = line.substring(8);
      } else if (line.startsWith('DTSTART')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) {
          const val = line.substring(colonIdx + 1);
          currentEvent.startTime = parseICalDate(val);
        }
      } else if (line.startsWith('DTEND')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) {
          const val = line.substring(colonIdx + 1);
          currentEvent.endTime = parseICalDate(val);
        }
      } else if (line.startsWith('RRULE:')) {
        currentEvent.rrule = line.substring(6);
      } else if (line.startsWith('EXDATE')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) {
          const val = line.substring(colonIdx + 1);
          const dates = val.split(',').map(d => parseICalDate(d).split('T')[0]);
          currentEvent.exdates.push(...dates);
        }
      }
    }
  }

  // 2. Expansion des récurrences (RRULE)
  const finalEvents = [];
  const horizonDays = 30;
  const now = new Date();
  const maxHorizonMs = now.getTime() + horizonDays * 86400000;

  rawEvents.forEach(ev => {
    if (!ev.rrule) {
      finalEvents.push(ev);
      return;
    }

    // Extraction des paramètres RRULE
    const rruleParams = {};
    ev.rrule.split(';').forEach(pair => {
      const [k, v] = pair.split('=');
      if (k && v) rruleParams[k] = v;
    });

    const freq = rruleParams['FREQ'];
    const count = rruleParams['COUNT'] ? parseInt(rruleParams['COUNT'], 10) : 30;
    let untilMs = maxHorizonMs;
    if (rruleParams['UNTIL']) {
      untilMs = new Date(parseICalDate(rruleParams['UNTIL'])).getTime();
    }

    const startD = new Date(ev.startTime);
    const endD = new Date(ev.endTime);
    const durationMs = endD.getTime() - startD.getTime();
    const exdateSet = new Set(ev.exdates || []);

    let occurrenceCount = 0;
    let currentStartMs = startD.getTime();

    while (occurrenceCount < count && currentStartMs <= Math.min(untilMs, maxHorizonMs)) {
      const occurrenceStart = new Date(currentStartMs);
      const dateKey = occurrenceStart.toISOString().split('T')[0];

      // Vérifier si cette date n'est pas dans la liste des exclusions EXDATE
      if (!exdateSet.has(dateKey)) {
        finalEvents.push({
          ...ev,
          id: `${ev.id}_occ_${occurrenceCount}`,
          startTime: occurrenceStart.toISOString(),
          endTime: new Date(currentStartMs + durationMs).toISOString()
        });
      }

      occurrenceCount++;
      if (freq === 'DAILY') {
        currentStartMs += 86400000;
      } else if (freq === 'WEEKLY') {
        currentStartMs += 7 * 86400000;
      } else if (freq === 'MONTHLY') {
        const nextD = new Date(currentStartMs);
        nextD.setMonth(nextD.getMonth() + 1);
        currentStartMs = nextD.getTime();
      } else {
        break; // Fréquence non supportée, on arrête la boucle
      }
    }
  });

  return finalEvents;
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
  if ((req.method === 'GET' || req.method === 'POST') && req.query.action === 'export') {
    let sessionsToExport = [];
    if (req.body && Array.isArray(req.body.sessions)) {
      sessionsToExport = req.body.sessions;
    } else if (req.query.data) {
      try {
        sessionsToExport = JSON.parse(decodeURIComponent(req.query.data));
      } catch (e) {}
    }

    const timezone = req.query.timezone || req.body?.timezone || 'Europe/Paris';
    const icsContent = generateICalExport(sessionsToExport, timezone);

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
