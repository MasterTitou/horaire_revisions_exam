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
  const current = await getQuotaUsage(userKey, dateStr);
  const currentCount = type === 'heavy' ? current.heavy : current.lite;

  if (currentCount >= maxLimit) {
    return { allowed: false, current: currentCount, maxLimit };
  }

  const newLite = type === 'lite' ? current.lite + 1 : current.lite;
  const newHeavy = type === 'heavy' ? current.heavy + 1 : current.heavy;
  const liteTokens = current.liteTokens || 0;
  const heavyTokens = current.heavyTokens || 0;

  // Mise à jour immédiate en mémoire (Garantit 0ms d'attente)
  localQuotaStore.set(key, { lite: newLite, heavy: newHeavy, liteTokens, heavyTokens });

  // Sync PostgreSQL asynchrone sécurisé
  if (isPostgresConfigured()) {
    safeSql(() => sql`
      INSERT INTO ai_daily_quotas (user_key, usage_date, lite_count, heavy_count, lite_tokens, heavy_tokens, updated_at)
      VALUES (${userKey}, ${dateStr}::date, ${newLite}, ${newHeavy}, ${liteTokens}, ${heavyTokens}, NOW())
      ON CONFLICT (user_key, usage_date)
      DO UPDATE SET
        lite_count = EXCLUDED.lite_count,
        heavy_count = EXCLUDED.heavy_count,
        updated_at = NOW();
    `, 500).catch(() => {});
  }

  return { allowed: true, current: type === 'heavy' ? newHeavy : newLite, maxLimit };
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
