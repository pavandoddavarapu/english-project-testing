/**
 * /api/check-username.js
 * 
 * Lightweight public endpoint to check if a username is available.
 * Used for real-time validation on signup and profile edit forms.
 */

import { query } from '../shared/db.js';
import { setCorsHeaders, checkRateLimit, safeError, sanitizeString } from '../shared/middleware.js';

export const config = { api: { bodyParser: { sizeLimit: '16kb' } } };
export const maxDuration = 5;

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Rate limit to prevent brute-force enumeration
  if (!checkRateLimit(req, res, { maxRequests: 60, windowMs: 60_000 })) return;

  try {
    const username = sanitizeString(req.query.username, 20);

    if (!username) {
      return res.status(400).json({ error: 'Missing username parameter' });
    }

    // Validate format
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return res.status(200).json({ available: false, reason: 'Invalid format. Use 3-20 chars: letters, numbers, underscores.' });
    }

    // Check if taken
    const result = await query(
      'SELECT uid FROM public.users WHERE LOWER(username) = LOWER($1)',
      [username]
    );

    return res.status(200).json({
      available: result.rowCount === 0,
      reason: result.rowCount > 0 ? 'Username is already taken.' : null
    });

  } catch (err) {
    return safeError(res, 500, err, '[check-username]');
  }
}
