/**
 * /api/save-session.js
 *
 * Server-side Firestore writer. Because this runs on Vercel (Node.js),
 * it is never touched by the user's ad blocker.
 *
 * The client sends:
 *   { idToken, uid, sessionData: { topic, mode, score, fluency, clarity, confidence } }
 *
 * We use the Firestore REST API authenticated with the user's Firebase
 * ID token — no Admin SDK / service-account needed.
 */

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };
export const maxDuration = 15;

const PROJECT_ID = 'speak-up-76a89';
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// ── Firestore REST helpers ────────────────────────────────────────────────────

function toFSValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean')          return { booleanValue: val };
  if (typeof val === 'number')           return Number.isInteger(val)
    ? { integerValue: String(val) }
    : { doubleValue: val };
  if (typeof val === 'string')           return { stringValue: val };
  if (val instanceof Date)               return { timestampValue: val.toISOString() };
  if (Array.isArray(val))                return { arrayValue: { values: val.map(toFSValue) } };
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) fields[k] = toFSValue(v);
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

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

async function fsGet(uid, idToken) {
  const url = `${FS_BASE}/users/${uid}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${idToken}` }
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore GET failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return docToPlain(json);
}

async function fsPatch(uid, idToken, fields) {
  // Build field list for partial update
  const fieldPaths = Object.keys(fields).join(',');
  const url = `${FS_BASE}/users/${uid}?updateMask.fieldPaths=${encodeURIComponent(fieldPaths)}`;

  const body = { fields: {} };
  for (const [k, v] of Object.entries(fields)) body.fields[k] = toFSValue(v);

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Firestore PATCH failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { idToken, uid, sessionData } = req.body || {};

    if (!idToken || !uid || !sessionData) {
      return res.status(400).json({ error: 'Missing idToken, uid, or sessionData' });
    }

    // ── 1. Read current user document ─────────────────────────────────────────
    const currentData = await fsGet(uid, idToken) || {};

    const now = new Date();
    const todayISO     = now.toISOString();
    const todayDateStr = todayISO.split('T')[0];

    const fluency    = Math.min(100, Math.max(0, Number(sessionData.fluency)    || 0));
    const clarity    = Math.min(100, Math.max(0, Number(sessionData.clarity)    || 0));
    const confidence = Math.min(100, Math.max(0, Number(sessionData.confidence) || 0));
    const avgScore   = Math.round((fluency + clarity + confidence) / 3);

    // ── 2. Streak calculation ─────────────────────────────────────────────────
    const existingDates    = Array.isArray(currentData.practice_dates) ? currentData.practice_dates : [];
    const uniqueDateStrs   = [...new Set(existingDates.map(d => String(d).split('T')[0]))].filter(Boolean).sort();

    let newStreak = Number(currentData.streak) || 0;
    if (!uniqueDateStrs.includes(todayDateStr)) {
      if (uniqueDateStrs.length === 0) {
        newStreak = 1;
      } else {
        const lastDate    = new Date(uniqueDateStrs[uniqueDateStrs.length - 1] + 'T00:00:00Z');
        const todayMid    = new Date(todayDateStr + 'T00:00:00Z');
        const diffDays    = Math.round((todayMid - lastDate) / 86400000);
        newStreak = diffDays === 1 ? newStreak + 1 : 1;
      }
    }

    // ── 3. Build updated sessions list ────────────────────────────────────────
    const existingSessions = Array.isArray(currentData.recent_sessions) ? currentData.recent_sessions : [];
    const newSession = {
      date:       todayISO,
      topic:      String(sessionData.topic || 'General Practice'),
      mode:       String(sessionData.mode  || 'random'),
      score:      avgScore,
      fluency,
      clarity,
      confidence,
    };
    const trimmedSessions = [newSession, ...existingSessions].slice(0, 20);

    // ── 4. Build updated practice_dates ───────────────────────────────────────
    const updatedDates = [...new Set([...existingDates, todayISO])];

    // ── 5. Write everything back ──────────────────────────────────────────────
    await fsPatch(uid, idToken, {
      aura_points:     (Number(currentData.aura_points) || 0) + 10,
      total_yaps:      (Number(currentData.total_yaps)  || 0) + 1,
      streak:           newStreak,
      practice_dates:   updatedDates,
      recent_sessions:  trimmedSessions,
    });

    console.log(`[save-session] uid=${uid} mode=${sessionData.mode} score=${avgScore} streak=${newStreak}`);
    return res.status(200).json({ ok: true, streak: newStreak, aura: (Number(currentData.aura_points) || 0) + 10 });

  } catch (err) {
    console.error('[save-session] Error:', err.message);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
