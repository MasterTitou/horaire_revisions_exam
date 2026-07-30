import { sql } from '@vercel/postgres';

export async function initSchema() {
  try {
    await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`;
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR(255) PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50) NOT NULL,
        color VARCHAR(50) DEFAULT '#0E8478',
        deadline DATE,
        is_hard_deadline BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS milestones (
        id VARCHAR(255) PRIMARY KEY,
        project_id VARCHAR(255) REFERENCES projects(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        estimated_hours NUMERIC(5,2) DEFAULT 10.00,
        completed_hours NUMERIC(5,2) DEFAULT 0.00,
        due_date DATE,
        cognitive_load VARCHAR(20) DEFAULT 'medium',
        is_hard_deadline BOOLEAN DEFAULT TRUE,
        is_completed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS milestone_dependencies (
        parent_milestone_id VARCHAR(255) REFERENCES milestones(id) ON DELETE CASCADE,
        child_milestone_id VARCHAR(255) REFERENCES milestones(id) ON DELETE CASCADE,
        PRIMARY KEY (parent_milestone_id, child_milestone_id)
      );
    `;
    await sql`
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
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS domain_skills (
        id VARCHAR(255) PRIMARY KEY,
        domain_key VARCHAR(50) NOT NULL,
        domain_name VARCHAR(100) NOT NULL,
        icon VARCHAR(20) DEFAULT '📋',
        hours_spent NUMERIC(6,2) DEFAULT 0.00,
        level INT DEFAULT 1,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        timezone VARCHAR(50) DEFAULT 'Europe/Paris',
        buffer_minutes_before INT DEFAULT 15,
        buffer_minutes_after INT DEFAULT 15,
        day_start_hour INT DEFAULT 8,
        day_end_hour INT DEFAULT 23,
        slot_duration_minutes INT DEFAULT 60,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS calendar_integrations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        provider VARCHAR(20) NOT NULL,
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
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS external_events (
        id VARCHAR(255) PRIMARY KEY,
        integration_id UUID REFERENCES calendar_integrations(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        start_time TIMESTAMP WITH TIME ZONE NOT NULL,
        end_time TIMESTAMP WITH TIME ZONE NOT NULL,
        is_all_day BOOLEAN DEFAULT FALSE,
        raw_data JSONB,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    return true;
  } catch (err) {
    console.error('Erreur auto-init schema PostgreSQL:', err.message);
    return false;
  }
}


export { sql };
