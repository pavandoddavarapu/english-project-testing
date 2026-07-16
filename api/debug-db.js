import { query } from '../shared/db.js';
import { setCorsHeaders } from '../shared/middleware.js';

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Query users matching the email to see what is stored in the live database
    const emailToCheck = "pavandoddavarapu7@gmail.com";
    const userRes = await query(
      "SELECT uid, name, email, streak, aura_points, username FROM public.users WHERE LOWER(email) = LOWER($1)",
      [emailToCheck]
    );

    // Query a few sample users to see the database contents
    const sampleRes = await query(
      "SELECT uid, name, email, streak FROM public.users ORDER BY created_at DESC LIMIT 5",
      []
    );

    // Check count
    const countRes = await query("SELECT COUNT(*) as total FROM public.users");

    return res.status(200).json({
      success: true,
      matching_users: userRes.rows,
      sample_users: sampleRes.rows,
      total_users_in_db: countRes.rows[0]?.total
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message,
      stack: err.stack
    });
  }
}
