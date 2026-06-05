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

// Startup Migration: Ensure users table has avatar_seed column
(async () => {
  try {
    await pool.query(`
      ALTER TABLE public.users 
      ADD COLUMN IF NOT EXISTS avatar_seed VARCHAR(100) DEFAULT 'Felix',
      ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR(255),
      ADD COLUMN IF NOT EXISTS instagram_url VARCHAR(255)
    `);
    console.log('🔌 [DB Migration] public.users columns (avatar_seed, linkedin_url, instagram_url) are verified/added.');
  } catch (err) {
    console.error('❌ [DB Migration] Failed to ensure users.avatar_seed column:', err.message);
  }
})();
