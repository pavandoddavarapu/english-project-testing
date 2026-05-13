export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export const maxDuration = 60; // Prevents Vercel 504 Gateway Timeout

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

    const AI_PROMPT = `You are an expert, encouraging English speech coach. 
Listen to the user's speech responding to the topic: "${topic || 'General speaking practice'}".
Your core philosophy is to build confidence, encourage natural improvisation, and reduce the fear of judgment. Do not demand "perfect English". Instead, focus on their ability to express thoughts comfortably.
If an image is attached, also evaluate how well their speech describes the visual content.
Return ONLY a valid JSON object in the exact format below (no markdown fences):
{
  "fluency": <number 0-100, reward them for keeping the flow going even if they use simple words>,
  "clarity": <number 0-100, focus on comprehensibility rather than perfect native pronunciation>,
  "confidence": <number 0-100, reward them for trying and expressing themselves without over-worrying>,
  "feedback": "<A highly encouraging, personalized 2-sentence feedback. Praise their effort, show them their progress, and give one gentle tip to help them improvise or frame thoughts better next time. Make them feel progress rather than pressure.>",
  "transcription": "<The text of what they actually said>"
}`;

    const parts = [
      { text: AI_PROMPT },
      {
        inlineData: {
          mimeType: (mimeType || 'audio/webm').split(';')[0],
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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
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
      const errorText = await response.text();
      console.error("Gemini API Error:", errorText);
      let errorMsg = "Speech analysis failed at AI provider";
      try {
        const parsed = JSON.parse(errorText);
        if (parsed.error && parsed.error.message) {
          errorMsg = `Gemini Error: ${parsed.error.message}`;
        } else {
          errorMsg = `Gemini Error: ${errorText.substring(0, 50)}`;
        }
      } catch(e) {
        errorMsg = `Gemini Error: ${errorText.substring(0, 50)}`;
      }
      return res.status(response.status).json({ error: errorMsg, details: errorText });
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
