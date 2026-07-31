-- =========================================================
-- SCHÉMA DE BASE DE DONNÉES RELATIONNELLE POSTGRESQL (VERCEL POSTGRES / SUPABASE)
-- =========================================================

-- 1. Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Table Utilisateurs
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Table Projets
CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(255) PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  color VARCHAR(50) DEFAULT '#0E8478',
  start_date DATE,
  deadline DATE,
  is_hard_deadline BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Table Jalons WBS (Work Breakdown Structure)
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


-- 5. Table Relationnelle des Dépendances DAG (n-à-n)
CREATE TABLE IF NOT EXISTS milestone_dependencies (
  parent_milestone_id VARCHAR(255) REFERENCES milestones(id) ON DELETE CASCADE,
  child_milestone_id VARCHAR(255) REFERENCES milestones(id) ON DELETE CASCADE,
  PRIMARY KEY (parent_milestone_id, child_milestone_id)
);

-- 6. Table des Séances de Travail
CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(255) PRIMARY KEY,
  milestone_id VARCHAR(255) REFERENCES milestones(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  slot_index INT DEFAULT 0,
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  note TEXT,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Table des Compétences par Domaine (Skill Tree)
CREATE TABLE IF NOT EXISTS domain_skills (
  id VARCHAR(255) PRIMARY KEY,
  domain_key VARCHAR(50) NOT NULL,
  domain_name VARCHAR(100) NOT NULL,
  icon VARCHAR(20) DEFAULT '📋',
  hours_spent NUMERIC(6,2) DEFAULT 0.00,
  level INT DEFAULT 1,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Table des Paramètres Utilisateur & Plages d'Heures Creuses
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  timezone VARCHAR(50) DEFAULT 'Europe/Paris',
  buffer_minutes_before INT DEFAULT 15,
  buffer_minutes_after INT DEFAULT 15,
  day_start_hour INT DEFAULT 8,
  day_end_hour INT DEFAULT 23,
  slot_duration_minutes INT DEFAULT 60,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Table des Intégrations de Calendriers Externes (Google / iCal)
CREATE TABLE IF NOT EXISTS calendar_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL, -- 'google' | 'ical'
  calendar_id VARCHAR(255),
  ical_url TEXT,
  access_token TEXT,
  refresh_token TEXT,
  webhook_channel_id VARCHAR(255),
  webhook_resource_id VARCHAR(255),
  webhook_expiration TIMESTAMP WITH TIME ZONE,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Table des Événements Indisponibles Personnels / Professionnels
CREATE TABLE IF NOT EXISTS external_events (
  id VARCHAR(255) PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES calendar_integrations(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  is_all_day BOOLEAN DEFAULT FALSE,
  raw_data JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Table des Quotas Quotidiens d'IA (Flash-Lite: 500/j, 3.6 Flash: 20/j + Tokens)
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


-- Index d'optimisation
CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_sessions_milestone ON sessions(milestone_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_sessions_time_range ON sessions(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_external_events_user_time ON external_events(user_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_ai_daily_quotas ON ai_daily_quotas(user_key, usage_date);


