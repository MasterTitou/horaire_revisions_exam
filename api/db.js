import { sql } from '@vercel/postgres';

const localQuotaStore = new Map();

// Vérification sécurisée si Postgres est disponible
function isPostgresConfigured() {
  return Boolean(process.env.POSTGRES_URL || process.env.VERCEL_POSTGRES_URL || process.env.POSTGRES_PRISMA_URL);
}

// Helper pour exécuter une requête SQL avec timeout et suppression complète d'exception
async function safeSql(queryFn, timeoutMs = 500) {
  if (!isPostgresConfigured()) return null;
  
  try {
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('PostgreSQL Timeout')), timeoutMs);
    });
    
    // Evaluation différée de la promesse sql
    const sqlPromise = Promise.resolve().then(() => queryFn());
    const result = await Promise.race([sqlPromise, timeoutPromise]);
    clearTimeout(timer);
    return result;
  } catch (err) {
    // Ne jamais crasher le processus Node.js sur une erreur DB
    return null;
  }
}

export async function initSchema() {
  if (!isPostgresConfigured()) return false;
  try {
    await safeSql(() => sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`, 1500);

    await safeSql(() => sql`
      CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50) NOT NULL,
        color VARCHAR(50) DEFAULT '#0E8478',
        start_date DATE,
        deadline DATE,
        is_hard_deadline BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `, 1500);

    await safeSql(() => sql`
      CREATE TABLE IF NOT EXISTS milestones (
        id VARCHAR(255) PRIMARY KEY,
        project_id VARCHAR(255) REFERENCES projects(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        estimated_hours NUMERIC(5,2) DEFAULT 10.00,
        completed_hours NUMERIC(5,2) DEFAULT 0.00,
        start_date DATE,
        due_date DATE,
        cognitive_load VARCHAR(20) DEFAULT 'medium',
        is_hard_deadline BOOLEAN DEFAULT TRUE,
        is_completed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `, 1500);

    await safeSql(() => sql`
      CREATE TABLE IF NOT EXISTS milestone_dependencies (
        parent_milestone_id VARCHAR(255) REFERENCES milestones(id) ON DELETE CASCADE,
        child_milestone_id VARCHAR(255) REFERENCES milestones(id) ON DELETE CASCADE,
        PRIMARY KEY (parent_milestone_id, child_milestone_id)
      );
    `, 1500);

    await safeSql(() => sql`
      CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(255) PRIMARY KEY,
        milestone_id VARCHAR(255) REFERENCES milestones(id) ON DELETE CASCADE,
        session_date DATE NOT NULL,
        slot_index INT DEFAULT 0,
        start_time TIMESTAMP WITH TIME ZONE,
        end_time TIMESTAMP WITH TIME ZONE,
        duration_minutes INT DEFAULT 60,
        note TEXT,
        is_completed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `, 1500);

    await safeSql(() => sql`
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS duration_minutes INT DEFAULT 60;
    `, 1000);

    await safeSql(() => sql`
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS start_date DATE;
    `, 1000);

    await safeSql(() => sql`
      ALTER TABLE milestones ADD COLUMN IF NOT EXISTS start_date DATE;
    `, 1000);

    await safeSql(() => sql`
      CREATE TABLE IF NOT EXISTS calendar_integrations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_key VARCHAR(255) DEFAULT 'default_user',
        provider VARCHAR(20) NOT NULL,
        calendar_id VARCHAR(255),
        ical_url TEXT,
        access_token TEXT,
        refresh_token TEXT,
        webhook_channel_id VARCHAR(255),
        webhook_resource_id VARCHAR(255),
        webhook_expiration TIMESTAMP WITH TIME ZONE,
        last_synced_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE (user_key, provider)
      );
    `, 1500);

    await safeSql(() => sql`
      ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS user_key VARCHAR(255) DEFAULT 'default_user';
    `, 1000);

    await safeSql(() => sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_integrations_user_provider ON calendar_integrations(user_key, provider);
    `, 1000);

    await safeSql(() => sql`
      CREATE TABLE IF NOT EXISTS ai_daily_quotas (
        user_key VARCHAR(255) NOT NULL,
        usage_date DATE NOT NULL,
        lite_count INT DEFAULT 0,
        heavy_count INT DEFAULT 0,
        lite_tokens INT DEFAULT 0,
        heavy_tokens INT DEFAULT 0,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (user_key, usage_date)
      );
    `, 1500);

    await safeSql(() => sql`
      CREATE TABLE IF NOT EXISTS app_metadata (
        id VARCHAR(50) PRIMARY KEY,
        payload JSONB,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `, 1500);
    return true;
  } catch (err) {
    return false;
  }
}


