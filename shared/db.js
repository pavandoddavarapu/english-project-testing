/**
 * api/db.js
 * 
 * PostgreSQL connection pool configuration.
 * Automatically selects either DATABASE_URL or POSTGRES_URL from environment variables.
 */

import pg from 'pg';
const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!connectionString) {
  console.warn("DB WARNING: Neither DATABASE_URL nor POSTGRES_URL is configured in environment variables.");
}

export const pool = new Pool({
  connectionString,
  ssl: connectionString && !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1')
    ? { rejectUnauthorized: false } // Required for remote databases like Supabase/Neon
    : false,
  max: 3, // Optimized for serverless to prevent connection exhaustion
  idleTimeoutMillis: 15000, // Faster recycling of idle connections
  connectionTimeoutMillis: 5000,
});

/**
 * Helper to run query with automatic client release.
 */
export async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log('[DB Query] executed:', { text: text.substring(0, 100), duration: `${duration}ms`, rows: res.rowCount });
  return res;
}

/**
 * Run multiple queries inside a single transaction on a dedicated client.
 * Usage: await withTransaction(async (client) => { await client.query(...); ... });
 */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}


// Startup Migration: Ensure users table has all required columns and indexes
(async () => {
  try {
    // 1. Core Profile Columns
    await pool.query(`
      ALTER TABLE public.users 
      ADD COLUMN IF NOT EXISTS avatar_seed VARCHAR(100) DEFAULT 'Felix',
      ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR(255),
      ADD COLUMN IF NOT EXISTS instagram_url VARCHAR(255),
      ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE
    `);

    // 2. Email & Push Notifications Columns
    await pool.query(`
      ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS email_reminders BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS push_subscription TEXT,
      ADD COLUMN IF NOT EXISTS last_practice_date DATE
    `);

    // 3. Optimized index for streak reminder cron
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_streak_reminders
      ON public.users(streak, email_reminders, last_practice_date)
      WHERE streak >= 2 AND email_reminders = true
    `);

    // 4. Backfill last_practice_date for users with existing sessions
    await pool.query(`
      UPDATE public.users u
      SET last_practice_date = (
        SELECT DATE(ps.date AT TIME ZONE 'Asia/Kolkata')
        FROM public.practice_sessions ps
        WHERE ps.user_id = u.uid
        ORDER BY ps.date DESC
        LIMIT 1
      )
      WHERE u.last_practice_date IS NULL AND EXISTS (
        SELECT 1 FROM public.practice_sessions WHERE user_id = u.uid
      )
    `);

    // 5. Optimized index for practice sessions lookup
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_practice_sessions_user_id_date
      ON public.practice_sessions(user_id, date DESC)
    `);

    console.log('🔌 [DB Migration] All users columns (profile, email, push) and indexes are verified/migrated.');
  } catch (err) {
    console.error('❌ [DB Migration] Failed to run startup migrations:', err.message);
  }
})();

