/**
 * /api/update-profile.js
 * 
 * PostgreSQL route to update user profile information.
 * Verifies Firebase token, validates inputs, and updates the user record in PostgreSQL.
 */

import { verifyFirebaseIdToken } from '../shared/auth-helper.js';
import { query } from '../shared/db.js';
import { setCorsHeaders, checkRateLimit, safeError } from '../shared/middleware.js';

export const config = { api: { bodyParser: { sizeLimit: '128kb' } } };
export const maxDuration = 10;

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!checkRateLimit(req, res, { maxRequests: 5, windowMs: 60_000 })) return;

  try {
    const { idToken, uid, name, gender, avatar_bg, avatar_seed, linkedin_url, instagram_url, username, action, subscription, enabled } = req.body || {};

    if (!idToken || !uid) {
      return res.status(400).json({ error: 'Missing idToken or uid' });
    }

    // 1. Verify token & get authenticated uid
    const verifiedUser = await verifyFirebaseIdToken(idToken);
    if (verifiedUser.uid !== uid) {
      return res.status(403).json({ error: 'Unauthorized: UID mismatch' });
    }

    // ── PUSH SUBSCRIPTION ACTION ──────────────────────────────────────────────
    if (action === 'push-subscribe') {
      await query('UPDATE users SET push_subscription = $1 WHERE uid = $2', [JSON.stringify(subscription), uid]);
      return res.status(200).json({ ok: true, action: 'subscribed' });
    }
    if (action === 'push-unsubscribe') {
      await query('UPDATE users SET push_subscription = NULL WHERE uid = $1', [uid]);
      return res.status(200).json({ ok: true, action: 'unsubscribed' });
    }

    // -- EMAIL REMINDERS TOGGLE --------------------------------------------------
    if (action === 'email-reminders') {
      const emailEnabled = enabled === true || enabled === 'true';
      await query('UPDATE users SET email_reminders = $1 WHERE uid = $2', [emailEnabled, uid]);
      return res.status(200).json({ ok: true, action: 'email-reminders', enabled: emailEnabled });
    }

    // 2. Validate input variables
    const cleanName = (name || '').trim().substring(0, 100);
    const validGenders = ['male', 'female', 'prefer_not'];
    const cleanGender = validGenders.includes(gender) ? gender : 'prefer_not';
    const cleanAvatarBg = (avatar_bg || 'b6e3f4').replace(/[^a-fA-F0-9]/g, '').substring(0, 6);
    const cleanAvatarSeed = (avatar_seed || 'Felix').replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 50);
    const cleanLinkedin = (linkedin_url || '').trim().substring(0, 255);
    const cleanInstagram = (instagram_url || '').trim().substring(0, 255);

    if (cleanLinkedin && !cleanLinkedin.startsWith('https://')) {
      return res.status(400).json({ error: 'LinkedIn URL must start with https://' });
    }
    if (cleanInstagram && !cleanInstagram.startsWith('https://')) {
      return res.status(400).json({ error: 'Instagram URL must start with https://' });
    }

    // Validate unique username
    const rawUsername = (username || '').trim().toLowerCase().substring(0, 50);
    let cleanUsername = null;
    if (rawUsername) {
      const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
      if (!usernameRegex.test(rawUsername)) {
        return res.status(400).json({ error: 'Username must be between 3 and 20 characters and contain only letters, numbers, or underscores.' });
      }
      cleanUsername = rawUsername;

      // Check if username is already taken by another user
      const takenRes = await query(
        'SELECT uid FROM public.users WHERE LOWER(username) = LOWER($1) AND uid != $2',
        [cleanUsername, uid]
      );
      if (takenRes.rowCount > 0) {
        return res.status(400).json({ error: 'Username is already taken by another user.' });
      }
    }

    if (!cleanName) {
      return res.status(400).json({ error: 'Name cannot be empty' });
    }

    // 3. Update PostgreSQL database
    const updateRes = await query(`
      UPDATE public.users
      SET name = $2, gender = $3, avatar_bg = $4, avatar_seed = $5, linkedin_url = $6, instagram_url = $7, username = $8
      WHERE uid = $1
      RETURNING *
    `, [uid, cleanName, cleanGender, cleanAvatarBg, cleanAvatarSeed, cleanLinkedin || null, cleanInstagram || null, cleanUsername]);

    if (updateRes.rowCount === 0) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    console.log(`[update-profile] Successfully updated profile for uid=${uid}`);

    return res.status(200).json({
      ok: true,
      message: 'Profile updated successfully',
      data: {
        name: cleanName,
        gender: cleanGender,
        avatar_bg: cleanAvatarBg,
        avatar_seed: cleanAvatarSeed,
        linkedin_url: cleanLinkedin,
        instagram_url: cleanInstagram,
        username: cleanUsername || ''
      }
    });

  } catch (err) {
    return safeError(res, 500, err, '[update-profile]');
  }
}
