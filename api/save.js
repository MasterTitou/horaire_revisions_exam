import crypto from 'crypto';
import { sql } from '@vercel/postgres';

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

  // Vérification Auth
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

  // 1. Sauvegarde dans PostgreSQL si POSTGRES_URL est configuré
  if (process.env.POSTGRES_URL) {
    try {
      const { projects = [], scheduleData = {} } = payload;

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

          // Sauvegarde des dépendances DAG
          for (const parentId of m.dependsOn || []) {
            await sql`
              INSERT INTO milestone_dependencies (parent_milestone_id, child_milestone_id)
              VALUES (${parentId}, ${m.id})
              ON CONFLICT DO NOTHING;
            `;
          }
        }
      }

      // Sauvegarde des Séances du calendrier
      for (const [dateStr, sessions] of Object.entries(scheduleData)) {
        for (const s of (sessions || [])) {
          if (s.milestoneId) {
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
    } catch (pgError) {
      console.error('Erreur Save PostgreSQL:', pgError.message);
    }
  }

  // 2. Sauvegarde miroir dans Redis KV (Vercel KV / Upstash)
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

  return res.status(200).json({ success: true });
}
