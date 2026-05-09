export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { audioBase64, mimeType, topic, imageUrl } = req.body;

    if (!audioBase64) {
      return res.status(400).json({ error: "No audio data provided" });
    }

    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_KEY) {
      return res.status(500).json({ error: "Missing Gemini API key" });
    }

    const AI_PROMPT = `You are an expert English speech analyst. 
Listen to the user's speech responding to the topic: "${topic || 'General speaking practice'}".
If an image is attached, also evaluate how well the user's speech describes or relates to the visual content.
Evaluate their English speaking skills.
Return ONLY a valid JSON object in the following format (no markdown fences):
{
  "fluency": <number 0-100, how smooth and continuous the speech is>,
  "clarity": <number 0-100, pronunciation and articulation>,
  "confidence": <number 0-100, tone and pacing>,
  "feedback": "<A short, encouraging sentence or two explaining the scores and giving a specific tip for improvement>",
  "transcription": "<The text of what the user actually said>"
}`;

    const parts = [
      { text: AI_PROMPT },
      {
        inlineData: {
          mimeType: mimeType || 'audio/webm',
          data: audioBase64
        }
      }
    ];

    if (imageUrl) {
      try {
        const imageRes = await fetch(imageUrl);
        if (imageRes.ok) {
          const imageBuffer = await imageRes.arrayBuffer();
          const imageBase64 = Buffer.from(imageBuffer).toString('base64');
          const imageMimeType = imageRes.headers.get('content-type') || 'image/jpeg';
          parts.push({
            inlineData: {
              mimeType: imageMimeType,
              data: imageBase64
            }
          });
        } else {
          console.warn(`Failed to fetch image, status: ${imageRes.status}`);
        }
      } catch (err) {
        console.warn("Failed to fetch image for analysis", err);
      }
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: parts
            }
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json"
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Gemini API Error:", errorData);
      return res.status(response.status).json({ error: "Speech analysis failed at AI provider", details: errorData });
    }

    const json = await response.json();
    let text = json.candidates[0].content.parts[0].text;
    
    // Clean markdown fences just in case
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) text = fence[1];
    
    const data = JSON.parse(text.trim());
    return res.status(200).json(data);
  } catch (err) {
    console.error("Analysis Error:", err);
    return res.status(500).json({ error: "Internal server error during speech analysis" });
  }
}
