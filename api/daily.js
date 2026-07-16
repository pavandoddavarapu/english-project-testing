import { query } from '../shared/db.js';
import { setCorsHeaders, checkRateLimit, safeError } from '../shared/middleware.js';

export const config = { api: { bodyParser: false } };
export const maxDuration = 30;

// ── DAILY CHALLENGE: 30 rotating topics seeded by IST date ─────────────────
const CHALLENGE_TOPICS = [
  "Describe a moment when you had to make a difficult decision. What did you choose and why?",
  "Talk about a technology that has changed your daily life the most.",
  "If you could have dinner with any historical figure, who would it be and what would you ask?",
  "Describe your dream job and why it would make you happy.",
  "Talk about a challenge you overcame and what you learned from it.",
  "What is the most important skill young people need in the 21st century?",
  "Describe a place you visited that left a strong impression on you.",
  "Should social media have age restrictions? Give your opinion.",
  "Talk about a book, film, or song that changed your perspective on life.",
  "Describe how you would spend a perfect weekend.",
  "What are the benefits and drawbacks of working from home?",
  "Talk about a goal you have for the next five years.",
  "Is it better to live in a big city or a small town? Justify your answer.",
  "Describe a skill you wish you had learned earlier in life.",
  "What does success mean to you personally?",
  "Talk about an invention that you think will change the world in the next decade.",
  "Describe a tradition or festival from your culture that you love.",
  "Should schools focus more on creativity or academic knowledge?",
  "Talk about a time when you helped someone. How did it feel?",
  "What is your opinion on the role of AI in education?",
  "Describe your morning routine and how it affects your day.",
  "Is social media doing more harm than good to society?",
  "Talk about someone who has inspired you and why.",
  "What would you do if you had unlimited money for one day?",
  "Describe the most memorable meal you have ever had.",
  "Should everyone learn to code? Give reasons for your answer.",
  "Talk about a news story that recently caught your attention.",
  "What habits do you think are essential for a healthy mind?",
  "Describe a time when you stepped out of your comfort zone.",
  "Talk about what kind of leader you think the world needs today.",
];

