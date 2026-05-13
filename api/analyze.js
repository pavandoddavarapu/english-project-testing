export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export const maxDuration = 60;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });

  try {
    const { audioBase64, mimeType, topic } = req.body;

    if (!audioBase64) {
      return res.status(400).json({ error: "No audio data provided" });
    }

    const GROQ_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_KEY) {
      return res.status(500).json({ error: "Missing GROQ_API_KEY environment variable" });
    }

    // ── STEP 1: Transcribe audio using Groq Whisper ──────────────────────────
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    const baseMime = (mimeType || 'audio/webm').split(';')[0];

    // Map MIME type to a file extension Whisper accepts
    const extMap = {
      'audio/webm': 'webm',
      'audio/ogg': 'ogg',
      'audio/mp4': 'mp4',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'audio/flac': 'flac',
    };
    const ext = extMap[baseMime] || 'webm';

    // Build multipart/form-data manually using FormData (Node 18+)
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: baseMime });
    formData.append('file', audioBlob, `audio.${ext}`);
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('response_format', 'json');
    formData.append('language', 'en');

    const whisperRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_KEY}` },
      body: formData,
    });

    let transcription = '';
    if (whisperRes.ok) {
      const whisperData = await whisperRes.json();
      transcription = whisperData.text || '';
    } else {
      const errText = await whisperRes.text();
      console.error('Whisper error:', errText);
      // Continue with empty transcription — still do scoring
    }

    // ── STEP 2: Score the transcription using Groq LLM ──────────────────────
    const scoringPrompt = `You are an expert, encouraging English speech coach.
The student was asked to speak about: "${topic || 'General speaking practice'}"
Their speech transcription is: "${transcription || '(no transcription available)'}"

Your philosophy: build confidence, reward natural expression, reduce fear of judgment.
Evaluate their speech and return ONLY a valid JSON object (no markdown, no extra text):
{
  "fluency": <number 0-100, reward flow and continuity even with simple words>,
  "clarity": <number 0-100, focus on comprehensibility not perfect pronunciation>,
  "confidence": <number 0-100, reward effort and self-expression>,
  "feedback": "<2 encouraging sentences: praise their effort, then give one gentle improvement tip>",
  "transcription": "${transcription.replace(/"/g, '\\"')}"
}`;

    const chatRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [{ role: 'user', content: scoringPrompt }],
        temperature: 0.3,
        max_tokens: 400,
      }),
    });

    if (!chatRes.ok) {
      const errText = await chatRes.text();
      console.error('Groq chat error:', errText);
      let errorMsg = "AI scoring failed";
      try {
        const parsed = JSON.parse(errText);
        if (parsed.error && parsed.error.message) {
          errorMsg = `Groq Error: ${parsed.error.message}`;
        }
      } catch(e) {}
      return res.status(chatRes.status).json({ error: errorMsg, details: errText });
    }

    const chatData = await chatRes.json();
    let text = chatData.choices[0].message.content.trim();

    // Strip markdown fences if present
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) text = fence[1].trim();

    // Also strip any text before/after the JSON object
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];

    const result = JSON.parse(text);
    return res.status(200).json(result);

  } catch (err) {
    console.error('Analysis Error:', err);
    return res.status(500).json({ error: 'Internal server error during speech analysis' });
  }
}
