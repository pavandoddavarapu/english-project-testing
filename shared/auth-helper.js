/**
 * api/auth-helper.js
 * 
 * Verifies Supabase access tokens (JWTs) using Supabase's Auth API.
 * This does not require any heavy SDKs.
 */

/**
 * Verify Supabase access token (JWT) by calling the Supabase Auth user endpoint.
 * This does not require any heavy SDKs.
 * @param {string} accessToken 
 * @returns {Promise<{uid: string, email: string, displayName: string}>}
 */
export async function verifySupabaseToken(accessToken) {
  if (!accessToken) {
    throw new Error('Access Token is required');
  }

  const supabaseUrl = process.env.SUPABASE_URL || "https://nwnqehaprqeygpbczbsv.supabase.co";
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseAnonKey) {
    console.error("DB WARNING: SUPABASE_ANON_KEY is not configured in environment variables.");
    throw new Error("Server authentication service is misconfigured");
  }

  const url = `${supabaseUrl}/auth/v1/user`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'apikey': supabaseAnonKey
    }
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Authentication token verification failed (${res.status}): ${errText}`);
  }

  const user = await res.json();
  if (!user || !user.id) {
    throw new Error('Invalid token or user not found');
  }

  return {
    uid: user.id,
    email: user.email,
    displayName: user.user_metadata?.full_name || user.user_metadata?.name || ''
  };
}

/**
 * Wrapper for backward compatibility with existing API endpoints
 */
export async function verifyFirebaseIdToken(idToken) {
  return verifySupabaseToken(idToken);
}
