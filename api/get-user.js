/**
 * /api/get-user.js
 * 
 * PostgreSQL version of get-user API route.
 * Verifies Firebase token, queries the users table, and formats the user's
 * sessions & practice dates list to match the client's expected format.
 */

import { verifyFirebaseIdToken } from './auth-helper.js';
import { query } from './db.js';
import { setCorsHeaders, safeError } from './middleware.js';

export const config = { api: { bodyParser: { sizeLimit: '512kb' } } };
export const maxDuration = 10;

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { idToken, uid, displayName, email, gender, linkedin_url, instagram_url, username } = req.body || {};
    if (!idToken || !uid) {
      return res.status(400).json({ error: 'Missing idToken or uid' });
    }

    // 1. Verify token & get authenticated uid
    const verifiedUser = await verifyFirebaseIdToken(idToken);
    if (verifiedUser.uid !== uid) {
      return res.status(403).json({ error: 'Unauthorized: UID mismatch' });
    }

    // 2. Query user, practice_dates and recent_sessions in a single optimized query
    const userRes = await query(`
      SELECT 
        u.*,
        COALESCE(
          (SELECT json_agg(d) FROM (
             SELECT DISTINCT date::date::text as d
             FROM practice_sessions 
             WHERE user_id = u.uid
             ORDER BY d ASC
           ) sub), 
          '[]'::json
        ) as practice_dates,
        COALESCE(
          (SELECT json_agg(s) FROM (
             SELECT date, topic, mode, score, fluency, clarity, confidence 
             FROM practice_sessions 
             WHERE user_id = u.uid 
             ORDER BY date DESC 
             LIMIT 20
           ) s), 
          '[]'::json
        ) as recent_sessions
      FROM public.users u 
      WHERE u.uid = $1
    `, [uid]);
    
    if (userRes.rowCount > 0) {
      const user = userRes.rows[0];

      return res.status(200).json({
        exists: true,
        data: {
          uid: user.uid,
          name: user.name,
          email: user.email,
          gender: user.gender,
          avatar_bg: user.avatar_bg,
          avatar_seed: user.avatar_seed || 'Felix',
          aura_points: user.aura_points,
          streak: user.streak,
          total_yaps: user.total_yaps,
          linkedin_url: user.linkedin_url || '',
          instagram_url: user.instagram_url || '',
          username: user.username || '',
          created_at: user.created_at,
          practice_dates: user.practice_dates || [],
          recent_sessions: user.recent_sessions || []
        }
      });
    }

    // 3. If user doesn't exist but registration details are provided, initialize them
    if (displayName || email) {
      console.log(`[get-user] Initializing new user profile for uid=${uid}`);
      const avatarBg = gender === 'female' ? 'ffdfbf' : gender === 'male' ? 'b6e3f4' : 'd1d4f9';
      const cleanLinkedin = (linkedin_url || '').trim().substring(0, 255);
      const cleanInstagram = (instagram_url || '').trim().substring(0, 255);

      // Validate & check username uniqueness
      let cleanUsername = (username || '').trim().toLowerCase().substring(0, 20);
      if (cleanUsername) {
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUsername)) {
          return res.status(400).json({ error: 'Username must be 3-20 characters: letters, numbers, underscores only.' });
        }
        const existingUser = await query('SELECT uid FROM public.users WHERE username = $1', [cleanUsername]);
        if (existingUser.rowCount > 0) {
          return res.status(409).json({ error: 'Username is already taken. Please choose a different one.' });
        }
      }

      const insertRes = await query(
        `INSERT INTO public.users (uid, name, email, gender, avatar_bg, aura_points, streak, total_yaps, linkedin_url, instagram_url, username)
         VALUES ($1, $2, $3, $4, $5, 0, 0, 0, $6, $7, $8)
         RETURNING *`,
        [uid, displayName || 'Speaker', email || verifiedUser.email, gender || 'prefer_not', avatarBg, cleanLinkedin || null, cleanInstagram || null, cleanUsername || null]
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
          avatar_seed: newUser.avatar_seed || 'Felix',
          aura_points: 0,
          streak: 0,
          total_yaps: 0,
          linkedin_url: newUser.linkedin_url || '',
          instagram_url: newUser.instagram_url || '',
          username: newUser.username || '',
          created_at: newUser.created_at,
          practice_dates: [],
          recent_sessions: []
        }
      });
    }

    // 4. User does not exist and no registration details
    return res.status(200).json({ exists: false, data: {} });

  } catch (err) {
    return safeError(res, 500, err, '[get-user]');
  }
}