export async function getQuotaUsage(userKey, dateStr) {
  const key = `${userKey}:${dateStr}`;
  
  if (isPostgresConfigured()) {
    const result = await safeSql(() => sql`
      SELECT lite_count, heavy_count, lite_tokens, heavy_tokens FROM ai_daily_quotas
      WHERE user_key = ${userKey} AND usage_date = ${dateStr}::date;
    `, 500);

    if (result && result.rows && result.rows.length > 0) {
      return {
        lite: parseInt(result.rows[0].lite_count || 0, 10),
        heavy: parseInt(result.rows[0].heavy_count || 0, 10),
        liteTokens: parseInt(result.rows[0].lite_tokens || 0, 10),
        heavyTokens: parseInt(result.rows[0].heavy_tokens || 0, 10)
      };
    }
  }

  return localQuotaStore.get(key) || { lite: 0, heavy: 0, liteTokens: 0, heavyTokens: 0 };
}

export async function incrementQuotaUsage(userKey, dateStr, type = 'lite', maxLimit = 500) {
  const key = `${userKey}:${dateStr}`;

  if (isPostgresConfigured()) {
    const isHeavy = type === 'heavy';
    const result = await safeSql(() => sql`
      INSERT INTO ai_daily_quotas (user_key, usage_date, lite_count, heavy_count, updated_at)
      VALUES (${userKey}, ${dateStr}::date, ${isHeavy ? 0 : 1}, ${isHeavy ? 1 : 0}, NOW())
      ON CONFLICT (user_key, usage_date)
      DO UPDATE SET
        lite_count = CASE WHEN NOT ${isHeavy} THEN ai_daily_quotas.lite_count + 1 ELSE ai_daily_quotas.lite_count END,
        heavy_count = CASE WHEN ${isHeavy} THEN ai_daily_quotas.heavy_count + 1 ELSE ai_daily_quotas.heavy_count END,
        updated_at = NOW()
      RETURNING lite_count, heavy_count;
    `, 800);

    if (result && result.rows && result.rows.length > 0) {
      const updatedLite = parseInt(result.rows[0].lite_count || 0, 10);
      const updatedHeavy = parseInt(result.rows[0].heavy_count || 0, 10);
      const newCount = isHeavy ? updatedHeavy : updatedLite;

      const prev = localQuotaStore.get(key) || { lite: 0, heavy: 0, liteTokens: 0, heavyTokens: 0 };
      localQuotaStore.set(key, { ...prev, lite: updatedLite, heavy: updatedHeavy });

      if (newCount > maxLimit) {
        return { allowed: false, current: newCount, maxLimit };
      }
      return { allowed: true, current: newCount, maxLimit };
    }
  }

  // Fallback mémoire volatile
  const current = localQuotaStore.get(key) || { lite: 0, heavy: 0, liteTokens: 0, heavyTokens: 0 };
  const currentCount = type === 'heavy' ? current.heavy : current.lite;
  if (currentCount >= maxLimit) {
    return { allowed: false, current: currentCount, maxLimit };
  }

  const updated = {
    ...current,
    lite: type === 'lite' ? current.lite + 1 : current.lite,
    heavy: type === 'heavy' ? current.heavy + 1 : current.heavy
  };
  localQuotaStore.set(key, updated);
  return { allowed: true, current: type === 'heavy' ? updated.heavy : updated.lite, maxLimit };
}


export async function recordTokensUsage(userKey, dateStr, type = 'lite', tokensCount = 0) {
  if (!tokensCount || tokensCount <= 0) return;
  const key = `${userKey}:${dateStr}`;
  const current = await getQuotaUsage(userKey, dateStr);

  const newLiteTokens = type === 'lite' ? (current.liteTokens || 0) + tokensCount : (current.liteTokens || 0);
  const newHeavyTokens = type === 'heavy' ? (current.heavyTokens || 0) + tokensCount : (current.heavyTokens || 0);

  localQuotaStore.set(key, { lite: current.lite, heavy: current.heavy, liteTokens: newLiteTokens, heavyTokens: newHeavyTokens });

  if (isPostgresConfigured()) {
    safeSql(() => sql`
      INSERT INTO ai_daily_quotas (user_key, usage_date, lite_count, heavy_count, lite_tokens, heavy_tokens, updated_at)
      VALUES (${userKey}, ${dateStr}::date, ${current.lite}, ${current.heavy}, ${newLiteTokens}, ${newHeavyTokens}, NOW())
      ON CONFLICT (user_key, usage_date)
      DO UPDATE SET
        lite_tokens = EXCLUDED.lite_tokens,
        heavy_tokens = EXCLUDED.heavy_tokens,
        updated_at = NOW();
    `, 500).catch(() => {});
  }
}

export { sql };
