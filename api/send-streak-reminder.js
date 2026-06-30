/**
 * /api/send-streak-reminder.js
 *
 * Sends email streak reminders via Resend.com to users who:
 * - Have a streak >= 2 days (worth protecting)
 * - Have NOT practiced today (IST)
 * - Have opted in to email reminders (email_reminders = true)
 *
 * Trigger: Call this endpoint daily via a cron (Vercel Cron or GitHub Actions)
 * Requires: RESEND_API_KEY env variable
 *
 * Schedule: Add to vercel.json crons:
 * { "path": "/api/send-streak-reminder", "schedule": "30 13 * * *" }
 * (13:30 UTC = 19:00 IST)
 */

import { query } from '../shared/db.js';
import { setCorsHeaders, verifyWorkerSecret, safeError } from '../shared/middleware.js';

export const config = { api: { bodyParser: false } };
export const maxDuration = 30;

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = 'Speak Up! <reminders@speakupai.me>';

async function sendEmail(to, name, streak) {
  if (!RESEND_API_KEY) {
    console.warn('[streak-reminder] No RESEND_API_KEY set — skipping email');
    return false;
  }

  const streakEmoji = streak >= 30 ? '💎' : streak >= 7 ? '🔥' : '⚡';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Segoe UI', Helvetica, Arial, sans-serif; background: #0d0d1a; margin: 0; padding: 0; }
    .container { max-width: 540px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #1a1a2e; border-radius: 20px; padding: 36px; border: 1px solid #2d2d4e; text-align: center; }
    .emoji { font-size: 56px; margin-bottom: 16px; }
    h1 { color: #ffffff; font-size: 24px; margin: 0 0 10px; }
    p { color: #a0a0c0; font-size: 15px; line-height: 1.6; margin: 0 0 20px; }
    .streak-badge { display: inline-block; background: linear-gradient(135deg, #D63384, #7c3aed); color: white; padding: 10px 24px; border-radius: 50px; font-size: 18px; font-weight: 700; margin: 10px 0 24px; }
    .cta-btn { display: inline-block; background: #D63384; color: white; text-decoration: none; padding: 14px 32px; border-radius: 50px; font-weight: 700; font-size: 16px; }
    .footer { color: #555577; font-size: 12px; margin-top: 24px; }
    .footer a { color: #7070aa; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="emoji">${streakEmoji}</div>
      <h1>Hey ${name}, your streak is at risk!</h1>
      <p>You have an amazing <strong style="color:white">${streak}-day streak</strong> on Speak Up! Don't let it disappear — just 2 minutes of practice keeps it alive.</p>
      <div class="streak-badge">${streakEmoji} ${streak} Day Streak</div>
      <br>
      <a href="https://speakupai.me/practice" class="cta-btn">Practice Now → Keep My Streak!</a>
      <div class="footer">
        <p>You're receiving this because you opted in to streak reminders.<br>
        <a href="https://speakupai.me/dashboard">Unsubscribe in your dashboard settings</a></p>
      </div>
    </div>
  </div>
</body>
</html>`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject: `${streakEmoji} Your ${streak}-day streak is at risk! Practice now on Speak Up!`,
        html,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[streak-reminder] Resend error:', err);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[streak-reminder] Fetch error:', e.message);
    return false;
  }
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Protect this endpoint — only internal cron can call it
  if (!verifyWorkerSecret(req)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    // IST today's date
    const istOffset = 5.5 * 60 * 60 * 1000;
    const todayIST = new Date(Date.now() + istOffset).toISOString().split('T')[0];

    // Find users who:
    // 1. Have streak >= 2
    // 2. Email reminders opted in
    // 3. Have NOT practiced today
    const usersRes = await query(`
      SELECT u.uid, u.name, u.email, u.streak
      FROM users u
      WHERE u.streak >= 2
        AND u.email_reminders = true
        AND NOT EXISTS (
          SELECT 1 FROM practice_sessions ps
          WHERE ps.user_id = u.uid
            AND DATE(ps.date AT TIME ZONE 'Asia/Kolkata') = $1
        )
      LIMIT 100
    `, [todayIST]);

    const users = usersRes.rows;
    let sent = 0;
    let failed = 0;

    for (const user of users) {
      const ok = await sendEmail(user.email, user.name, user.streak);
      if (ok) sent++; else failed++;
      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 100));
    }

    console.log(`[streak-reminder] Sent: ${sent}, Failed: ${failed}, Total: ${users.length}`);

    return res.status(200).json({
      success: true,
      usersFound: users.length,
      emailsSent: sent,
      emailsFailed: failed,
      date: todayIST,
    });

  } catch (err) {
    return safeError(res, 500, err, '[send-streak-reminder]');
  }
}
