/**
 * api/auth-helper.js
 * 
 * Verifies Firebase ID Tokens using Google's public Firebase Identity Toolkit API.
 * This does not require any private service account keys or heavy SDKs.
 */

const FIREBASE_API_KEY = "AIzaSyA-LXQhlPLmrzx_oOhWjo5skg6PnslE_m4"; // Public Firebase API Key

/**
 * Verifies the user's Firebase ID token.
 * @param {string} idToken 
 * @returns {Promise<{uid: string, email: string, displayName: string}>}
 */
export async function verifyFirebaseIdToken(idToken) {
  if (!idToken) {
    throw new Error('ID Token is required');
  }

  const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const errMsg = errData?.error?.message || `HTTP ${res.status}`;
    throw new Error(`Firebase Auth verification failed: ${errMsg}`);
  }

  const data = await res.json();
  const user = data?.users?.[0];
  if (!user) {
    throw new Error('Invalid token or user not found');
  }

  return {
    uid: user.localId,
    email: user.email,
    displayName: user.displayName || ''
  };
}