function getTodayChallenge() {
  const istDate = new Date(Date.now() + 5.5 * 3600000);
  const dayOfYear = Math.floor((istDate - new Date(istDate.getFullYear(), 0, 0)) / 86400000);
  return { topic: CHALLENGE_TOPICS[dayOfYear % CHALLENGE_TOPICS.length], date: istDate.toISOString().split('T')[0] };
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // ── CHALLENGE MODE: GET /api/daily?challenge=1 ─────────────────────────────
  if (req.query.challenge === '1') {
    if (!checkRateLimit(req, res, { maxRequests: 60, windowMs: 60_000 })) return;
    try {
      const { topic, date } = getTodayChallenge();
      const lbRes = await query(`
        SELECT u.name, u.username, u.avatar_bg, u.avatar_seed,
               MAX(ps.score) as best_score, MAX(ps.fluency) as best_fluency,
               MAX(ps.clarity) as best_clarity
        FROM practice_sessions ps JOIN users u ON ps.user_id = u.uid
        WHERE DATE(ps.date AT TIME ZONE 'Asia/Kolkata') = $1
          AND ps.mode = 'random' AND LOWER(ps.topic) = LOWER($2)
        GROUP BY u.name, u.username, u.avatar_bg, u.avatar_seed
        ORDER BY best_score DESC LIMIT 10
      `, [date, topic]);
      return res.status(200).json({ date, topic, leaderboard: lbRes.rows || [] });
    } catch (err) {
      return safeError(res, 500, err, '[daily-challenge]');
    }
  }

  // ── NORMAL DAILY TOPICS MODE ───────────────────────────────────────────────
  if (!checkRateLimit(req, res, { maxRequests: 5, windowMs: 60_000 })) return;
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=43200');

  const { date } = req.query;
  const today = date || new Date().toISOString().slice(0, 10);

  const AI_PROMPT = `You are a daily content generator for "Speak Up!" — a casual English speech practice app for everyday people.
Today: ${today}. Generate FRESH, unique content every time. Return ONLY valid JSON (no markdown, no code fences):

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
  "interview": {
    "behavioral":  [{"above":"label","main":"question","below":"follow-up tip"}, ...4 items],
    "technical":   [same x4],
    "sales":       [same x4],
    "hr":          [same x4],
    "management":  [same x4],
    "finance":     [same x4],
    "marketing":   [same x4]
  },
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

Per-category style for "random":
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

RULES FOR "interview" SECTION — CRITICAL:
- Each category must have exactly 6 fresh, realistic interview questions
- "above" = sub-topic label (e.g. "Leadership", "Pitching", "Valuation")
- "main" = the actual interview question (clear and professional)
- "below" = a practical follow-up or answering tip (1 sentence)
- Make questions specific and thought-provoking, not generic
- behavioral: STAR-method questions (teamwork, leadership, conflict, failure, adaptability)
- technical: software/engineering (system design, debugging, architecture, cloud, security)
- sales: pitching, objection handling, closing, prospecting, negotiation, pipeline
- hr: hiring, retention, conflict resolution, DEI, onboarding, compensation
- management: delegation, vision, decision-making, scaling, performance management
- finance: valuation, budgeting, financial analysis, risk, M&A, investment strategy
- marketing: GTM strategy, branding, SEO/paid ads, content, growth hacking, analytics

RULES FOR "vocab" SECTION:
- Mix of useful everyday words, idioms, power phrases, and business expressions
- "angle" = a personal speaking prompt using the word (1 sentence)
- Not overly academic — things people can actually use in conversation`;

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  const groqKeys = (process.env.GROQ_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);
  const GROQ_KEY = groqKeys[0];

  if (!GEMINI_KEY || !GROQ_KEY) {
    return res.status(500).json({ error: "Missing API keys in environment variables." });
  }

  // 1. Check DB cache — only serve if it has the new categorized interview format (v2)
  try {
    const cached = await query(
      `SELECT content FROM daily_content_cache WHERE date = $1 LIMIT 1`,
      [today]
    );
    if (cached.rows.length > 0) {
      const data = cached.rows[0].content;
      // Validate it has the new interview object format (not old flat array) and isn't the fallback
      if (data.interview && !Array.isArray(data.interview) && data.interview.behavioral && data.__source__ !== 'Hardcoded Fallback') {
        console.log(`[daily] Serving v2 from DB cache for ${today}`);
        data.__source__ = 'DB Cache';
        return res.status(200).json(data);
      }
      console.log(`[daily] DB cache has old format or is fallback — regenerating with new schema`);
    }
  } catch (dbCacheErr) {
    console.warn('[daily] DB cache read failed (table may not exist yet):', dbCacheErr.message);
  }
  // 2. Try Gemini Flash
  let generatedData = null;
  try {
    const geminiRes = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-goog-api-key': GEMINI_KEY },
        body: JSON.stringify({
          contents: [{ parts: [{ text: AI_PROMPT }] }],
          generationConfig: { temperature: 0.85, maxOutputTokens: 16384 }
        })
      }
    );

    if (geminiRes.ok) {
      const json = await geminiRes.json();
      let text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
      // Strip markdown fences if present
      const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fence) text = fence[1];
      text = text.trim();
      if (text) {
        generatedData = JSON.parse(text);
        generatedData.__source__ = 'Gemini Flash';
        console.log('[daily] Gemini Flash succeeded');
      } else {
        console.warn('[daily] Gemini returned empty text');
      }
    } else {
      const errText = await geminiRes.text();
      console.warn(`Gemini failed (${geminiRes.status}):`, errText.slice(0, 300));
    }
  } catch (e) {
    console.error('Gemini error:', e.message);
  }

  // 3. Try Groq Fallback — use llama-3.3-70b for better JSON quality on large payloads
  if (!generatedData) {
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
          temperature: 0.9,
          max_tokens: 16000
        })
      });

      if (groqRes.ok) {
        const json = await groqRes.json();
        generatedData = JSON.parse(json.choices[0].message.content);
        generatedData.__source__ = 'Groq (LLaMA 3.3 70B)';
      } else {
        const errText = await groqRes.text();
        console.warn(`Groq failed (${groqRes.status}):`, errText.slice(0, 200));
      }
    } catch (e) {
      console.error('Groq error:', e.message);
    }
  }

  if (!generatedData) {
    // All AI failed — return hardcoded fallback so the page still works
    console.error('[daily] All AI models failed — serving hardcoded fallback');
    generatedData = {
      __source__: 'Hardcoded Fallback',
      random: {
        general: [
          { above: 'Opinion', main: 'Is it better to be an early bird or a night owl?', below: 'Which do you prefer and why?', difficulty: 'easy' },
          { above: 'Life', main: 'What is one small habit that changed your life for the better?', below: 'How long did it take to build?', difficulty: 'easy' },
          { above: 'Choice', main: 'Would you rather have a job you love with low pay or a job you hate with high pay?', below: 'What does money mean to you?', difficulty: 'medium' },
          { above: 'Nostalgia', main: 'What is something from your childhood you wish still existed today?', below: 'Why do we miss things from the past?', difficulty: 'easy' },
        ],
        tech: [
          { above: 'Phones', main: 'Has your smartphone made your life better or more stressful?', below: 'Can you go a day without it?', difficulty: 'easy' },
          { above: 'Social Media', main: 'Which social media platform do you think is the most addictive and why?', below: 'Could you delete it for a month?', difficulty: 'easy' },
          { above: 'AI', main: 'Do you think AI will take over most jobs in the next 10 years?', below: 'Which jobs are safe?', difficulty: 'medium' },
          { above: 'Gaming', main: 'Are video games a waste of time or a legitimate hobby?', below: 'What makes something a worthy hobby?', difficulty: 'easy' },
        ],
        finance: [
          { above: 'Saving', main: 'What is the best way to save money as a young person today?', below: 'What stops most people from saving?', difficulty: 'easy' },
          { above: 'Spending', main: 'What is something you spent money on that turned out to be completely worth it?', below: 'How do you define value for money?', difficulty: 'easy' },
          { above: 'Shopping', main: 'Do you prefer online shopping or going to a store? Why?', below: 'What are the downsides of your preferred method?', difficulty: 'easy' },
          { above: 'Money Mindset', main: 'Is money the root of all evil or just a tool?', below: 'How should we teach kids about money?', difficulty: 'medium' },
        ],
        roast: [
          { above: 'Roast', main: 'Roast the concept of waking up at 5am for productivity.', below: 'Make it funny but make a point.', difficulty: 'medium' },
          { above: 'Roast', main: 'Roast people who post their gym selfies every single day.', below: 'Keep it light!', difficulty: 'easy' },
          { above: 'Roast', main: 'Roast the idea that pineapple does not belong on pizza.', below: 'Defend the pineapple!', difficulty: 'easy' },
          { above: 'Roast', main: 'Roast the modern obsession with being "busy" all the time.', below: 'What is the cost of busyness culture?', difficulty: 'medium' },
        ],
        pitch: [
          { above: 'Pitch', main: 'Pitch the idea that naps should be mandatory at every workplace.', below: 'Use data or logic to support your case.', difficulty: 'medium' },
          { above: 'Pitch', main: 'Convince me that Mondays should be completely banned.', below: 'What would happen to the week?', difficulty: 'easy' },
          { above: 'Pitch', main: 'Pitch a world where everyone works only 4 days a week.', below: 'What are the economic benefits?', difficulty: 'medium' },
          { above: 'Pitch', main: 'Convince me that learning to cook is more important than any degree.', below: 'Make the strongest case you can!', difficulty: 'easy' },
        ],
        defend: [
          { above: 'Defend', main: 'Defend the unpopular opinion that texting is better than calling.', below: 'Counter the best argument against you.', difficulty: 'easy' },
          { above: 'Defend', main: 'Defend the idea that mornings are overrated.', below: 'What does science say?', difficulty: 'easy' },
          { above: 'Defend', main: 'Defend watching TV as a productive activity.', below: 'What can we actually learn from TV?', difficulty: 'medium' },
          { above: 'Defend', main: 'Defend the opinion that fast food is not always a bad choice.', below: 'Make a reasonable case.', difficulty: 'easy' },
        ],
        eli5: [
          { above: 'ELI5', main: 'Explain how the internet works to a 5-year-old.', below: 'Use a simple analogy.', difficulty: 'medium' },
          { above: 'ELI5', main: 'Explain what inflation is as simply as possible.', below: 'Use an example from everyday life.', difficulty: 'medium' },
          { above: 'ELI5', main: 'Explain why the sky is blue to someone who has never heard of science.', below: 'Make it fun and clear.', difficulty: 'easy' },
          { above: 'ELI5', main: 'Explain what a password is to your grandparent who just got their first phone.', below: 'Keep it very simple!', difficulty: 'easy' },
        ],
        conspiracy: [
          { above: 'Conspiracy', main: 'What if alarm clocks were invented by coffee companies to boost sales?', below: 'Make a fun case for it!', difficulty: 'easy' },
          { above: 'Conspiracy', main: 'What if Mondays are a myth created by bosses to control workers?', below: 'Build your theory.', difficulty: 'easy' },
          { above: 'Conspiracy', main: 'What if rainy days were secretly designed by umbrella companies?', below: 'Follow the money!', difficulty: 'easy' },
          { above: 'Conspiracy', main: 'What if autocorrect errors are actually secret messages from our phones?', below: 'Decode the conspiracy!', difficulty: 'easy' },
        ],
        hottakes: [
          { above: 'Hot Take', main: 'Skipping breakfast is actually healthier than eating it.', below: 'Defend your hot take!', difficulty: 'medium' },
          { above: 'Hot Take', main: 'Group projects should be completely banned in schools.', below: 'Make your case.', difficulty: 'easy' },
          { above: 'Hot Take', main: 'Social media has done more good than harm to society overall.', below: 'What evidence supports this?', difficulty: 'hard' },
          { above: 'Hot Take', main: 'Homework is useless and should be abolished completely.', below: 'Be bold, be specific.', difficulty: 'easy' },
        ],
        millennial: [
          { above: 'Millennial', main: 'Talk about how different childhood was before smartphones existed.', below: 'What did you do for fun?', difficulty: 'easy' },
          { above: 'Millennial', main: 'Describe the adulting struggle that nobody warned you about.', below: 'Taxes? Cooking? Bills?', difficulty: 'easy' },
          { above: 'Millennial', main: 'What is one thing millennials do better than any other generation?', below: 'Be proud of your generation!', difficulty: 'medium' },
          { above: 'Millennial', main: 'Talk about a trend from the 2000s that you secretly miss.', below: 'Flip phones? MSN Messenger?', difficulty: 'easy' },
        ],
        genz: [
          { above: 'Gen Z', main: 'Explain a Gen Z slang term to someone who has no idea what it means.', below: 'Make it funny and educational.', difficulty: 'easy' },
          { above: 'Gen Z', main: 'Is TikTok actually educational or just a time-waster?', below: 'Give real examples.', difficulty: 'easy' },
          { above: 'Gen Z', main: 'Talk about the pressure of building a personal brand as a young person today.', below: 'Is it worth it?', difficulty: 'medium' },
          { above: 'Gen Z', main: 'What is the most overrated trend of the last two years?', below: 'Be specific and bold.', difficulty: 'easy' },
        ],
      },
      interview: {
        behavioral: [
          { above: 'Leadership', main: 'Tell me about a time you led a team through a difficult situation.', below: 'Use the STAR method: Situation, Task, Action, Result.' },
          { above: 'Conflict', main: 'Describe a disagreement with a colleague and how you resolved it.', below: 'Focus on what you learned from the experience.' },
          { above: 'Failure', main: 'Tell me about your biggest professional mistake and what you learned.', below: 'Show growth, not blame.' },
          { above: 'Initiative', main: 'Give an example of when you went above and beyond your job description.', below: 'Quantify the impact if possible.' },
        ],
        technical: [
          { above: 'System Design', main: 'How would you design a scalable notification service for 10 million users?', below: 'Consider queues, databases, and delivery guarantees.' },
          { above: 'Debugging', main: 'Walk me through how you debug a production issue at 2am.', below: 'Show your systematic process.' },
          { above: 'Architecture', main: 'When would you choose a NoSQL database over a relational one?', below: 'Give real use-case examples.' },
          { above: 'Code Quality', main: 'How do you ensure your code remains maintainable as the team grows?', below: 'Talk about reviews, documentation, and standards.' },
        ],
        sales: [
          { above: 'Pitching', main: 'Pitch our product to me as if I am a skeptical VP of Finance.', below: 'Lead with ROI and risk reduction.' },
          { above: 'Objection', main: "A prospect says 'We're happy with our current vendor.' How do you respond?", below: 'Acknowledge, explore, differentiate.' },
          { above: 'Closing', main: 'What is your favourite closing technique and when do you use it?', below: 'Be specific about the scenario.' },
          { above: 'Pipeline', main: 'How do you prioritize which leads to focus on each week?', below: 'Talk about scoring, intent signals, or ICP fit.' },
        ],
        hr: [
          { above: 'Hiring', main: 'Walk me through how you conduct a first-round interview for a senior role.', below: 'What are the must-have signals you look for?' },
          { above: 'Retention', main: 'A top performer says they are leaving. What do you do?', below: 'Show empathy before counter-offering.' },
          { above: 'Culture', main: 'How do you build psychological safety in a team?', below: 'Give specific actions, not just principles.' },
          { above: 'Performance', main: 'How do you handle a performance review with someone who disagrees with their rating?', below: 'Focus on facts and future goals.' },
        ],
        management: [
          { above: 'Delegation', main: 'How do you decide what to delegate versus what to keep yourself?', below: 'Talk about trust, urgency, and development goals.' },
          { above: 'Vision', main: 'How do you get a skeptical team excited about a new strategic direction?', below: 'Show how you involve people early.' },
          { above: 'Scaling', main: 'What processes break first when a startup scales from 20 to 200 people?', below: 'Be specific about what you have seen break.' },
          { above: 'Feedback', main: 'How do you create a culture where people give you honest upward feedback?', below: 'Show what you do with feedback when you receive it.' },
        ],
        finance: [
          { above: 'Valuation', main: 'Walk me through a DCF model and the assumptions you scrutinize most.', below: 'Focus on WACC, terminal value, and growth rates.' },
          { above: 'Analysis', main: 'A company has revenue growth but declining free cash flow. What does this signal?', below: 'Think about working capital and capex.' },
          { above: 'Budgeting', main: 'How do you build an annual budget that actually gets followed?', below: 'Talk about buy-in, assumptions, and variance tracking.' },
          { above: 'Risk', main: 'How do you present financial risk to a board that is not finance-savvy?', below: 'Simplify without losing accuracy.' },
        ],
        marketing: [
          { above: 'GTM', main: 'How would you build a go-to-market strategy for a new SaaS product from scratch?', below: 'Start with ICP, then channel, then message.' },
          { above: 'SEO', main: 'Our organic traffic dropped 30% after a Google update. Walk me through your response.', below: 'Talk about audit, content gap, and link profile.' },
          { above: 'Growth', main: 'What is the most creative growth experiment you have ever run?', below: 'Share the hypothesis, test, and result.' },
          { above: 'Brand', main: 'How do you maintain brand consistency across 10 different marketing channels?', below: 'Talk about guidelines, tools, and governance.' },
        ],
      },
      vocab: [
        { word: 'Tenacious', pos: 'adjective', meaning: 'Not giving up despite difficulty.', example: 'Her tenacious approach to learning English paid off in months.', angle: 'Describe a time you were tenacious about something.' },
        { word: 'Empathy', pos: 'noun', meaning: 'Understanding and sharing the feelings of others.', example: 'Empathy made him a trusted leader in every team he joined.', angle: 'Talk about a time when empathy changed a situation for you.' },
        { word: 'Serendipity', pos: 'noun', meaning: 'A happy and unexpected discovery by chance.', example: 'It was pure serendipity that led me to my dream career.', angle: 'Share a moment of serendipity that shaped your life.' },
        { word: 'Candid', pos: 'adjective', meaning: 'Honest and straightforward, even if uncomfortable.', example: 'His candid feedback was hard to hear but helped me grow.', angle: 'Describe a time being candid was the right but difficult choice.' },
        { word: 'Resilience', pos: 'noun', meaning: 'The ability to recover quickly from setbacks.', example: 'Resilience helped her rebuild after the startup failed.', angle: 'How have you built resilience in your own life?' },
        { word: 'Paradigm shift', pos: 'noun phrase', meaning: 'A fundamental change in how we think about something.', example: 'Remote work caused a paradigm shift in office culture globally.', angle: 'Describe a paradigm shift you personally experienced.' },
        { word: 'Eloquent', pos: 'adjective', meaning: 'Fluent, persuasive, and expressive in speech or writing.', example: 'Her eloquent speech moved the entire audience to tears.', angle: 'Talk about someone you find eloquent and what you admire about them.' },
        { word: 'Proactive', pos: 'adjective', meaning: 'Acting before problems arise rather than reacting to them.', example: 'Being proactive about deadlines saved the project twice.', angle: 'Give an example of when being proactive made a real difference.' },
        { word: 'Leverage', pos: 'verb', meaning: 'To use something to its maximum advantage.', example: 'She learned to leverage her network to find the right opportunities.', angle: 'How do you leverage your strongest skill in daily life?' },
        { word: 'Nuance', pos: 'noun', meaning: 'A subtle difference in meaning, expression, or feeling.', example: 'Understanding cultural nuance is essential for global communication.', angle: 'Describe a situation where missing a nuance caused a misunderstanding.' },
      ]
    };
  }

  // 4. Save to DB cache — future requests and cold-starts skip the AI call entirely
  try {
    await query(
      `INSERT INTO daily_content_cache (date, content) VALUES ($1, $2)
       ON CONFLICT (date) DO UPDATE SET content = EXCLUDED.content`,
      [today, generatedData]
    );
    console.log(`[daily] Saved to DB cache for ${today}`);
  } catch (dbSaveErr) {
    // Non-fatal: serve the data even if caching fails
    console.warn('[daily] DB cache write failed:', dbSaveErr.message);
  }

  return res.status(200).json(generatedData);
}

