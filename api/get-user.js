/**
 * /api/get-user.js
 *
 * Server-side user data fetcher. Returns the user's Firestore document
 * via the Firestore REST API, authenticated with their Firebase ID token.
 * This bypasses any client-side ad blocker that blocks firestore.googleapis.com.
 */

export const config = { api: { bodyParser: { sizeLimit: '512kb' } } };
export const maxDuration = 10;

const PROJECT_ID = 'speak-up-76a89';
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// ── Value converters (Firestore REST format → plain JS) ───────────────────────

function fromFSValue(fsVal) {
  if (!fsVal) return null;
  if ('nullValue'      in fsVal) return null;
  if ('booleanValue'   in fsVal) return fsVal.booleanValue;
  if ('integerValue'   in fsVal) return Number(fsVal.integerValue);
  if ('doubleValue'    in fsVal) return fsVal.doubleValue;
  if ('stringValue'    in fsVal) return fsVal.stringValue;
  if ('timestampValue' in fsVal) return fsVal.timestampValue;
  if ('arrayValue'     in fsVal) return (fsVal.arrayValue.values || []).map(fromFSValue);
  if ('mapValue'       in fsVal) {
    const obj = {};
    for (const [k, v] of Object.entries(fsVal.mapValue.fields || {})) obj[k] = fromFSValue(v);
    return obj;
  }
  return null;
}

function docToPlain(doc) {
  const obj = {};
  for (const [k, v] of Object.entries(doc.fields || {})) obj[k] = fromFSValue(v);
  return obj;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { idToken, uid } = req.body || {};
    if (!idToken || !uid) {
      return res.status(400).json({ error: 'Missing idToken or uid' });
    }

    const url = `${FS_BASE}/users/${uid}`;
    const fsRes = await fetch(url, {
      headers: { Authorization: `Bearer ${idToken}` }
    });

    if (fsRes.status === 404) {
      return res.status(200).json({ exists: false, data: {} });
    }

    if (!fsRes.ok) {
      const errText = await fsRes.text();
      console.error('[get-user] Firestore error:', fsRes.status, errText.slice(0, 200));
      return res.status(500).json({ error: `Firestore ${fsRes.status}` });
    }

    const doc = await fsRes.json();
    const data = docToPlain(doc);

    console.log(`[get-user] OK for uid=${uid}`);
    return res.status(200).json({ exists: true, data });

  } catch (err) {
    console.error('[get-user] Error:', err.message);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
