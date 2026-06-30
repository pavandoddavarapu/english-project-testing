/**
 * /api/daily-challenge.js
 *
 * Returns today's daily challenge topic — same for ALL users.
 * Topic is seeded by today's date so it never changes mid-day.
 * Also returns the top 10 leaderboard for today's challenge.
 */

import { query } from '../shared/db.js';
import { setCorsHeaders, checkRateLimit, safeError } from '../shared/middleware.js';

export const config = { api: { bodyParser: false } };
export const maxDuration = 10;

// 30 rotating challenge topics — deterministic by day-of-year
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

function getTodayTopic() {
  const now = new Date();
  // Use IST (UTC+5:30) for consistent Indian timezone
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);
  const dayOfYear = Math.floor((istDate - new Date(istDate.getFullYear(), 0, 0)) / 86400000);
  const idx = dayOfYear % CHALLENGE_TOPICS.length;
  return {
    topic: CHALLENGE_TOPICS[idx],
    date: istDate.toISOString().split('T')[0],
    topicIndex: idx,
  };
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!checkRateLimit(req, res, { maxRequests: 60, windowMs: 60_000 })) return;

  try {
    const { topic, date, topicIndex } = getTodayTopic();

    // Fetch today's top 10 from practice_sessions
    const leaderboardRes = await query(`
      SELECT u.name, u.username, u.avatar_bg, u.avatar_seed,
             MAX(ps.score) as best_score,
             MAX(ps.fluency) as best_fluency,
             MAX(ps.clarity) as best_clarity,
             MAX(ps.confidence) as best_confidence
      FROM practice_sessions ps
      JOIN users u ON ps.user_id = u.uid
      WHERE DATE(ps.date AT TIME ZONE 'Asia/Kolkata') = $1
        AND ps.mode = 'random'
        AND LOWER(ps.topic) = LOWER($2)
      GROUP BY u.name, u.username, u.avatar_bg, u.avatar_seed
      ORDER BY best_score DESC
      LIMIT 10
    `, [date, topic]);

    return res.status(200).json({
      date,
      topic,
      topicIndex,
      leaderboard: leaderboardRes.rows || [],
    });

  } catch (err) {
    return safeError(res, 500, err, '[daily-challenge]');
  }
}
