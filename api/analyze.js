/**
 * /api/analyze.js
 * 
 * Enqueues a speech analysis task into PostgreSQL and initiates
 * asynchronous background execution, returning a taskId instantly.
 */

import { query } from './db.js';
import crypto from 'crypto';
import { verifyFirebaseIdToken } from './auth-helper.js';
import { setCorsHeaders, checkRateLimit, safeError, sanitizeString, getWorkerSecret } from './middleware.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!checkRateLimit(req, res, { maxRequests: 5, windowMs: 60_000 })) return;

  try {
    const { transcript, audioBase64, mimeType, topic, imageUrl, idToken } = req.body || {};

    // Auth: verify Firebase token to prevent anonymous API abuse
    if (!idToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    try {
      await verifyFirebaseIdToken(idToken);
    } catch (authErr) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    if (!transcript && !audioBase64) {
      return res.status(400).json({ error: 'No audio or transcript provided' });
    }

    // Input validation: prevent oversized payloads slipping past bodyParser
    const cleanTopic = sanitizeString(topic, 500);
    const cleanImageUrl = sanitizeString(imageUrl, 2000);
    const cleanTranscript = sanitizeString(transcript, 50000);
    const cleanMimeType = sanitizeString(mimeType, 100);

    // 1. Generate a unique taskId
    const taskId = crypto.randomUUID();
    console.log(`[analyze] Enqueuing new task: ${taskId} (Tab/Topic: ${topic})`);

    // 2. Insert the pending task into the analysis_queue
    await query(`
      INSERT INTO analysis_queue (task_id, status, transcript, audio_base64, mime_type, topic, image_url)
      VALUES ($1, 'pending', $2, $3, $4, $5, $6)
    `, [
      taskId,
      cleanTranscript || null,
      audioBase64 || null,
      cleanMimeType || null,
      cleanTopic || null,
      cleanImageUrl || null
    ]);

    // 3. Trigger the background worker asynchronously (fire-and-forget)
    const host = req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const workerUrl = `${protocol}://${host}/api/process-queue`;

    console.log(`[analyze] Triggering worker asynchronously at: ${workerUrl}`);
    const workerHeaders = { 'Content-Type': 'application/json' };
    const secret = getWorkerSecret();
    if (secret) workerHeaders['X-Worker-Secret'] = secret;
    fetch(workerUrl, {
      method: 'POST',
      headers: workerHeaders,
      body: JSON.stringify({ taskId })
    }).catch(err => {
      console.error('[analyze] Failed to trigger background worker:', err.message);
    });

    // 4. Return the taskId instantly to the frontend
    return res.status(200).json({ taskId, status: 'pending' });

  } catch (err) {
    return safeError(res, 500, err, '[analyze]');
  }
}
