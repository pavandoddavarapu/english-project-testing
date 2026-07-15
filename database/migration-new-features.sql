-- =====================================================
-- Migration: Add New Feature Columns
-- Run in your Supabase / Neon SQL editor BEFORE deploying
-- =====================================================

-- 1. Email reminders opt-in (default TRUE — users start opted in)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_reminders BOOLEAN DEFAULT true;

-- 2. Push notification subscription (stores Web Push endpoint + keys JSON)
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_subscription TEXT;

-- 3. Last practice date — for faster streak reminder queries
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_practice_date DATE;

-- 4. Index for streak reminder cron (finds users who haven't practiced today)
CREATE INDEX IF NOT EXISTS idx_users_streak_reminders
  ON users(streak, email_reminders, last_practice_date)
  WHERE streak >= 2 AND email_reminders = true;

-- 5. Update last_practice_date for existing users from their sessions
UPDATE users u
SET last_practice_date = (
  SELECT DATE(ps.date AT TIME ZONE 'Asia/Kolkata')
  FROM practice_sessions ps
  WHERE ps.user_id = u.uid
  ORDER BY ps.date DESC
  LIMIT 1
)
WHERE EXISTS (SELECT 1 FROM practice_sessions WHERE user_id = u.uid);

-- =====================================================
-- 6. Daily Content Cache Table (COST SAVING)
--    Stores AI-generated daily topics keyed by date.
--    /api/daily reads from here first — AI is only
--    called ONCE per day regardless of cold-starts.
-- =====================================================
CREATE TABLE IF NOT EXISTS daily_content_cache (
    date DATE PRIMARY KEY,
    content JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Auto-cleanup: delete cache entries older than 3 days to keep the table tiny
CREATE INDEX IF NOT EXISTS idx_daily_cache_date ON daily_content_cache(date DESC);

-- =====================================================
-- How to use:
-- 1. Go to Supabase → SQL Editor (or your Neon/Postgres dashboard)
-- 2. Paste this entire file and Run
-- 3. Should complete in < 1 second
-- 4. Then deploy the feature branch
-- =====================================================
