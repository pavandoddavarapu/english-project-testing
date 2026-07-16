/**
 * /api/get-user.js
 * 
 * PostgreSQL version of get-user API route.
 * Verifies Firebase token, queries the users table, and formats the user's
 * sessions & practice dates list to match the client's expected format.
 */

import { verifyFirebaseIdToken } from '../shared/auth-helper.js';
import { query } from '../shared/db.js';
import { setCorsHeaders, safeError } from '../shared/middleware.js';

export const config = { api: { bodyParser: { sizeLimit: '512kb' } } };
export const maxDuration = 10;

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Handle GET requests for username availability check
  if (req.method === 'GET') {
    try {
      const { username } = req.query || {};
      const cleanUsername = (username || '').trim().toLowerCase().substring(0, 20);

      if (!cleanUsername) {
        return res.status(400).json({ error: 'Missing username parameter' });
      }

      // Validate format
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUsername)) {
        return res.status(200).json({ available: false, reason: 'Invalid format. Use 3-20 chars: letters, numbers, underscores.' });
      }

      // Check if taken
      const result = await query(
        'SELECT uid FROM public.users WHERE LOWER(username) = LOWER($1)',
        [cleanUsername]
      );

      return res.status(200).json({
        available: result.rowCount === 0,
        reason: result.rowCount > 0 ? 'Username is already taken.' : null
      });

    } catch (err) {
      return safeError(res, 500, err, '[get-user-username-check]');
    }
  }

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

    // Auto-migrate user from Firebase UID to Supabase UID by email
    if (verifiedUser.email) {
      const checkEmailRes = await query(
        'SELECT uid FROM public.users WHERE LOWER(email) = LOWER($1) AND uid != $2',
        [verifiedUser.email, uid]
      );
      if (checkEmailRes.rowCount > 0) {
        const oldUid = checkEmailRes.rows[0].uid;
        console.log(`[get-user] Migrating user email=${verifiedUser.email} from Firebase UID=${oldUid} to Supabase UID=${uid}`);
        
        try {
          const oldUserRes = await query('SELECT * FROM public.users WHERE uid = $1', [oldUid]);
          const oldUser = oldUserRes.rows[0];

          await query('BEGIN');
          
          // 1. Insert temporary record with new UID
          await query(
            `INSERT INTO public.users (
              uid, name, email, gender, avatar_bg, aura_points, streak, total_yaps, 
              created_at, avatar_seed, linkedin_url, instagram_url, username, 
              email_reminders, push_subscription, last_practice_date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
            [
              uid,
              oldUser.name,
              `temp_${uid}_${oldUser.email}`,
              oldUser.gender,
              oldUser.avatar_bg,
              oldUser.aura_points,
              oldUser.streak,
              oldUser.total_yaps,
              oldUser.created_at,
              oldUser.avatar_seed,
              oldUser.linkedin_url,
              oldUser.instagram_url,
              oldUser.username ? `temp_${uid}_${oldUser.username}` : null,
              oldUser.email_reminders,
              oldUser.push_subscription,
              oldUser.last_practice_date
            ]
          );

          // 2. Transfer practice sessions to new UID
          await query('UPDATE public.practice_sessions SET user_id = $1 WHERE user_id = $2', [uid, oldUid]);

          // 3. Delete old record
          await query('DELETE FROM public.users WHERE uid = $1', [oldUid]);

          // 4. Restore original email and username
          await query(
            'UPDATE public.users SET email = $1, username = $2 WHERE uid = $3',
            [oldUser.email, oldUser.username, uid]
          );

          await query('COMMIT');
          console.log(`[get-user] Constraint-safe migration successful for email=${verifiedUser.email}`);
        } catch (txErr) {
          await query('ROLLBACK');
          console.error('[get-user] Transaction migration failed:', txErr.message);
          throw txErr;
        }
      }
    }

    // 2. Query user, practice_dates and recent_sessions in a single optimized query
    const userRes = await query(`
      SELECT 
        u.*,
        (SELECT COUNT(*) + 1 FROM public.users WHERE aura_points > u.aura_points) as rank,
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
      const recentSessions = user.recent_sessions || [];

      // Calculate active streak decay in memory in JavaScript
      let activeStreak = Number(user.streak) || 0;
      if (recentSessions.length > 0) {
        const lastSessionDate = new Date(recentSessions[0].date);
        
        // Convert to IST dates
        const istOffset = 5.5 * 60 * 60 * 1000;
        const todayISTStr = new Date(Date.now() + istOffset).toISOString().split('T')[0];
        const lastSessionISTStr = new Date(lastSessionDate.getTime() + istOffset).toISOString().split('T')[0];

        if (todayISTStr !== lastSessionISTStr) {
          const todayMid = new Date(todayISTStr + 'T00:00:00Z');
          const lastMid = new Date(lastSessionISTStr + 'T00:00:00Z');
          const diffDays = Math.round((todayMid - lastMid) / 86400000);
          if (diffDays > 1) {
            activeStreak = 0;
          }
        }
      } else {
        activeStreak = 0;
      }

      // Sync decayed streak to database in background if stale
      if (Number(user.streak) !== activeStreak) {
        query('UPDATE public.users SET streak = $2 WHERE uid = $1', [uid, activeStreak])
          .catch(err => console.error('[get-user] Failed to sync decayed streak:', err.message));
      }

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
          streak: activeStreak,
          total_yaps: user.total_yaps,
          linkedin_url: user.linkedin_url || '',
          instagram_url: user.instagram_url || '',
          username: user.username || '',
          created_at: user.created_at,
          rank: Number(user.rank) || 1,
          practice_dates: user.practice_dates || [],
          recent_sessions: recentSessions
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
      
      const countRes = await query('SELECT COUNT(*) as total FROM public.users');
      const totalUsers = Number(countRes.rows[0]?.total) || 1;

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
          rank: totalUsers,
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
