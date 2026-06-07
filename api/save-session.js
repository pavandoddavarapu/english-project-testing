/**
 * /api/save-session.js
 * 
 * PostgreSQL version of save-session API route.
 * Verifies Firebase token, inserts the session row, and updates
 * the user's streak, aura points, and yaps counter in PostgreSQL.
 */

import { verifyFirebaseIdToken } from './auth-helper.js';
import { query } from './db.js';
import { setCorsHeaders, checkRateLimit, safeError, sanitizeString, clampInt } from './middleware.js';

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };
export const maxDuration = 15;

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!checkRateLimit(req, res, { maxRequests: 10, windowMs: 60_000 })) return;

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
    let userRes = await query('SELECT aura_points, streak FROM public.users WHERE uid = $1', [uid]);
    if (userRes.rowCount === 0) {
      console.log(`[save-session] User ${uid} not found, pre-initializing user row`);
      const avatarBg = 'b6e3f4';
      await query(
        `INSERT INTO public.users (uid, name, email, gender, avatar_bg, aura_points, streak, total_yaps)
         VALUES ($1, $2, $3, 'prefer_not', $4, 0, 0, 0)`,
        [uid, displayName || 'Speaker', email || verifiedUser.email, avatarBg]
      );
      userRes = await query('SELECT aura_points, streak FROM public.users WHERE uid = $1', [uid]);
    }

    const currentData = userRes.rows[0];
    const now = new Date();
    const todayISO = now.toISOString();
    const todayDateStr = todayISO.split('T')[0];

    const fluency = clampInt(sessionData.fluency, 0, 100);
    const clarity = clampInt(sessionData.clarity, 0, 100);
    const confidence = clampInt(sessionData.confidence, 0, 100);
    const avgScore = Math.round((fluency + clarity + confidence) / 3);
    const cleanTopic = sanitizeString(sessionData.topic, 255) || 'General Practice';
    const cleanMode = sanitizeString(sessionData.mode, 50) || 'random';

    // 3. Fetch the last session date to calculate the new streak
    // We fetch the most recent session's date formatted as a date string (YYYY-MM-DD)
    // to compare against today's date string.
    const lastSessionRes = await query(
      'SELECT date::date::text as last_date FROM practice_sessions WHERE user_id = $1 ORDER BY date DESC LIMIT 1',
      [uid]
    );

    let newStreak = Number(currentData.streak) || 0;
    if (lastSessionRes.rowCount === 0) {
      // First session ever: initialize streak to 1
      newStreak = 1;
    } else {
      const lastDateStr = lastSessionRes.rows[0].last_date;
      // If the last session was NOT today, check if it was yesterday
      if (lastDateStr !== todayDateStr) {
        const lastDate = new Date(lastDateStr + 'T00:00:00Z');
        const todayMid = new Date(todayDateStr + 'T00:00:00Z');
        const diffDays = Math.round((todayMid - lastDate) / 86400000);
        // If the difference is exactly 1 day (yesterday), increment the streak.
        // If the user missed a day (diffDays > 1), reset the streak back to 1.
        newStreak = diffDays === 1 ? newStreak + 1 : 1;
      }
      // If lastDateStr === todayDateStr, the user already practiced today,
      // so the streak remains unchanged.
    }

    // 4. Insert practice session row into PostgreSQL
    await query(
      `INSERT INTO practice_sessions (user_id, date, topic, mode, score, fluency, clarity, confidence)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [uid, now, cleanTopic, cleanMode, avgScore, fluency, clarity, confidence]
    );

    // 5. Update users table (aura points, total yaps, streak)
    const updateRes = await query(
      `UPDATE public.users 
       SET aura_points = aura_points + 10,
           total_yaps = total_yaps + 1,
           streak = $2
       WHERE uid = $1
       RETURNING aura_points, streak`,
      [uid, newStreak]
    );

    const updatedStats = updateRes.rows[0];

    console.log(`[save-session] uid=${uid} score=${avgScore} streak=${updatedStats.streak} aura=${updatedStats.aura_points}`);
    
    return res.status(200).json({
      ok: true,
      streak: updatedStats.streak,
      aura: updatedStats.aura_points
    });

  } catch (err) {
    return safeError(res, 500, err, '[save-session]');
  }
}
