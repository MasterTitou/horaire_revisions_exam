import crypto from 'crypto';
import { sql, initSchema } from './db.js';

const AUTH_SECRET = process.env.AUTH_SECRET || 'revision-planner-default-secret';

function generateToken(password) {
  return crypto.createHmac('sha256', AUTH_SECRET).update(password).digest('hex');
}

function verifyToken(token) {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) return true;
  const expected = generateToken(appPassword);
  return token === expected;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (!verifyToken(token)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const payload = req.body;
  if (!payload) {
    return res.status(400).json({ error: 'Payload manquant' });
  }

  // Stamp current save time
  payload.updatedAt = new Date().toISOString();

  // 1. Sauvegarde dans PostgreSQL si POSTGRES_URL est configuré
  if (process.env.POSTGRES_URL) {
    try {
      await initSchema();

      const { projects = [], scheduleData = {} } = payload;
      const activeProjIds = projects.map(p => p.id);
      const activeMilestoneIds = [];
      const activeSessionIds = [];

      // Upsert all projects first
      for (const p of projects) {
        await sql`
          INSERT INTO projects (id, name, code, color, deadline, is_hard_deadline)
          VALUES (${p.id}, ${p.name}, ${p.code}, ${p.color}, ${p.deadline || null}, ${p.isHardDeadline})
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            code = EXCLUDED.code,
            color = EXCLUDED.color,
            deadline = EXCLUDED.deadline,
            is_hard_deadline = EXCLUDED.is_hard_deadline;
        `;

        for (const m of p.milestones || []) {
          activeMilestoneIds.push(m.id);
          await sql`
            INSERT INTO milestones (id, project_id, title, estimated_hours, completed_hours, due_date, cognitive_load, is_hard_deadline, is_completed)
            VALUES (${m.id}, ${p.id}, ${m.title}, ${m.estimatedHours}, ${m.completedHours}, ${m.dueDate || null}, ${m.cognitiveLoad}, ${m.isHardDeadline}, ${m.isCompleted})
            ON CONFLICT (id) DO UPDATE SET
              title = EXCLUDED.title,
              estimated_hours = EXCLUDED.estimated_hours,
              completed_hours = EXCLUDED.completed_hours,
              due_date = EXCLUDED.due_date,
              cognitive_load = EXCLUDED.cognitive_load,
              is_hard_deadline = EXCLUDED.is_hard_deadline,
              is_completed = EXCLUDED.is_completed;
          `;

          // Clean old dependencies for this milestone before re-inserting
          await sql`DELETE FROM milestone_dependencies WHERE child_milestone_id = ${m.id}`;

          for (const parentId of m.dependsOn || []) {
            await sql`
              INSERT INTO milestone_dependencies (parent_milestone_id, child_milestone_id)
              VALUES (${parentId}, ${m.id})
              ON CONFLICT DO NOTHING;
            `;
          }
        }
      }

      // Purge des sessions d'abord (dépend de milestones via FK)
      for (const [dateStr, sessions] of Object.entries(scheduleData)) {
        for (const s of (sessions || [])) {
          if (s.milestoneId) {
            activeSessionIds.push(s.id);
            await sql`
              INSERT INTO sessions (id, milestone_id, session_date, slot_index, note, is_completed)
              VALUES (${s.id}, ${s.milestoneId}, ${dateStr}, 0, ${s.note}, ${s.isCompleted})
              ON CONFLICT (id) DO UPDATE SET
                is_completed = EXCLUDED.is_completed,
                note = EXCLUDED.note;
            `;
          }
        }
      }

      // Purger les séances supprimées (AVANT milestones à cause de la FK)
      if (activeSessionIds.length > 0) {
        // @vercel/postgres tagged templates: utilise ANY() pour le IN dynamique
        await sql`DELETE FROM sessions WHERE id != ALL(${activeSessionIds})`;
      } else {
        await sql`DELETE FROM sessions`;
      }

      // Purger les jalons supprimés (AVANT projets à cause de la FK)
      if (activeMilestoneIds.length > 0) {
        await sql`DELETE FROM milestones WHERE id != ALL(${activeMilestoneIds})`;
      } else {
        await sql`DELETE FROM milestones`;
      }

      // Purger les projets supprimés
      if (activeProjIds.length > 0) {
        await sql`DELETE FROM projects WHERE id != ALL(${activeProjIds})`;
      } else {
        await sql`DELETE FROM projects`;
      }

      // Sauvegarder les métadonnées globales (gamification, streak, settings, etc.)
      const metaPayload = JSON.stringify({
        streak: payload.streak || { count: 0, lastDate: '' },
        gamification: payload.gamification || null,
        chatHistory: payload.chatHistory || [],
        externalEvents: payload.externalEvents || [],
        userSettings: payload.userSettings || null,
        icalFeeds: payload.icalFeeds || payload.userSettings?.icalFeeds || [],
        isDarkMode: !!payload.isDarkMode
      });


      const incomingUpdatedAt = payload.updatedAt || new Date().toISOString();

      await sql`
        INSERT INTO app_metadata (id, payload, updated_at)
        VALUES ('global_state', ${metaPayload}::jsonb, ${incomingUpdatedAt}::timestamptz)
        ON CONFLICT (id) DO UPDATE SET
          payload = CASE WHEN EXCLUDED.updated_at >= app_metadata.updated_at THEN EXCLUDED.payload ELSE app_metadata.payload END,
          updated_at = CASE WHEN EXCLUDED.updated_at >= app_metadata.updated_at THEN EXCLUDED.updated_at ELSE app_metadata.updated_at END;
      `;

    } catch (pgError) {
      console.error('Erreur Save PostgreSQL:', pgError.message);
    }
  }


  // 2. Sauvegarde miroir dans Redis KV
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (kvUrl && kvToken) {
    try {
      await fetch(`${kvUrl}/set/user_data`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${kvToken}` },
        body: JSON.stringify(payload)
      });
    } catch (kvErr) {
      console.error('Erreur Save Redis KV:', kvErr.message);
    }
  }

  return res.status(200).json({ success: true, updatedAt: payload.updatedAt });
}
