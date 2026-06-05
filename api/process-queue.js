/**
 * /api/process-queue.js
 * 
 * Background worker endpoint.
 * Fetches a pending task, performs transcription & scoring via Groq,
 * and saves the final result back to the PostgreSQL database.
 */

import { query } from './db.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export const maxDuration = 60; // Allow enough time for AI APIs to respond

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });

  const { taskId } = req.body || {};

  if (!taskId) {
    return res.status(400).json({ error: 'Missing taskId' });
  }

  try {
    // 1. Atomically lock and mark the task as 'processing' to avoid duplicate execution
    const lockRes = await query(`
      UPDATE analysis_queue
      SET status = 'processing', updated_at = NOW()
      WHERE task_id = $1 AND (status = 'pending' OR (status = 'processing' AND updated_at < NOW() - INTERVAL '15 seconds'))
      RETURNING *
    `, [taskId]);

    if (lockRes.rowCount === 0) {
      console.log(`[process-queue] Task ${taskId} is already being processed or finished.`);
      return res.status(200).json({ message: 'Task already active or completed' });
    }

    const task = lockRes.rows[0];
    const GROQ_KEY = process.env.GROQ_API_KEY;

    if (!GROQ_KEY) {
      throw new Error('Missing GROQ_API_KEY environment variable');
    }

    let cleanTranscription = task.transcript || '';

    // ── PATH B: Transcribe audio server-side via Groq ──
    if (!cleanTranscription && task.audio_base64) {
      console.log(`[process-queue] Transcribing audio for taskId=${taskId} via Groq Whisper`);
      const audioBuffer = Buffer.from(task.audio_base64, 'base64');
      const baseMime = (task.mime_type || 'audio/webm').split(';')[0];

      const extMap = {
        'audio/webm': 'webm',
        'audio/ogg':  'ogg',
        'audio/mp4':  'mp4',
        'audio/mpeg': 'mp3',
        'audio/wav':  'wav',
        'audio/flac': 'flac',
      };
      const ext = extMap[baseMime] || 'webm';

      const formData = new FormData();
      const audioBlob = new Blob([audioBuffer], { type: baseMime });
      formData.append('file', audioBlob, `audio.${ext}`);
      formData.append('model', 'whisper-large-v3-turbo');
      formData.append('response_format', 'json');
      formData.append('language', 'en');

      const whisperRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${GROQ_KEY}` },
        body: formData,
      });

      if (whisperRes.ok) {
        const whisperData = await whisperRes.json();
        cleanTranscription = (whisperData.text || '').trim();
      } else {
        const errText = await whisperRes.text();
        console.error(`[process-queue] Whisper error for taskId=${taskId}:`, errText);
      }
    }

    // ── STEP 1.5: Validate Transcription Length ──
    const wordCount = cleanTranscription.split(/\s+/).filter(w => w.length > 0).length;

    if (wordCount < 3 || cleanTranscription.length < 10) {
      const shortResult = {
        fluency: 0,
        clarity: 0,
        confidence: 0,
        feedback: 'Hmm, that was a bit too short! To give you a good analysis, I need to hear a little more. Take a deep breath and try speaking for at least a few sentences.',
        transcription: cleanTranscription,
      };

      await query(`
        UPDATE analysis_queue
        SET status = 'completed', result = $2, updated_at = NOW()
        WHERE task_id = $1
      `, [taskId, JSON.stringify(shortResult)]);

      return res.status(200).json({ status: 'completed', taskId });
    }

    // ── STEP 2: Score the transcription using Groq LLM ──
    console.log(`[process-queue] Scoring transcription for taskId=${taskId}`);
    const escapedTranscriptionForJSON = JSON.stringify(cleanTranscription);
    const escapedTopicForPrompt = (task.topic || 'General speaking practice').replace(/"/g, "'");

    const scoringPrompt = `You are an expert, incredibly warm, and encouraging English speech coach.
The student was asked to speak about: "${escapedTopicForPrompt}"
Their speech transcription is: ${escapedTranscriptionForJSON}

Your philosophy: ALWAYS be incredibly warm, friendly, and highly motivating. Use encouraging language, cheer them on, and make them feel amazing about practicing. Reward effort, natural expression, and flow. However, if the speech is completely off-topic, just a few random words, or gibberish, score them strictly (e.g., 0-10) but gently and warmly encourage them to try speaking directly about the topic next time.
Evaluate their speech and return ONLY a valid JSON object (no markdown, no extra text):
{
  "fluency": <number 0-100, reward flow and continuity even with simple words>,
  "clarity": <number 0-100, focus on comprehensibility not perfect pronunciation>,
  "confidence": <number 0-100, reward effort and self-expression>,
  "feedback": "<2-3 extremely encouraging and friendly sentences: warmly praise their effort, give one gentle improvement tip, and add a motivating cheer at the end>",
  "transcription": ${escapedTranscriptionForJSON}
}`;


    const chatRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: scoringPrompt }],
        temperature: 0.3,
        max_tokens: 400,
      }),
    });

    if (!chatRes.ok) {
      const errText = await chatRes.text();
      throw new Error(`Groq scoring API returned ${chatRes.status}: ${errText}`);
    }

    const chatData = await chatRes.json();
    let text = chatData.choices[0].message.content.trim();

    // Strip markdown fences if present
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) text = fence[1].trim();

    // Also strip any text before/after the JSON object
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];

    const finalResult = JSON.parse(text);

    // Save final successful result to database
    await query(`
      UPDATE analysis_queue
      SET status = 'completed', result = $2, updated_at = NOW()
      WHERE task_id = $1
    `, [taskId, JSON.stringify(finalResult)]);

    console.log(`[process-queue] Task ${taskId} successfully completed.`);
    return res.status(200).json({ status: 'completed', taskId });

  } catch (err) {
    console.error(`[process-queue] Error processing taskId=${taskId}:`, err.message);
    
    // Save failure status to database so polling client knows it failed
    await query(`
      UPDATE analysis_queue
      SET status = 'failed', error_message = $2, updated_at = NOW()
      WHERE task_id = $1
    `, [taskId, err.message]);

    return res.status(500).json({ error: err.message });
  }
}
