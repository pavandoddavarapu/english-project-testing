/**
 * /api/analyze.js
 * 
 * Enqueues a speech analysis task into PostgreSQL and initiates
 * asynchronous background execution, returning a taskId instantly.
 */

import { query } from './db.js';
import crypto from 'crypto';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });

  try {
    const { transcript, audioBase64, mimeType, topic, imageUrl } = req.body || {};

    if (!transcript && !audioBase64) {
      return res.status(400).json({ error: 'No audio or transcript provided' });
    }

    // 1. Generate a unique taskId
    const taskId = crypto.randomUUID();
    console.log(`[analyze] Enqueuing new task: ${taskId} (Tab/Topic: ${topic})`);

    // 2. Insert the pending task into the analysis_queue
    await query(`
      INSERT INTO analysis_queue (task_id, status, transcript, audio_base64, mime_type, topic, image_url)
      VALUES ($1, 'pending', $2, $3, $4, $5, $6)
    `, [
      taskId,
      transcript || null,
      audioBase64 || null,
      mimeType || null,
      topic || null,
      imageUrl || null
    ]);

    // 3. Trigger the background worker asynchronously (fire-and-forget)
    const host = req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const workerUrl = `${protocol}://${host}/api/process-queue`;

    console.log(`[analyze] Triggering worker asynchronously at: ${workerUrl}`);
    fetch(workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId })
    }).catch(err => {
      console.error('[analyze] Failed to trigger background worker:', err.message);
    });

    // 4. Return the taskId instantly to the frontend
    return res.status(200).json({ taskId, status: 'pending' });

  } catch (err) {
    console.error('[analyze] Error enqueuing task:', err.message);
    return res.status(500).json({ error: 'Internal server error while enqueuing task' });
  }
}
