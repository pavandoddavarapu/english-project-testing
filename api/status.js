/**
 * /api/status.js
 * 
 * Status polling endpoint.
 * Checks the status of a queued analysis task.
 * If the task is completed or failed, returns immediately.
 * If the task is stalled (timed out), initiates a synchronous recovery.
 */

import { query } from './db.js';
import { setCorsHeaders, safeError, getWorkerSecret } from './middleware.js';

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { taskId } = req.query || {};

  if (!taskId) {
    return res.status(400).json({ error: 'Missing taskId' });
  }

  try {
    // 1. Fetch current task state
    const taskRes = await query('SELECT * FROM analysis_queue WHERE task_id = $1', [taskId]);
    
    if (taskRes.rowCount === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskRes.rows[0];

    // 2. Return completed/failed states immediately
    if (task.status === 'completed') {
      return res.status(200).json({ status: 'completed', result: task.result });
    }
    if (task.status === 'failed') {
      return res.status(200).json({ status: 'failed', error: task.error_message });
    }

    // 3. Check for timeout / stalled state (e.g., worker container died)
    const timeSinceUpdate = Date.now() - new Date(task.updated_at).getTime();
    if (timeSinceUpdate > 12000) { // 12 seconds
      console.log(`[status] Task ${taskId} has stalled (active for ${timeSinceUpdate}ms). Triggering synchronous recovery...`);
      
      const host = req.headers.host;
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const workerUrl = `${protocol}://${host}/api/process-queue`;

      // Call the worker synchronously to finish the job
      const workerHeaders = { 'Content-Type': 'application/json' };
      const secret = getWorkerSecret();
      if (secret) workerHeaders['X-Worker-Secret'] = secret;
      await fetch(workerUrl, {
        method: 'POST',
        headers: workerHeaders,
        body: JSON.stringify({ taskId })
      }).catch(err => {
        console.error('[status] Recovery worker fetch failed:', err.message);
      });

      // Fetch the updated task state
      const freshRes = await query('SELECT * FROM analysis_queue WHERE task_id = $1', [taskId]);
      if (freshRes.rowCount > 0) {
        const freshTask = freshRes.rows[0];
        if (freshTask.status === 'completed') {
          return res.status(200).json({ status: 'completed', result: freshTask.result });
        }
        if (freshTask.status === 'failed') {
          return res.status(200).json({ status: 'failed', error: freshTask.error_message });
        }
      }
    }

    // 4. Still processing, return active status
    return res.status(200).json({ status: task.status });

  } catch (err) {
    return safeError(res, 500, err, '[status]');
  }
}
