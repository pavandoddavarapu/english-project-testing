/**
 * /api/get-public-profile.js
 * 
 * Public endpoint to fetch public profile details (name, stats, heatmap dates, recent sessions)
 * for sharing. Does not require authentication, but is rate-limited.
 */

import { query } from './db.js';
import { setCorsHeaders, checkRateLimit, safeError, sanitizeString } from './middleware.js';

export const config = { api: { bodyParser: { sizeLimit: '64kb' } } };
export const maxDuration = 10;

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit public calls to prevent resource abuse
  if (!checkRateLimit(req, res, { maxRequests: 30, windowMs: 60_000 })) return;

  try {
    const uid = sanitizeString(req.query.uid || req.body.uid, 128);

    if (!uid) {
      return res.status(400).json({ error: 'Missing uid parameter' });
    }

    // 1. Fetch public user details
    const userRes = await query(`
      SELECT name, gender, avatar_bg, avatar_seed, aura_points, streak, total_yaps, created_at, linkedin_url, instagram_url
      FROM public.users
      WHERE uid = $1
    `, [uid]);

    if (userRes.rowCount === 0) {
      return res.status(404).json({ exists: false, error: 'User not found' });
    }

    const user = userRes.rows[0];

    // 2. Fetch practice dates for heatmap
    const datesRes = await query(`
      SELECT DISTINCT date::date::text as d
      FROM public.practice_sessions 
      WHERE user_id = $1
      ORDER BY d ASC
    `, [uid]);
    const practiceDates = datesRes.rows.map(r => r.d);

    // 3. Fetch recent practice sessions
    const sessionsRes = await query(`
      SELECT date, topic, mode, score, fluency, clarity, confidence 
      FROM public.practice_sessions 
      WHERE user_id = $1 
      ORDER BY date DESC 
      LIMIT 20
    `, [uid]);

    return res.status(200).json({
      exists: true,
      data: {
        name: user.name,
        gender: user.gender,
        avatar_bg: user.avatar_bg,
        avatar_seed: user.avatar_seed || 'Felix',
        aura_points: user.aura_points,
        streak: user.streak,
        total_yaps: user.total_yaps,
        created_at: user.created_at,
        linkedin_url: user.linkedin_url || '',
        instagram_url: user.instagram_url || '',
        practice_dates: practiceDates,
        recent_sessions: sessionsRes.rows || []
      }
    });

  } catch (err) {
    return safeError(res, 500, err, '[get-public-profile]');
  }
}
