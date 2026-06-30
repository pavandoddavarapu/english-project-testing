/**
 * /api/push-subscribe.js
 *
 * Saves a Web Push subscription for a user.
 * Called when user opts in to PWA push notifications.
 *
 * Requires: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT env vars
 * Generate VAPID keys: npx web-push generate-vapid-keys
 */

import { query } from '../shared/db.js';
import { setCorsHeaders, checkRateLimit, safeError, sanitizeString } from '../shared/middleware.js';
import { auth } from '../shared/auth-helper.js';

export const config = { api: { bodyParser: { sizeLimit: '8kb' } } };
export const maxDuration = 10;

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!checkRateLimit(req, res, { maxRequests: 10, windowMs: 60_000 })) return;

  try {
    const { idToken, uid, subscription, action } = req.body || {};

    if (!idToken || !uid) return res.status(400).json({ error: 'Missing auth' });
    if (!subscription && action !== 'unsubscribe') return res.status(400).json({ error: 'Missing subscription' });

    // Verify Firebase token
    const verifiedUser = await auth.verifyIdToken(idToken);
    if (verifiedUser.uid !== uid) return res.status(401).json({ error: 'Token mismatch' });

    if (action === 'unsubscribe') {
      // Remove subscription
      await query(
        'UPDATE users SET push_subscription = NULL WHERE uid = $1',
        [uid]
      );
      return res.status(200).json({ success: true, action: 'unsubscribed' });
    }

    // Save/update subscription
    await query(
      'UPDATE users SET push_subscription = $1 WHERE uid = $2',
      [JSON.stringify(subscription), uid]
    );

    return res.status(200).json({ success: true, action: 'subscribed' });

  } catch (err) {
    return safeError(res, 500, err, '[push-subscribe]');
  }
}
