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
  if (req.method !== 'GET') {
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

  // 1. Essai de chargement depuis PostgreSQL si POSTGRES_URL est présent
  if (process.env.POSTGRES_URL) {
    try {
      await initSchema(); // Auto-création automatique si absente

      const projectsRes = await sql`SELECT * FROM projects ORDER BY created_at ASC`;
      const milestonesRes = await sql`SELECT * FROM milestones ORDER BY created_at ASC`;
      const depsRes = await sql`SELECT * FROM milestone_dependencies`;
      const sessionsRes = await sql`SELECT * FROM sessions ORDER BY session_date ASC`;

      const milestonesMap = new Map();
      milestonesRes.rows.forEach(m => {
        milestonesMap.set(m.id, {
          id: m.id,
          title: m.title,
          estimatedHours: parseFloat(m.estimated_hours),
          completedHours: parseFloat(m.completed_hours),
          dueDate: m.due_date ? new Date(m.due_date).toISOString().split('T')[0] : '',
          cognitiveLoad: m.cognitive_load || 'medium',
          isHardDeadline: m.is_hard_deadline,
          isCompleted: m.is_completed,
          dependsOn: []
        });
      });

      depsRes.rows.forEach(d => {
        const child = milestonesMap.get(d.child_milestone_id);
        if (child) {
          child.dependsOn.push(d.parent_milestone_id);
        }
      });

      const projects = projectsRes.rows.map(p => ({
        id: p.id,
        name: p.name,
        code: p.code,
        color: p.color,
        deadline: p.deadline ? new Date(p.deadline).toISOString().split('T')[0] : '',
        isHardDeadline: p.is_hard_deadline,
        milestones: Array.from(milestonesMap.values()).filter(m => milestonesRes.rows.find(row => row.id === m.id && row.project_id === p.id))
      }));

      const scheduleData = {};
      sessionsRes.rows.forEach(s => {
        const dateStr = new Date(s.session_date).toISOString().split('T')[0];
        if (!scheduleData[dateStr]) scheduleData[dateStr] = [];
        const ms = milestonesMap.get(s.milestone_id);
        scheduleData[dateStr].push({
          id: s.id,
          projectId: ms ? ms.project_id : '',
          milestoneId: s.milestone_id,
          note: s.note || '',
          isCompleted: s.is_completed
        });
      });

      return res.status(200).json({
        projects,
        scheduleData,
        source: 'PostgreSQL Relational DB'
      });
    } catch (pgError) {
      console.log('PostgreSQL fallback vers Redis KV:', pgError.message);
    }
  }

  // 2. Fallback vers Redis KV / Upstash Redis REST
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (kvUrl && kvToken) {
    try {
      const response = await fetch(`${kvUrl}/get/user_data`, {
        headers: { Authorization: `Bearer ${kvToken}` }
      });
      if (response.ok) {
        const kvData = await response.json();
        const result = kvData.result ? JSON.parse(kvData.result) : null;
        return res.status(200).json(result);
      }
    } catch (error) {
      console.error('Erreur Redis KV:', error);
    }
  }

  return res.status(200).json(null);
}
