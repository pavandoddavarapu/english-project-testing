export default async function handler(req, res) {
  // Allow CORS and cache the response globally on Vercel Edge for 24 hours
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=43200');

  const { date } = req.query;
  const today = date || new Date().toISOString().slice(0, 10);

  const AI_PROMPT = `You are a daily content generator for "Speak Up!" — a casual English speech practice app for everyday people.
Today: ${today}. Generate FRESH content. Return ONLY valid JSON (no markdown, no code fences):

{
  "random": {
    "general":    [{"above":"label","main":"topic","below":"bonus thought","difficulty":"easy|medium|hard"}, ...4 items],
    "tech":       [same x4],
    "finance":    [same x4],
    "roast":      [same x4],
    "pitch":      [same x4],
    "defend":     [same x4],
    "eli5":       [same x4],
    "conspiracy": [same x4],
    "hottakes":   [same x4],
    "millennial": [same x4],
    "genz":       [same x4]
  },
  "interview": [{"above":"category","main":"question","below":"tip or follow-up","difficulty":"easy|medium|hard"} x8],
  "vocab": [{"word":"...","pos":"noun|verb|adjective|idiom|phrase|adverb","meaning":"...","example":"...","angle":"..."} x10]
}

CRITICAL RULES FOR "random" SECTION — READ CAREFULLY:
- These are OFF-THE-CUFF casual speaking topics. Use SIMPLE everyday language.
- Topics must be things anyone can speak about without preparation or special knowledge.
- Use short, simple sentences. Avoid big words, academic language, or complex ideas.
- Think: "what would friends chat about over lunch?" — that kind of topic.
- GOOD examples: "Is breakfast the best meal of the day?", "Would you rather work from home or office?", "What's your go-to comfort food and why?"
- BAD examples (too hard): "Evaluate the epistemological implications of AI sentience", "Defend the paradox of contradiction as wisdom"
- "easy" = 5-year-old can understand; "medium" = casual adult chat; "hard" = requires a little thought but still everyday language

Per-category style:
- general: everyday life, opinions, habits, preferences — super casual
- tech: simple tech opinions anyone has (phones, apps, social media, gaming)
- finance: basic money topics (saving, spending, shopping habits)
- roast: playfully argue a silly opinion (e.g. "pineapple on pizza is actually great")
- pitch: sell a silly/simple idea in 60 seconds (e.g. "convince me naps should be mandatory")
- defend: defend an unpopular simple opinion (e.g. "mornings are better than nights")
- eli5: explain something simple in the simplest way (e.g. "explain rain to a 5-year-old")
- conspiracy: fun silly conspiracy theories (keep it light and funny, not dark)
- hottakes: spicy but everyday opinions (e.g. "texting is better than calling")
- millennial: millennial life and culture topics (nostalgia, adulting struggles)
- genz: gen-z trends, social media life, memes, digital culture (casual and fun)

Other sections:
- interview: behavioral STAR-method questions, warm and professional
- vocab: mix of useful everyday words, idioms, and power phrases — not overly academic`;

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  const GROQ_KEY = process.env.GROQ_API_KEY;

  if (!GEMINI_KEY || !GROQ_KEY) {
    return res.status(500).json({ error: "Missing API keys in environment variables." });
  }

  // 1. Try Gemini
  try {
    const geminiRes = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-goog-api-key': GEMINI_KEY },
        body: JSON.stringify({
          contents: [{ parts: [{ text: AI_PROMPT }] }],
          generationConfig: { temperature: 1.0, maxOutputTokens: 8192 }
        })
      }
    );

    if (geminiRes.ok) {
      const json = await geminiRes.json();
      let text = json.candidates[0].content.parts[0].text;
      const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fence) text = fence[1];
      const data = JSON.parse(text.trim());
      data.__source__ = 'Gemini (Flash Latest)';
      return res.status(200).json(data);
    }
    console.warn(`Gemini failed (${geminiRes.status})`);
  } catch (e) {
    console.error('Gemini error:', e);
  }

  // 2. Try Groq Fallback
  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are a JSON content generator. Always respond with ONLY valid JSON — no markdown, no explanation, no code fences.'
          },
          { role: 'user', content: AI_PROMPT }
        ],
        response_format: { type: 'json_object' },
        temperature: 1.0,
        max_tokens: 8192
      })
    });

    if (groqRes.ok) {
      const json = await groqRes.json();
      const data = JSON.parse(json.choices[0].message.content);
      data.__source__ = 'Groq (LLaMA 3.3 70B)';
      return res.status(200).json(data);
    }
    console.warn(`Groq failed (${groqRes.status})`);
  } catch (e) {
    console.error('Groq error:', e);
  }

  // Both failed
  return res.status(500).json({ error: "All AI models failed." });
}
