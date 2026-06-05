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

// Helper to perform fetch requests to Groq with automatic key rotation on rate limits (429)
async function fetchGroqWithRotation(url, options, keys) {
  let lastError = new Error("No Groq API keys available");
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const headers = {
      ...(options.headers || {}),
      'Authorization': `Bearer ${key}`
    };
    try {
      const res = await fetch(url, { ...options, headers });
      if (res.status === 429) {
        console.warn(`[Groq Rotation] Key ${i+1}/${keys.length} hit rate limit (429). Trying next key...`);
        lastError = new Error(`Groq key ${i+1} was rate limited (429)`);
        continue;
      }
      return { response: res, workingKey: key };
    } catch (err) {
      console.warn(`[Groq Rotation] Key ${i+1}/${keys.length} failed: ${err.message}. Trying next key...`);
      lastError = err;
    }
  }
  throw lastError;
}

// Fallback to Gemini 1.5 Flash for high-quality audio transcription if Groq fails
async function transcribeViaGemini(audioBase64, mimeType, geminiKey) {
  if (!geminiKey) throw new Error("Gemini API key is not configured");
  const baseMime = (mimeType || 'audio/webm').split(';')[0];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
  
  console.log(`[process-queue] Falling back to Gemini 1.5 Flash for audio transcription`);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          {
            inlineData: {
              mimeType: baseMime,
              data: audioBase64
            }
          },
          {
            text: "Provide a direct, accurate transcript of the speech in this audio file. Do not add any filler text, introductory remarks, formatting, or commentary. If there is no speech or it is silent, reply with nothing."
          }
        ]
      }]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini transcription fallback returned ${response.status}: ${errText}`);
  }

  const json = await response.json();
  const transcript = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!transcript) {
    throw new Error("Gemini returned empty transcription response");
  }
  return transcript.trim();
}

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
    const groqKeys = (process.env.GROQ_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);
    const GEMINI_KEY = process.env.GEMINI_API_KEY;

    if (groqKeys.length === 0) {
      throw new Error('Missing GROQ_API_KEY environment variable');
    }

    let cleanTranscription = task.transcript || '';
    let activeGroqKey = groqKeys[0];

    // ── PATH B: Transcribe audio server-side ──
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

      try {
        const { response: whisperRes, workingKey } = await fetchGroqWithRotation(
          'https://api.groq.com/openai/v1/audio/transcriptions',
          {
            method: 'POST',
            body: formData,
          },
          groqKeys
        );

        activeGroqKey = workingKey;

        if (whisperRes.ok) {
          const whisperData = await whisperRes.json();
          cleanTranscription = (whisperData.text || '').trim();
        } else {
          const errText = await whisperRes.text();
          console.error(`[process-queue] Whisper error for taskId=${taskId}:`, errText);
          throw new Error(`Groq Whisper returned status ${whisperRes.status}`);
        }
      } catch (whisperErr) {
        console.warn(`[process-queue] All Groq keys failed for Whisper transcription:`, whisperErr.message);

        if (GEMINI_KEY) {
          try {
            cleanTranscription = await transcribeViaGemini(task.audio_base64, task.mime_type, GEMINI_KEY);
            console.log(`[process-queue] Gemini 1.5 Flash transcription fallback succeeded.`);
          } catch (geminiErr) {
            console.error(`[process-queue] Gemini transcription fallback also failed:`, geminiErr.message);
            throw new Error(`Transcription failed: both Groq Whisper and Gemini fallback failed. Details: ${whisperErr.message} | ${geminiErr.message}`);
          }
        } else {
          throw new Error(`Transcription failed on all Groq keys, and no Gemini API key is configured as fallback.`);
        }
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
        SET status = 'completed', result = $2, audio_base64 = NULL, updated_at = NOW()
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


    let chatRes;
    try {
      // Prioritize the Groq key that successfully worked for Whisper, falling back to others
      const keysToTry = activeGroqKey ? [activeGroqKey, ...groqKeys.filter(k => k !== activeGroqKey)] : groqKeys;

      const rotationRes = await fetchGroqWithRotation(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: [{ role: 'user', content: scoringPrompt }],
            temperature: 0.3,
            max_tokens: 400,
          }),
        },
        keysToTry
      );

      chatRes = rotationRes.response;
    } catch (scoringErr) {
      console.error(`[process-queue] Groq scoring API failed on all keys:`, scoringErr.message);
      throw new Error(`Scoring failed on all Groq keys. Details: ${scoringErr.message}`);
    }

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

    // Save final successful result to database and clear raw audio base64 to save DB storage
    await query(`
      UPDATE analysis_queue
      SET status = 'completed', result = $2, audio_base64 = NULL, updated_at = NOW()
      WHERE task_id = $1
    `, [taskId, JSON.stringify(finalResult)]);

    console.log(`[process-queue] Task ${taskId} successfully completed.`);
    return res.status(200).json({ status: 'completed', taskId });

  } catch (err) {
    console.error(`[process-queue] Error processing taskId=${taskId}:`, err.message);
    
    // Save failure status to database and clear raw audio base64 to prevent storage leaks
    await query(`
      UPDATE analysis_queue
      SET status = 'failed', error_message = $2, audio_base64 = NULL, updated_at = NOW()
      WHERE task_id = $1
    `, [taskId, err.message]);

    return res.status(500).json({ error: err.message });
  }
}
