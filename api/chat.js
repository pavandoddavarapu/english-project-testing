import { setCorsHeaders, checkRateLimit, safeError, sanitizeString } from '../shared/middleware.js';
import { verifyFirebaseIdToken } from '../shared/auth-helper.js';

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!checkRateLimit(req, res, { maxRequests: 20, windowMs: 60_000 })) return;

  try {
    const { messages, idToken } = req.body;

    // Auth: verify Firebase token to prevent anonymous API abuse
    if (!idToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    try {
      await verifyFirebaseIdToken(idToken);
    } catch (authErr) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Invalid messages array" });
    }

    // Limit conversation length to prevent abuse
    const safeMessages = messages.slice(-20).map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: sanitizeString(m.content, 2000)
    })).filter(m => m.content);

    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_KEY) {
      return res.status(500).json({ error: "Missing Gemini API key" });
    }

    const SYSTEM_PROMPT = `You are Genie, an incredibly warm, extremely friendly, and highly encouraging English Tutor for the "Speak Up!" app.
Your goal is to answer the user's questions about English grammar, vocabulary, sentence structure, pronunciation, and language learning.
Always be highly motivating, cheer the user on, and make them feel great about their progress. Use clear formatting with bullet points if explaining rules, and feel free to use a friendly emoji to brighten their day.
If the user asks about something totally unrelated to language learning, gently and warmly steer them back to English practice.`;

    // Format messages for Gemini API
    const contents = safeMessages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    // Format messages for Groq Fallback
    const groqMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...safeMessages
    ];

    // Try Gemini First
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: SYSTEM_PROMPT }]
            },
            contents: contents,
            generationConfig: {
              temperature: 0.5,
            }
          })
        }
      );

      if (response.ok) {
        const json = await response.json();
        let replyText = json.candidates[0].content.parts[0].text;
        return res.status(200).json({ reply: replyText });
      } else {
        const errorData = await response.text();
        console.error("Gemini Chat API Error:", errorData);
      }
    } catch (e) {
      console.error("Gemini Chat Fetch Error:", e);
    }

    // Fallback to Groq (take first key if multiple are supplied)
    const GROQ_KEY = (process.env.GROQ_API_KEY || '').split(',')[0]?.trim();
    if (GROQ_KEY) {
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROQ_KEY}`
          },
          body: JSON.stringify({
            model: process.env.GROQ_CHAT_MODEL || 'llama-3.3-70b-versatile',
            messages: groqMessages,
            temperature: 0.5,
            max_tokens: 1024
          })
        });

        if (groqRes.ok) {
          const json = await groqRes.json();
          const replyText = json.choices[0].message.content;
          return res.status(200).json({ reply: replyText });
        } else {
          console.error("Groq Chat API Error:", await groqRes.text());
        }
      } catch (e) {
        console.error("Groq Chat Fetch Error:", e);
      }
    }

    // Both failed
    return res.status(500).json({ error: "All AI providers failed to respond." });

  } catch (err) {
    return safeError(res, 500, err, '[chat]');
  }
}
