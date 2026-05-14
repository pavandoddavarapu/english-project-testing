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
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid messages array" });
    }

    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_KEY) {
      return res.status(500).json({ error: "Missing Gemini API key" });
    }

    const SYSTEM_PROMPT = `You are Genie, an incredibly warm, extremely friendly, and highly encouraging English Tutor for the "Speak Up!" app.
Your goal is to answer the user's questions about English grammar, vocabulary, sentence structure, pronunciation, and language learning.
Always be highly motivating, cheer the user on, and make them feel great about their progress. Use clear formatting with bullet points if explaining rules, and feel free to use a friendly emoji to brighten their day.
If the user asks about something totally unrelated to language learning, gently and warmly steer them back to English practice.`;

    // Format messages for Gemini API
    const contents = messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    // Format messages for Groq Fallback
    const groqMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      }))
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

    // Fallback to Groq
    const GROQ_KEY = process.env.GROQ_API_KEY;
    if (GROQ_KEY) {
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROQ_KEY}`
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
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
    console.error("Chat Error:", err);
    return res.status(500).json({ error: "Internal server error during chat" });
  }
}
