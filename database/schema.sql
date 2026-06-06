-- PostgreSQL Schema for Speak Up! Database Migration
-- Run these queries in your PostgreSQL database (e.g. Supabase, Neon, etc.)

-- 1. Create Users Table
CREATE TABLE IF NOT EXISTS users (
    uid VARCHAR(128) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    gender VARCHAR(50) DEFAULT 'prefer_not',
    avatar_bg VARCHAR(50) DEFAULT 'b6e3f4',
    avatar_seed VARCHAR(100) DEFAULT 'Felix',
    aura_points INTEGER DEFAULT 0,
    streak INTEGER DEFAULT 0,
    total_yaps INTEGER DEFAULT 0,
    linkedin_url VARCHAR(255),
    instagram_url VARCHAR(255),
    username VARCHAR(20) UNIQUE,
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

-- 3. Create Analysis Queue Table (used by speech analysis pipeline)
CREATE TABLE IF NOT EXISTS analysis_queue (
    task_id VARCHAR(128) PRIMARY KEY,
    status VARCHAR(50) DEFAULT 'pending',
    transcript TEXT,
    audio_base64 TEXT,
    mime_type VARCHAR(100),
    topic VARCHAR(255),
    image_url TEXT,
    result TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_sessions_user_date ON practice_sessions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_queue_status_created ON analysis_queue(status, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(LOWER(username)) WHERE username IS NOT NULL;

-- 5. Migration: Add username column to existing databases
-- Run this if upgrading an existing database:
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(20) UNIQUE;
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(LOWER(username)) WHERE username IS NOT NULL;
