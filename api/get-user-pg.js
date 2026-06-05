/**
 * /api/get-user-pg.js
 * 
 * PostgreSQL version of get-user API route.
 * Verifies Firebase token, queries the users table, and formats the user's
 * sessions & practice dates list to match the client's expected format.
 */

import { verifyFirebaseIdToken } from './auth-helper.js';
import { query } from './db.js';

export const config = { api: { bodyParser: { sizeLimit: '512kb' } } };
export const maxDuration = 10;

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { idToken, uid, displayName, email, gender } = req.body || {};
    if (!idToken || !uid) {
      return res.status(400).json({ error: 'Missing idToken or uid' });
    }

    // 1. Verify token & get authenticated uid
    const verifiedUser = await verifyFirebaseIdToken(idToken);
    if (verifiedUser.uid !== uid) {
      return res.status(403).json({ error: 'Unauthorized: UID mismatch' });
    }

    // 2. Query user from PostgreSQL
    const userRes = await query('SELECT * FROM users WHERE uid = $1', [uid]);
    
    if (userRes.rowCount > 0) {
      const user = userRes.rows[0];

      // Query practice_dates
      const datesRes = await query(
        'SELECT DISTINCT date::date::text as practice_date FROM practice_sessions WHERE user_id = $1 ORDER BY practice_date ASC',
        [uid]
      );
      const practice_dates = datesRes.rows.map(r => r.practice_date);

      // Query recent_sessions
      const sessionsRes = await query(
        'SELECT date, topic, mode, score, fluency, clarity, confidence FROM practice_sessions WHERE user_id = $1 ORDER BY date DESC LIMIT 20',
        [uid]
      );
      const recent_sessions = sessionsRes.rows.map(s => ({
        date: s.date.toISOString ? s.date.toISOString() : s.date,
        topic: s.topic,
        mode: s.mode,
        score: s.score,
        fluency: s.fluency,
        clarity: s.clarity,
        confidence: s.confidence
      }));

      return res.status(200).json({
        exists: true,
        data: {
          uid: user.uid,
          name: user.name,
          email: user.email,
          gender: user.gender,
          avatar_bg: user.avatar_bg,
          aura_points: user.aura_points,
          streak: user.streak,
          total_yaps: user.total_yaps,
          created_at: user.created_at,
          practice_dates,
          recent_sessions
        }
      });
    }

    // 3. If user doesn't exist but registration details are provided, initialize them
    if (displayName || email) {
      console.log(`[get-user-pg] Initializing new user profile for uid=${uid}`);
      const avatarBg = gender === 'female' ? 'ffdfbf' : gender === 'male' ? 'b6e3f4' : 'd1d4f9';
      const insertRes = await query(
        `INSERT INTO users (uid, name, email, gender, avatar_bg, aura_points, streak, total_yaps)
         VALUES ($1, $2, $3, $4, $5, 0, 0, 0)
         RETURNING *`,
        [uid, displayName || 'Speaker', email || verifiedUser.email, gender || 'prefer_not', avatarBg]
      );
      
      const newUser = insertRes.rows[0];
      return res.status(200).json({
        exists: true,
        data: {
          uid: newUser.uid,
          name: newUser.name,
          email: newUser.email,
          gender: newUser.gender,
          avatar_bg: newUser.avatar_bg,
          aura_points: 0,
          streak: 0,
          total_yaps: 0,
          created_at: newUser.created_at,
          practice_dates: [],
          recent_sessions: []
        }
      });
    }

    // 4. User does not exist and no registration details
    return res.status(200).json({ exists: false, data: {} });

  } catch (err) {
    console.error('[get-user-pg] Error:', err.message);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
