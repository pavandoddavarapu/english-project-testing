-- PostgreSQL Schema for Speak Up! Database Migration
-- Run these queries in your PostgreSQL database (e.g. Supabase, Neon, etc.)

-- 1. Create Users Table
CREATE TABLE IF NOT EXISTS users (
    uid VARCHAR(128) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    gender VARCHAR(50) DEFAULT 'prefer_not',
    avatar_bg VARCHAR(50) DEFAULT 'b6e3f4',
    aura_points INTEGER DEFAULT 0,
    streak INTEGER DEFAULT 0,
    total_yaps INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create Practice Sessions Table
CREATE TABLE IF NOT EXISTS practice_sessions (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(128) REFERENCES users(uid) ON DELETE CASCADE,
    date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    topic VARCHAR(255) NOT NULL,
    mode VARCHAR(50) NOT NULL,
    score INTEGER NOT NULL,
    fluency INTEGER NOT NULL,
    clarity INTEGER NOT NULL,
    confidence INTEGER NOT NULL
);

-- 3. Create Index for Performance
CREATE INDEX IF NOT EXISTS idx_sessions_user_date ON practice_sessions(user_id, date DESC);
