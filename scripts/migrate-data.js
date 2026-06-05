/**
 * migrate-data.js
 * 
 * Data migration script to copy existing user profiles and practice sessions
 * from Firebase Firestore to your PostgreSQL database.
 * 
 * Requirements:
 * 1. Node.js environment.
 * 2. firebase-admin and pg packages installed (already in package.json dependencies).
 * 3. Environment variables or a local .env configuration:
 *    - DATABASE_URL: PostgreSQL connection string.
 *    - FIREBASE_SERVICE_ACCOUNT: Path to your Firebase service account JSON key file.
 * 
 * Run using:
 * node migrate-data.js
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { Pool } = require('pg');

// ── 1. Load Configurations ──────────────────────────────────────────────────
// Try to load env variables from a local .env file if it exists
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf-8');
    envConfig.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/(^['"]|['"]$)/g, '');
        if (key && value && !process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }
} catch (e) {
  console.log('No local .env file parsed, using system environment variables.');
}

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT || './firebase-service-account.json';

if (!connectionString) {
  console.error('❌ ERROR: DATABASE_URL or POSTGRES_URL is not set.');
  process.exit(1);
}

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`❌ ERROR: Firebase service account file not found at: ${serviceAccountPath}`);
  console.log('Please download your service account JSON file from Firebase Console (Project Settings -> Service Accounts) and place it here.');
  process.exit(1);
}

// ── 2. Initialize Database & Firebase Connections ───────────────────────────
console.log('🔌 Connecting to PostgreSQL...');
const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
    ? false
    : { rejectUnauthorized: false }
});

console.log('🔌 Initializing Firebase Admin SDK...');
const serviceAccount = require(path.resolve(serviceAccountPath));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// ── 3. Run Migration ────────────────────────────────────────────────────────
async function runMigration() {
  const pgClient = await pool.connect();
  try {
    console.log('🚀 Starting database migration from Firestore to PostgreSQL...');

    // Fetch all users from Firestore
    console.log('📖 Fetching users from Firestore...');
    const usersSnapshot = await db.collection('users').get();
    
    if (usersSnapshot.empty) {
      console.log('⚠️ No users found in Firestore to migrate.');
      return;
    }

    console.log(`📊 Found ${usersSnapshot.size} users to process.`);
    let migratedUsersCount = 0;
    let migratedSessionsCount = 0;

    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      const uid = doc.id;

      // Extract user fields, providing fallbacks
      const name = userData.name || 'Speaker';
      const email = userData.email || '';
      const gender = userData.gender || 'prefer_not';
      const avatar_bg = userData.avatar_bg || 'b6e3f4';
      const aura_points = Number(userData.aura_points) || 0;
      const streak = Number(userData.streak) || 0;
      const total_yaps = Number(userData.total_yaps) || 0;
      
      // Parse created_at timestamp
      let created_at = new Date();
      if (userData.created_at) {
        if (userData.created_at.toDate) {
          created_at = userData.created_at.toDate();
        } else {
          created_at = new Date(userData.created_at);
        }
      }

      console.log(`👤 Processing User: ${name} (${email || uid})...`);

      // 1. Insert/Update User Profile
      await pgClient.query(
        `INSERT INTO users (uid, name, email, gender, avatar_bg, aura_points, streak, total_yaps, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (uid) DO UPDATE 
         SET name = EXCLUDED.name,
             email = EXCLUDED.email,
             gender = EXCLUDED.gender,
             avatar_bg = EXCLUDED.avatar_bg,
             aura_points = EXCLUDED.aura_points,
             streak = EXCLUDED.streak,
             total_yaps = EXCLUDED.total_yaps`,
        [uid, name, email, gender, avatar_bg, aura_points, streak, total_yaps, created_at]
      );
      migratedUsersCount++;

      // 2. Process recent sessions
      const recentSessions = Array.isArray(userData.recent_sessions) ? userData.recent_sessions : [];
      
      for (const session of recentSessions) {
        // Parse date
        let sessionDate = new Date();
        if (session.date) {
          if (session.date.toDate) {
            sessionDate = session.date.toDate();
          } else {
            sessionDate = new Date(session.date);
          }
        }

        const topic = session.topic || 'General Practice';
        const mode = session.mode || 'random';
        const fluency = Number(session.fluency) || 0;
        const clarity = Number(session.clarity) || 0;
        const confidence = Number(session.confidence) || 0;
        const score = Number(session.score) || Math.round((fluency + clarity + confidence) / 3);

        // Check if session already exists to prevent duplicate runs
        const checkRes = await pgClient.query(
          'SELECT id FROM practice_sessions WHERE user_id = $1 AND date = $2',
          [uid, sessionDate]
        );

        if (checkRes.rowCount === 0) {
          await pgClient.query(
            `INSERT INTO practice_sessions (user_id, date, topic, mode, score, fluency, clarity, confidence)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [uid, sessionDate, topic, mode, score, fluency, clarity, confidence]
          );
          migratedSessionsCount++;
        }
      }
    }

    console.log('\n✅ Migration completed successfully!');
    console.log(`   - Users migrated/updated: ${migratedUsersCount}`);
    console.log(`   - New sessions imported:  ${migratedSessionsCount}`);

  } catch (err) {
    console.error('❌ Migration failed with error:', err.message);
  } finally {
    pgClient.release();
    await pool.end();
  }
}

runMigration();
