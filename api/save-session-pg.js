/**
 * /api/save-session-pg.js
 * 
 * PostgreSQL version of save-session API route.
 * Verifies Firebase token, inserts the session row, and updates
 * the user's streak, aura points, and yaps counter in PostgreSQL.
 */

import { verifyFirebaseIdToken } from './auth-helper.js';
import { query } from './db.js';

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };
export const maxDuration = 15;

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { idToken, uid, sessionData, displayName, email } = req.body || {};

    if (!idToken || !uid || !sessionData) {
      return res.status(400).json({ error: 'Missing idToken, uid, or sessionData' });
    }

    // 1. Verify token & authenticate
    const verifiedUser = await verifyFirebaseIdToken(idToken);
    if (verifiedUser.uid !== uid) {
      return res.status(403).json({ error: 'Unauthorized: UID mismatch' });
    }

    // 2. Ensure user exists in the users table
    let userRes = await query('SELECT aura_points, streak FROM users WHERE uid = $1', [uid]);
    if (userRes.rowCount === 0) {
      console.log(`[save-session-pg] User ${uid} not found, pre-initializing user row`);
      const avatarBg = 'b6e3f4';
      await query(
        `INSERT INTO users (uid, name, email, gender, avatar_bg, aura_points, streak, total_yaps)
         VALUES ($1, $2, $3, 'prefer_not', $4, 0, 0, 0)`,
        [uid, displayName || 'Speaker', email || verifiedUser.email, avatarBg]
      );
      userRes = await query('SELECT aura_points, streak FROM users WHERE uid = $1', [uid]);
    }

    const currentData = userRes.rows[0];
    const now = new Date();
    const todayISO = now.toISOString();
    const todayDateStr = todayISO.split('T')[0];

    const fluency = Math.min(100, Math.max(0, Number(sessionData.fluency) || 0));
    const clarity = Math.min(100, Math.max(0, Number(sessionData.clarity) || 0));
    const confidence = Math.min(100, Math.max(0, Number(sessionData.confidence) || 0));
    const avgScore = Math.round((fluency + clarity + confidence) / 3);

    // 3. Fetch unique practice dates for streak calculation
    const datesRes = await query(
      'SELECT DISTINCT date::date::text as practice_date FROM practice_sessions WHERE user_id = $1 ORDER BY practice_date ASC',
      [uid]
    );
    const uniqueDateStrs = datesRes.rows.map(r => r.practice_date);

    let newStreak = Number(currentData.streak) || 0;
    if (!uniqueDateStrs.includes(todayDateStr)) {
      if (uniqueDateStrs.length === 0) {
        newStreak = 1;
      } else {
        const lastDate = new Date(uniqueDateStrs[uniqueDateStrs.length - 1] + 'T00:00:00Z');
        const todayMid = new Date(todayDateStr + 'T00:00:00Z');
        const diffDays = Math.round((todayMid - lastDate) / 86400000);
        newStreak = diffDays === 1 ? newStreak + 1 : 1;
      }
    }

    // 4. Insert practice session row into PostgreSQL
    await query(
      `INSERT INTO practice_sessions (user_id, date, topic, mode, score, fluency, clarity, confidence)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [uid, now, sessionData.topic || 'General Practice', sessionData.mode || 'random', avgScore, fluency, clarity, confidence]
    );

    // 5. Update users table (aura points, total yaps, streak)
    const updateRes = await query(
      `UPDATE users 
       SET aura_points = aura_points + 10,
           total_yaps = total_yaps + 1,
           streak = $2
       WHERE uid = $1
       RETURNING aura_points, streak`,
      [uid, newStreak]
    );

    const updatedStats = updateRes.rows[0];

    console.log(`[save-session-pg] uid=${uid} score=${avgScore} streak=${updatedStats.streak} aura=${updatedStats.aura_points}`);
    
    return res.status(200).json({
      ok: true,
      streak: updatedStats.streak,
      aura: updatedStats.aura_points
    });

  } catch (err) {
    console.error('[save-session-pg] Error:', err.message);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
