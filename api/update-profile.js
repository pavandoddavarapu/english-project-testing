/**
 * /api/update-profile.js
 * 
 * PostgreSQL route to update user profile information.
 * Verifies Firebase token, validates inputs, and updates the user record in PostgreSQL.
 */

import { verifyFirebaseIdToken } from './auth-helper.js';
import { query } from './db.js';

export const config = { api: { bodyParser: { sizeLimit: '128kb' } } };
export const maxDuration = 10;

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { idToken, uid, name, gender, avatar_bg, avatar_seed } = req.body || {};

    if (!idToken || !uid) {
      return res.status(400).json({ error: 'Missing idToken or uid' });
    }

    // 1. Verify token & get authenticated uid
    const verifiedUser = await verifyFirebaseIdToken(idToken);
    if (verifiedUser.uid !== uid) {
      return res.status(403).json({ error: 'Unauthorized: UID mismatch' });
    }

    // 2. Validate input variables
    const cleanName = (name || '').trim().substring(0, 100);
    const validGenders = ['male', 'female', 'prefer_not'];
    const cleanGender = validGenders.includes(gender) ? gender : 'prefer_not';
    const cleanAvatarBg = (avatar_bg || 'b6e3f4').replace(/[^a-fA-F0-9]/g, '').substring(0, 6);
    const cleanAvatarSeed = (avatar_seed || 'Felix').replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 50);

    if (!cleanName) {
      return res.status(400).json({ error: 'Name cannot be empty' });
    }

    // 3. Update PostgreSQL database
    const updateRes = await query(`
      UPDATE users
      SET name = $2, gender = $3, avatar_bg = $4, avatar_seed = $5
      WHERE uid = $1
      RETURNING *
    `, [uid, cleanName, cleanGender, cleanAvatarBg, cleanAvatarSeed]);

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
        avatar_seed: cleanAvatarSeed
      }
    });

  } catch (err) {
    console.error('[update-profile] Error:', err.message);
    return res.status(500).json({ error: err.message || 'Internal server error while updating profile' });
  }
}
