/* =============================================
   app.js – Speak Up! English Practice App
   ============================================= */

// ─── DATA ───────────────────────────────────────

const RANDOM_TOPICS = [
  { above: "Gratitude", main: "Defend that contradiction is a sign of wisdom, not weakness.", below: "The snooze button does more harm than good." },
  { above: "Leadership", main: "Should everyone learn to code? Make your case.", below: "Failure is a better teacher than success." },
  { above: "Technology", main: "Social media has done more harm than good to society.", below: "Reading fiction is as valuable as reading non-fiction." },
  { above: "Creativity", main: "Creativity is a skill, not a talent — anyone can develop it.", below: "Working from home is more productive than working in an office." },
  { above: "Health", main: "Sleep is the most underrated productivity tool.", below: "Morning routines are overrated." },
  { above: "Communication", main: "Listening is a skill more valuable than speaking.", below: "Silence can communicate more than words." },
  { above: "Growth", main: "Comfort zones are the enemy of growth.", below: "Mistakes are the best form of learning." },
  { above: "Relationships", main: "Trust is built in small moments, not grand gestures.", below: "Honesty is always the best policy." },
  { above: "Environment", main: "Individual actions matter more than government policy in fighting climate change.", below: "Technology will solve our environmental problems." },
  { above: "Education", main: "Curiosity is more important than intelligence in achieving success.", below: "Traditional education is no longer relevant." },
  { above: "Money", main: "Financial literacy should be taught in every school.", below: "Money cannot buy happiness — but it can buy options." },
  { above: "Mindset", main: "Optimism is a superpower that anyone can cultivate.", below: "Routine is the enemy of creativity." },
];

const INTERVIEW_BANK = {
  behavioral: [
    { above: "Behavioral", main: "Tell me about a time you successfully managed a project from start to finish.", below: "Why do you want to work here?" },
    { above: "Leadership", main: "Describe a situation where you had to lead without authority.", below: "How do you handle disagreement with a teammate?" },
    { above: "Problem-Solving", main: "Walk me through a difficult problem you solved at work.", below: "What's your approach to handling tight deadlines?" },
    { above: "Teamwork", main: "Tell me about a time you had to collaborate with someone very different from you.", below: "How do you build trust within a team?" },
    { above: "Adaptability", main: "Describe a time when you had to quickly adapt to major change.", below: "How do you stay motivated during challenging projects?" },
    { above: "Communication", main: "Tell me about a time you had to explain a complex topic to a non-expert.", below: "How do you give constructive feedback?" },
    { above: "Initiative", main: "Give an example of when you went above and beyond your job description.", below: "What's a project you started on your own initiative?" },
    { above: "Conflict", main: "Tell me about a time you handled a conflict with a difficult client or colleague.", below: "How do you manage stress in high-pressure situations?" },
    { above: "Failure", main: "Tell me about your biggest professional failure and what you learned from it.", below: "How do you bounce back after making a mistake?" },
    { above: "Self-Awareness", main: "What is your greatest weakness and how are you actively working on it?", below: "How do you respond to criticism?" },
  ],
  technical: [
    { above: "System Design", main: "How would you design a URL shortener like bit.ly from scratch?", below: "What trade-offs did you consider?" },
    { above: "Problem-Solving", main: "Explain the difference between REST and GraphQL APIs and when you'd choose each.", below: "What is your experience with microservices?" },
    { above: "Debugging", main: "Walk me through how you would debug a production system that is running slowly.", below: "What monitoring tools do you use?" },
    { above: "Architecture", main: "How do you ensure scalability when designing a database schema?", below: "Explain the CAP theorem in simple terms." },
    { above: "Code Quality", main: "What does clean code mean to you and how do you enforce it in a team?", below: "What is your approach to code reviews?" },
    { above: "Security", main: "What are the top 3 security vulnerabilities every developer must know, and how do you prevent them?", below: "How have you handled sensitive user data in past projects?" },
    { above: "DevOps", main: "Explain CI/CD pipelines and how you have set one up previously.", below: "What's your experience with Docker and Kubernetes?" },
    { above: "Data Structures", main: "When would you choose a hash map over a binary tree and why?", below: "Describe a time your choice of data structure improved performance." },
    { above: "Machine Learning", main: "Explain how you would approach building a recommendation system.", below: "How do you handle class imbalance in a dataset?" },
    { above: "Cloud", main: "Compare AWS, GCP, and Azure — which would you pick for a new startup and why?", below: "What cloud services have you used in production?" },
  ],
  sales: [
    { above: "Pitching", main: "Pitch our product to me as if I am a skeptical CFO with a tight budget.", below: "How do you tailor your pitch to different stakeholders?" },
    { above: "Objection Handling", main: "A prospect says 'Your price is too high.' Walk me through your exact response.", below: "What is the most common objection you face and how do you overcome it?" },
    { above: "Discovery", main: "How do you uncover a prospect's real pain points when they are guarded?", below: "What questions do you always ask in a first discovery call?" },
    { above: "Closing", main: "Describe your go-to closing technique and why it works for you.", below: "How do you handle a prospect who keeps postponing the decision?" },
    { above: "Prospecting", main: "How do you build a cold outreach sequence that actually gets replies?", below: "What's your best tip for writing a cold email subject line?" },
    { above: "Relationship", main: "Tell me about a deal that took over 6 months to close and how you kept the momentum going.", below: "How do you maintain relationships with existing clients?" },
    { above: "Metrics", main: "What sales KPIs do you track daily and why are they important?", below: "How do you analyze a lost deal to improve future performance?" },
    { above: "Negotiation", main: "Describe a negotiation where you had to give a discount while protecting margin.", below: "What's your approach when a prospect plays you against a competitor?" },
  ],
  hr: [
    { above: "Culture Fit", main: "How do you assess whether a candidate is the right cultural fit for a company?", below: "Describe the ideal team culture you work best in." },
    { above: "Compensation", main: "A candidate's salary expectation is 30% above your budget. How do you handle this?", below: "How do you explain a compensation package beyond just salary?" },
    { above: "Conflict", main: "Two senior employees are in a prolonged conflict affecting the team. Walk me through your resolution process.", below: "When is it necessary to escalate a workplace conflict to leadership?" },
    { above: "Retention", main: "A high performer walks into your office and says they are leaving. What do you do?", below: "What initiatives have you implemented to improve employee retention?" },
    { above: "Policy", main: "How do you communicate an unpopular company policy change to employees?", below: "Describe a time you had to enforce a policy that you personally disagreed with." },
    { above: "Performance", main: "Walk me through how you run a performance review conversation with an underperformer.", below: "How do you set OKRs or KPIs that actually motivate people?" },
    { above: "Diversity", main: "What concrete steps have you taken to make your hiring process more inclusive?", below: "How do you measure the effectiveness of DEI initiatives?" },
    { above: "Onboarding", main: "Describe the ideal onboarding experience for a new senior hire.", below: "How do you ensure new employees feel welcomed and productive from day one?" },
  ],
  management: [
    { above: "Vision", main: "How do you set a team vision that gets everyone genuinely excited and aligned?", below: "How do you communicate strategy downward to individual contributors?" },
    { above: "Delegation", main: "Describe how you decide what to delegate and what to keep.", below: "Tell me about a time delegation went wrong and what you learned." },
    { above: "Performance", main: "How do you handle a previously high-performing employee who is suddenly underperforming?", below: "What does a good performance improvement plan look like?" },
    { above: "Decision Making", main: "Walk me through a difficult business decision you made with incomplete information.", below: "How do you balance data-driven decisions with gut instinct?" },
    { above: "Hiring", main: "What is your hiring process for a critical senior role on your team?", below: "What's the biggest hiring mistake you've made and what did you learn?" },
    { above: "Cross-Functional", main: "How do you align multiple teams with competing priorities toward a shared goal?", below: "Describe a time you had to influence without authority across departments." },
    { above: "Scaling", main: "How do you maintain company culture as a team rapidly scales from 10 to 100 people?", below: "What processes break first during hyper-growth and how do you fix them?" },
    { above: "Feedback", main: "How do you create a culture of candid, upward feedback in your team?", below: "Tell me about a time you received difficult feedback from a direct report." },
  ],
  finance: [
    { above: "Valuation", main: "Walk me through a DCF valuation — what are the key assumptions you scrutinize most?", below: "What are the biggest risks in any valuation model?" },
    { above: "Financial Analysis", main: "A company has strong revenue growth but declining free cash flow. What does this tell you?", below: "Which financial ratio do you find most insightful and why?" },
    { above: "Budgeting", main: "Describe how you approach the annual budgeting process at a mid-size company.", below: "How do you handle budget overruns mid-year?" },
    { above: "Risk", main: "How do you assess and communicate financial risk to a non-finance audience?", below: "Describe a time you identified a financial risk that others had missed." },
    { above: "M&A", main: "Walk me through the key steps of evaluating a potential acquisition target.", below: "What are the most common reasons M&A deals fail post-close?" },
    { above: "Investment", main: "A client has 50 lakh to invest with a 10-year horizon. How would you approach their portfolio?", below: "How do you stay calm and advise clients during a market downturn?" },
    { above: "Reporting", main: "How do you make monthly financial reports truly actionable for business leaders?", below: "What's the most important metric you track on a P&L and why?" },
    { above: "Cost Reduction", main: "You are asked to find 20% cost savings without impacting core operations. How do you start?", below: "How do you ensure cost cuts don't damage company morale or quality?" },
  ],
  marketing: [
    { above: "Strategy", main: "How would you develop a go-to-market strategy for a brand new B2B SaaS product?", below: "What's the first thing you do when you join a company as a marketing lead?" },
    { above: "Branding", main: "How do you build a consistent brand voice across multiple channels and teams?", below: "Tell me about a brand repositioning you led or witnessed — what made it work?" },
    { above: "Digital", main: "Our organic traffic dropped 40% after a Google algorithm update. Walk me through your recovery plan.", below: "What SEO strategies are you most confident in for 2025?" },
    { above: "Campaigns", main: "Walk me through a marketing campaign you ran end-to-end — strategy to results.", below: "How do you measure the ROI of a brand awareness campaign?" },
    { above: "Content", main: "How do you build a content strategy that generates leads, not just traffic?", below: "What content formats drive the highest engagement in your experience?" },
    { above: "Growth", main: "Describe the most creative growth hack you have executed and what you learned.", below: "How do you identify the highest-leverage marketing channel for a new product?" },
    { above: "Audience", main: "How do you research and define your ideal customer profile?", below: "Describe how you use customer personas in day-to-day marketing decisions." },
    { above: "Paid Ads", main: "Our paid ad ROAS dropped from 4x to 1.5x. How do you diagnose and fix this?", below: "What is your budget allocation philosophy across paid channels?" },
  ],
};

// Flat behavioral array for backward compat with any legacy references
const INTERVIEW_TOPICS = INTERVIEW_BANK.behavioral;

const VOCAB_WORDS = [
  { word: "Pie in the sky", pos: "idiom", meaning: "An unrealistic promise of future reward.", example: "Their compensation package is all pie in the sky — no actual guarantees.", angle: "Share a pie-in-the-sky promise you once believed and how you spotted them faster now." },
  { word: "Wanderlust", pos: "noun", meaning: "A strong desire to travel and explore the world.", example: "Her wanderlust drove her to visit 40 countries before turning 30.", angle: "Describe a place that ignited your wanderlust and why travel changes us." },
  { word: "Ephemeral", pos: "adjective", meaning: "Lasting for a very short time; transitory.", example: "The beauty of cherry blossoms is ephemeral, which makes it more precious.", angle: "Talk about something ephemeral in your life that you wish had lasted longer." },
  { word: "Tenacious", pos: "adjective", meaning: "Not giving up; holding firmly to a goal despite difficulty.", example: "She was tenacious in her pursuit of the promotion, never missing a deadline.", angle: "Describe a time you were tenacious and what it achieved for you." },
  { word: "Serendipity", pos: "noun", meaning: "Happy and unexpected luck or discovery.", example: "It was pure serendipity that I met my business partner at a coffee shop.", angle: "Share a moment of serendipity that changed your path." },
  { word: "Resilience", pos: "noun", meaning: "The ability to recover quickly from difficult conditions.", example: "Resilience helped her rebuild after the startup failed.", angle: "Describe how you have built resilience in your own life." },
  { word: "Empathy", pos: "noun", meaning: "The ability to understand and share the feelings of others.", example: "Empathy made him a better leader — his team trusted him completely.", angle: "Talk about a time when showing empathy made a big difference." },
  { word: "Paradigm shift", pos: "noun", meaning: "A fundamental change in approach or underlying assumptions.", example: "Remote work caused a paradigm shift in how companies think about productivity.", angle: "Describe a paradigm shift you experienced and how it changed your thinking." },
  { word: "Eloquent", pos: "adjective", meaning: "Fluent or persuasive in speaking or writing.", example: "Her eloquent speech moved the audience to tears.", angle: "Talk about someone you find eloquent and what makes them compelling." },
  { word: "Candid", pos: "adjective", meaning: "Truthful and straightforward; frank.", example: "His candid feedback helped me improve more than any flattery could.", angle: "Describe a time when being candid was difficult but necessary." },
];

// ─── STATE ───────────────────────────────────────

let currentTab = "random";
let topicIndex = 0;
let vocabIndex = 0;
let interviewIndex = 0;
let timerInterval = null;
let timerSeconds = 60;
let isRecording = false;
let mediaRecorder = null;
let confettiAnimId = null;
let confettiParticles = [];
const _isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  || (window.innerWidth <= 768);

// ── TRANSCRIPTION: Always server-side via Groq Whisper ───────────────────────
// Groq Whisper transcribes what was ACTUALLY said — including mispronunciations
// and grammar errors — which is critical for accurate speech scoring.
// (Web Speech API auto-corrects, which would inflate scores unfairly.)

// Dummy stubs retained for any legacy badge references
const whisperWorker = null;
const whisperReady  = false;

// ── UI helper: update the status badge in the modal ──────────────────────────
function updateWhisperBadge(state) {
  const badge = document.getElementById('whisper-badge');
  if (!badge) return;
  badge.textContent = '';
  badge.style.display = 'none';
}

// ─── AI CONFIG & FILTER STATE ───────────────────────────
// Keys are now securely stored in Vercel Environment Variables
const TODAY = new Date().toISOString().slice(0, 10);
const CACHE_KEY = `speakup-daily-v2-${TODAY}`; // v2: interview now categorized

let DAILY_DATA = null;      // set by initDailyData()
let selectedCategory = 'random';
let selectedDifficulty = 'random';
let selectedInterviewCategory = 'behavioral';

// ─── AUDIO (Web Audio API) ──────────────────────────────
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTick() {
  try {
    const ac = getAudioCtx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600 + Math.random() * 500, ac.currentTime);
    gain.gain.setValueAtTime(0.12, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.07);
    osc.start(); osc.stop(ac.currentTime + 0.07);
  } catch (e) { }
}

function playWhoosh() {
  try {
    const ac = getAudioCtx();
    const dur = 0.35;
    const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const filter = ac.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, ac.currentTime);
    filter.frequency.exponentialRampToValueAtTime(300, ac.currentTime + dur);
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.25, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    src.connect(filter); filter.connect(gain); gain.connect(ac.destination);
    src.start();
  } catch (e) { }
}

function playDing() {
  try {
    const ac = getAudioCtx();
    const notes = [1047, 1319, 1568]; // C6, E6, G6
    notes.forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = ac.currentTime + i * 0.08;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.2, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      osc.start(t); osc.stop(t + 0.7);
    });
  } catch (e) { }
}

async function fetchAIData() {
  const res = await fetch(`/api/daily?date=${TODAY}`);
  if (!res.ok) {
    throw new Error(`Backend failed with status ${res.status}`);
  }
  const data = await res.json();
  console.log(`📡 Fetched fresh data from: ${data.__source__ || 'Unknown API'}`);
  return data;
}

async function initDailyData() {
  const urlParams = new URLSearchParams(window.location.search);
  const isDaily = urlParams.get('daily') === '1';

  topicAbove.textContent = '🤖 AI';
  topicMain.textContent = 'Loading today\'s fresh content…';
  topicBelow.textContent = 'Powered by AI · updates every day';
  spinBtn.disabled = true;

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      DAILY_DATA = JSON.parse(cached);
      console.log(`✅ Loaded from Local Cache. Source was: ${DAILY_DATA.__source__}`);
    } else {
      DAILY_DATA = await fetchAIData();
      localStorage.setItem(CACHE_KEY, JSON.stringify(DAILY_DATA));
      Object.keys(localStorage)
        .filter(k => k.startsWith('speakup-daily-') && k !== CACHE_KEY)
        .forEach(k => localStorage.removeItem(k));
    }

    if (isDaily) {
      let challengeTopic = sessionStorage.getItem('speakup_daily_topic');
      if (!challengeTopic) {
        // Fallback: fetch directly from daily challenge endpoint
        const challengeRes = await fetch('/api/daily?challenge=1');
        const challengeJson = await challengeRes.json();
        challengeTopic = challengeJson.topic;
      }
      if (challengeTopic) {
        showTopic({
          above: '🏆 Daily Challenge',
          main: challengeTopic,
          below: 'Speak for 30-60s to submit your score to today\'s global leaderboard!'
        });
        spinBtn.disabled = true;
        spinBtn.title = "Spin is disabled during the Daily Challenge";
        spinBtn.style.opacity = '0.5';
        spinBtn.style.cursor = 'not-allowed';
        return;
      }
    }

    const pool = getRandomPool();
    showTopic(pool[Math.floor(Math.random() * pool.length)]);
  } catch (err) {
    console.error('AI failed — using built-in fallback:', err);
    DAILY_DATA = null;
    if (isDaily && sessionStorage.getItem('speakup_daily_topic')) {
      showTopic({
        above: '🏆 Daily Challenge',
        main: sessionStorage.getItem('speakup_daily_topic'),
        below: 'Speak for 30-60s to submit your score to today\'s global leaderboard!'
      });
    } else {
      showTopic(RANDOM_TOPICS[0]);
    }
  } finally {
    if (!isDaily) {
      spinBtn.disabled = false;
    }
  }
}

// Manual refresh: clears today's cache and re-fetches
window.refreshAIData = async function () {
  localStorage.removeItem(CACHE_KEY);
  DAILY_DATA = null;
  await initDailyData();
};

// ─── DATA POOL HELPERS ────────────────────────────────────────

function getRandomPool() {
  if (!DAILY_DATA) return RANDOM_TOPICS;
  let pool = selectedCategory === 'random'
    ? Object.values(DAILY_DATA.random).flat()
    : (DAILY_DATA.random[selectedCategory] || Object.values(DAILY_DATA.random).flat());
  if (selectedDifficulty !== 'random') {
    const f = pool.filter(t => t.difficulty === selectedDifficulty);
    if (f.length) pool = f;
  }
  return pool.length ? pool : RANDOM_TOPICS;
}

function getInterviewPool() {
  const cat = selectedInterviewCategory || 'behavioral';
  // Prefer AI-generated daily data; fall back to hardcoded bank
  if (DAILY_DATA && DAILY_DATA.interview && Array.isArray(DAILY_DATA.interview[cat]) && DAILY_DATA.interview[cat].length) {
    return DAILY_DATA.interview[cat];
  }
  return INTERVIEW_BANK[cat] || INTERVIEW_BANK.behavioral;
}

function getVocabPool() {
  return (DAILY_DATA && DAILY_DATA.vocab && DAILY_DATA.vocab.length)
    ? DAILY_DATA.vocab : VOCAB_WORDS;
}

// ─── DOM REFS ────────────────────────────────────

const tabBtns = document.querySelectorAll(".nav-tab");
const panels = {
  random   : document.getElementById("panel-random"),
  interview: document.getElementById("panel-interview"),
  vocab    : document.getElementById("panel-vocab"),
  picture  : document.getElementById("panel-picture"),
};
const filterSets = {
  random   : document.getElementById("filters-random"),
  interview: document.getElementById("filters-interview"),
  vocab    : document.getElementById("filters-vocab"),
  picture  : document.getElementById("filters-picture"),
};

// Picture-tab specific elements
const pictureDisplayArea = document.getElementById("picture-display-area");
const topicAreaWords     = document.getElementById("topic-area-words");
const timerPictureThumb  = document.getElementById("timer-picture-thumb");
const timerThumbImg      = document.getElementById("timer-thumb-img");
const timerTopicLabel    = document.getElementById("timer-topic-label");
const topicAbove = document.getElementById("topic-above");
const topicMain = document.getElementById("topic-main");
const topicBelow = document.getElementById("topic-below");
const spinBtn = document.getElementById("spin-btn");
const timerBtn = document.getElementById("timer-btn");
const modalOverlay = document.getElementById("modal-overlay");
const modalClose = document.getElementById("modal-close");
const recordBtn = document.getElementById("record-btn");
const recordStatus = document.getElementById("record-status");
const analysisResults = document.getElementById("analysis-results");
const confettiCanvas = document.getElementById("confetti-canvas");
const ctx = confettiCanvas.getContext("2d");

// ─── FULL-SCREEN TIMER DOM REFS ──────────────────
const timerScreen = document.getElementById("timer-screen");
const timerBackBtn = document.getElementById("timer-back-btn");
const timerTopicText = document.getElementById("timer-topic-text");
const circleCountdown = document.getElementById("circle-countdown");
const progressRingFill = document.getElementById("progress-ring-fill");
const btnPlayPause = document.getElementById("btn-play-pause");
const btnResetCircle = document.getElementById("btn-reset-circle");
const btnMinus = document.getElementById("btn-minus");
const btnPlus = document.getElementById("btn-plus");
const timerSpeechBtn = document.getElementById("timer-speech-btn");

// ─── TAB SWITCHING ────────────────────────────────

tabBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    if (tab === 'group') return;
    switchTab(tab);
  });
});

function switchTab(tab) {
  currentTab = tab;

  // Clean URL parameters when switching tabs to exit Daily Challenge mode
  try {
    if (window.history.replaceState) {
      const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
      window.history.replaceState({ path: newUrl }, '', newUrl);
    }
  } catch (historyErr) {
    console.warn('[History] Could not clean URL parameters:', historyErr);
  }

  // Restore spin button state (in case it was disabled by Daily Challenge)
  if (spinBtn) {
    spinBtn.disabled = false;
    spinBtn.title = "";
    spinBtn.style.opacity = '1';
    spinBtn.style.cursor = 'pointer';
  }

  // Update nav
  tabBtns.forEach(b => b.classList.toggle("active", b.dataset.tab === tab));

  // Show/hide left panels
  Object.entries(panels).forEach(([key, el]) => el.classList.toggle("hidden", key !== tab));
  // Show/hide filter rows
  Object.entries(filterSets).forEach(([key, el]) => el.classList.toggle("hidden", key !== tab));

  // Show picture display OR word topic area
  const isPicture = tab === 'picture';
  if (pictureDisplayArea) pictureDisplayArea.classList.toggle('hidden', !isPicture);
  if (topicAreaWords)     topicAreaWords.classList.toggle('hidden', isPicture);

  // Update content for the new tab
  if (tab === "random")    { const p = getRandomPool();    showTopic(p[Math.floor(Math.random() * p.length)]); }
  if (tab === "interview") { const p = getInterviewPool(); showTopic(p[Math.floor(Math.random() * p.length)]); }
  if (tab === "vocab")     { const p = getVocabPool();     showVocabTopic(p[Math.floor(Math.random() * p.length)]); }
  if (tab === "picture")   { initPictureTalk(); }
}

// ─── DROPDOWNS (FILTERS) ─────────────────────────

function setupDropdown(containerId, toggleId, menuId, labelId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const toggle = document.getElementById(toggleId);
  const menu = document.getElementById(menuId);
  const label = document.getElementById(labelId);
  const options = menu.querySelectorAll(".filter-option");

  // Toggle open/close
  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = !menu.classList.contains("hidden");

    // Close all other dropdowns first
    document.querySelectorAll(".filter-dropdown-menu").forEach(m => m.classList.add("hidden"));
    document.querySelectorAll(".dropdown-toggle").forEach(t => t.classList.remove("open"));

    if (!isOpen) {
      menu.classList.remove("hidden");
      toggle.classList.add("open");
    }
  });

  // Select option
  options.forEach(opt => {
    opt.addEventListener("click", (e) => {
      e.stopPropagation();
      // Reset active state
      options.forEach(o => {
        o.classList.remove("active");
        o.querySelector(".check").classList.add("hidden");
      });
      // Set new active state
      opt.classList.add("active");
      opt.querySelector(".check").classList.remove("hidden");
      // Update label (take text without the checkmark)
      label.innerHTML = opt.innerHTML.split('<span')[0].trim();

      // Close menu
      menu.classList.add("hidden");
      toggle.classList.remove("open");

      // Trigger a spin when filter changes to show new random content
      if (currentTab === "random") {
        spinBtn.click();
      }
    });
  });
}

setupDropdown("category-dropdown-container", "category-toggle", "category-menu", "category-label");
setupDropdown("difficulty-dropdown-container", "difficulty-toggle", "difficulty-menu", "difficulty-label");
setupDropdown("interview-category-dropdown-container", "interview-category-toggle", "interview-category-menu", "interview-category-label");

// Track selected filter values for AI pool filtering
document.querySelectorAll('#category-menu .filter-option').forEach(opt => {
  opt.addEventListener('click', () => { selectedCategory = opt.dataset.value; });
});
document.querySelectorAll('#difficulty-menu .filter-option').forEach(opt => {
  opt.addEventListener('click', () => { selectedDifficulty = opt.dataset.value; });
});
// Track interview category selection and immediately respin question
document.querySelectorAll('#interview-category-menu .filter-option').forEach(opt => {
  opt.addEventListener('click', () => {
    selectedInterviewCategory = opt.dataset.value;
    if (currentTab === 'interview') {
      const pool = getInterviewPool();
      showTopic(pool[Math.floor(Math.random() * pool.length)]);
    }
  });
});

// Close dropdowns when clicking outside
document.addEventListener("click", (e) => {
  if (!e.target.closest(".filter-dropdown-container") && !e.target.closest("#theme-switcher")) {
    document.querySelectorAll(".filter-dropdown-menu").forEach(m => m.classList.add("hidden"));
    document.querySelectorAll(".dropdown-toggle").forEach(t => t.classList.remove("open"));
  }
});

// ─── TOPIC DISPLAY ───────────────────────────────

function showTopic(t) {
  topicAbove.textContent = t.above;
  topicMain.textContent = t.main;
  topicBelow.textContent = t.below;
}

function showVocabTopic(v) {
  topicAbove.textContent = v.word;
  topicMain.textContent = `Use "${v.word}" in your speech.`;
  topicBelow.textContent = v.meaning;

  // Update left vocab card
  document.getElementById("vocab-word-display").innerHTML = v.word + ' <span class="audio-icon" onclick="speakWord(\'' + v.word + '\')">🔊</span>';
  document.getElementById("vocab-meaning-display").textContent = v.meaning;
  document.getElementById("vocab-example-display").textContent = v.example;
  document.getElementById("vocab-angle-display").textContent = v.angle;
}

// ─── SPARKLES ────────────────────────────────────
const SPARKLE_EMOJIS = ['✨', '⭐', '💫', '🌟', '🎉', '🌈', '💥', '🔮'];

function launchSparkles(container) {
  // Fewer sparkles on mobile to reduce DOM additions and GPU overdraw
  const baseCount = _isMobileDevice ? 3 : 5;
  const extraRange = _isMobileDevice ? 2 : 4;
  const count = baseCount + Math.floor(Math.random() * extraRange);
  for (let i = 0; i < count; i++) {
    const span = document.createElement('span');
    span.className = 'spin-sparkle';
    span.textContent = SPARKLE_EMOJIS[Math.floor(Math.random() * SPARKLE_EMOJIS.length)];
    const side = Math.floor(Math.random() * 4);
    const pct = Math.random() * 80 + 10;
    if (side === 0) { span.style.top = '0%'; span.style.left = pct + '%'; }
    if (side === 1) { span.style.top = '100%'; span.style.left = pct + '%'; }
    if (side === 2) { span.style.left = '0%'; span.style.top = pct + '%'; }
    if (side === 3) { span.style.left = '100%'; span.style.top = pct + '%'; }
    const angle = Math.random() * 360;
    const dist = 45 + Math.random() * 55;
    span.style.setProperty('--tx', `${Math.cos(angle * Math.PI / 180) * dist}px`);
    span.style.setProperty('--ty', `${Math.sin(angle * Math.PI / 180) * dist}px`);
    span.style.setProperty('--tr', `${(Math.random() - 0.5) * 200}deg`);
    span.style.animationDelay = `${Math.random() * 0.2}s`;
    container.appendChild(span);
    // Faster cleanup on mobile
    setTimeout(() => span.remove(), _isMobileDevice ? 600 : 900);
  }
}

// ─── SPIN ────────────────────────────────────────

spinBtn.addEventListener("click", () => {
  spinBtn.classList.add("is-spinning");
  playWhoosh();

  // ── PICTURE TAB: just fetch a new image, no text spinning ──
  if (currentTab === 'picture') {
    if (window.PictureTalk) PictureTalk.next();
    launchConfetti(18);
    playDing();
    setTimeout(() => spinBtn.classList.remove("is-spinning"), 600);
    return;
  }

  // ── WORD TABS: the normal slot-machine spin ──
  topicMain.classList.remove("spinning");
  void topicMain.offsetWidth;
  topicMain.classList.add("spinning");

  const topicArea = document.querySelector(".topic-area");
  topicArea.classList.add("spinning-active");
  topicAbove.classList.add("flipping");
  topicBelow.classList.add("flipping");

  launchSparkles(topicArea);

  let count = 0;
  // Fewer flips on mobile = fewer DOM updates = less jank
  const maxFlips = _isMobileDevice ? 7 : 10;
  // Wider interval on mobile to give GPU breathing room
  const flipInterval = _isMobileDevice ? 100 : 80;
  const interval = setInterval(() => {
    count++;
    if (count <= maxFlips) playTick();
    // Fewer sparkle bursts on mobile
    if (!_isMobileDevice && count % 2 === 0) launchSparkles(topicArea);
    if (_isMobileDevice && count % 3 === 0) launchSparkles(topicArea);

    if (currentTab === "random") {
      const pool = getRandomPool();
      topicIndex = Math.floor(Math.random() * pool.length);
      showTopic(pool[topicIndex]);
    } else if (currentTab === "interview") {
      const pool = getInterviewPool();
      interviewIndex = Math.floor(Math.random() * pool.length);
      showTopic(pool[interviewIndex]);
    } else if (currentTab === "vocab") {
      const pool = getVocabPool();
      vocabIndex = Math.floor(Math.random() * pool.length);
      showVocabTopic(pool[vocabIndex]);
    }

    if (count >= maxFlips) {
      clearInterval(interval);
      topicMain.classList.remove("spinning");
      topicArea.classList.remove("spinning-active");
      topicAbove.classList.remove("flipping");
      topicBelow.classList.remove("flipping");
      spinBtn.classList.remove("is-spinning");
      topicMain.classList.add("landed");
      setTimeout(() => topicMain.classList.remove("landed"), 550);
      playDing();
      launchConfetti(_isMobileDevice ? 15 : 30);
    }
  }, flipInterval);
});

// ─── TIMER (FULL-SCREEN CIRCULAR) ────────────────

// SVG circle circumference for r=108: 2π×108 ≈ 678.58
const RING_CIRCUMFERENCE = 2 * Math.PI * 108;

let circleTimerInterval = null;
let circleSeconds = 60;
let circleMaxSeconds = 60;
let circleRunning = false;

function getTimerDuration() {
  return currentTab === "vocab" ? 30 : 60;
}

// Open full-screen timer when "Start Timer →" is clicked
timerBtn.addEventListener("click", () => {
  circleMaxSeconds = getTimerDuration();
  circleSeconds = circleMaxSeconds;
  circleRunning = false;

  if (currentTab === 'picture') {
    // Picture mode: show thumbnail + prompt instead of text
    const img = window.PictureTalk ? PictureTalk.getCurrent() : null;
    if (timerTopicLabel)  timerTopicLabel.textContent = 'DESCRIBE:';
    if (timerPictureThumb) timerPictureThumb.classList.toggle('hidden', !img);
    if (timerThumbImg && img) timerThumbImg.src = img.url;
    timerTopicText.textContent = 'Describe what you see in the image.';
  } else {
    if (timerTopicLabel)  timerTopicLabel.textContent = 'TOPIC:';
    if (timerPictureThumb) timerPictureThumb.classList.add('hidden');
    timerTopicText.textContent = topicMain.textContent.trim();
  }

  updateCircleDisplay();
  setRingProgress(1);
  btnPlayPause.classList.remove("paused");
  btnPlayPause.querySelector(".play-icon").textContent = "▶";

  timerScreen.classList.remove("hidden");
  document.body.style.overflow = "hidden";
});

// Back button → close timer screen
timerBackBtn.addEventListener("click", () => {
  closeTimerScreen();
});

function closeTimerScreen() {
  clearInterval(circleTimerInterval);
  circleTimerInterval = null;
  circleRunning = false;
  timerScreen.classList.add("hidden");
  document.body.style.overflow = "";
  btnPlayPause.classList.remove("paused");
  btnPlayPause.querySelector(".play-icon").textContent = "▶";
}

// Play / Pause
btnPlayPause.addEventListener("click", () => {
  if (circleRunning) {
    // Pause
    clearInterval(circleTimerInterval);
    circleTimerInterval = null;
    circleRunning = false;
    btnPlayPause.classList.remove("paused");
    btnPlayPause.querySelector(".play-icon").textContent = "▶";
  } else {
    if (circleSeconds <= 0) {
      // Restart
      circleSeconds = circleMaxSeconds;
      updateCircleDisplay();
      setRingProgress(1);
    }
    // Start
    circleRunning = true;
    btnPlayPause.classList.add("paused");
    btnPlayPause.querySelector(".play-icon").textContent = "";
    circleTimerInterval = setInterval(tickCircleTimer, 1000);
  }
});

// Reset
btnResetCircle.addEventListener("click", () => {
  clearInterval(circleTimerInterval);
  circleTimerInterval = null;
  circleRunning = false;
  circleSeconds = circleMaxSeconds;
  circleCountdown.classList.remove("urgent");
  circleCountdown.classList.remove("done");
  const circleTimer = document.getElementById("circle-timer");
  if (circleTimer) circleTimer.classList.remove("timer-finished");
  progressRingFill.classList.remove("urgent");
  updateCircleDisplay();
  setRingProgress(1);
  btnPlayPause.classList.remove("paused");
  btnPlayPause.querySelector(".play-icon").textContent = "▶";
});

// − 0:30
btnMinus.addEventListener("click", () => {
  circleMaxSeconds = Math.max(30, circleMaxSeconds - 30);
  if (!circleRunning) {
    circleSeconds = circleMaxSeconds;
    updateCircleDisplay();
    setRingProgress(1);
  }
});

// + 0:30
btnPlus.addEventListener("click", () => {
  circleMaxSeconds = Math.min(300, circleMaxSeconds + 30);
  if (!circleRunning) {
    circleSeconds = circleMaxSeconds;
    updateCircleDisplay();
    setRingProgress(1);
  }
});

function tickCircleTimer() {
  circleSeconds--;
  updateCircleDisplay();
  setRingProgress(circleSeconds / circleMaxSeconds);

  if (circleSeconds <= 10) {
    circleCountdown.classList.add("urgent");
    progressRingFill.classList.add("urgent");
  }

  if (circleSeconds <= 0) {
    clearInterval(circleTimerInterval);
    circleTimerInterval = null;
    circleRunning = false;
    circleCountdown.textContent = "Done! 🎉";
    circleCountdown.classList.remove("urgent");
    circleCountdown.classList.add("done");
    const circleTimer = document.getElementById("circle-timer");
    if (circleTimer) circleTimer.classList.add("timer-finished");
    progressRingFill.classList.remove("urgent");
    btnPlayPause.classList.remove("paused");
    btnPlayPause.querySelector(".play-icon").textContent = "▶";
    launchConfetti(70);
  }
}

function updateCircleDisplay() {
  const m = Math.floor(circleSeconds / 60);
  const s = circleSeconds % 60;
  circleCountdown.textContent = `${m}:${String(s).padStart(2, "0")}`;
}

function setRingProgress(fraction) {
  // fraction 1 = full ring, 0 = empty
  const offset = RING_CIRCUMFERENCE * (1 - Math.max(0, fraction));
  progressRingFill.style.strokeDashoffset = offset;
}

// ─── SPEECH ANALYSIS MODAL ───────────────────────

[document.getElementById("speech-analysis-btn"),
document.getElementById("speech-analysis-btn2"),
document.getElementById("speech-analysis-btn3"),
  timerSpeechBtn].forEach(btn => {
    if (btn) btn.addEventListener("click", e => { e.preventDefault(); openModal(); });
  });

modalClose.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", e => { if (e.target === modalOverlay) closeModal(); });

function openModal() {
  modalOverlay.classList.remove("hidden");
  analysisResults.classList.add("hidden");
  recordStatus.textContent = "";
  recordBtn.textContent = "🔴 Start Recording";
  recordBtn.classList.remove("recording");
  isRecording = false;

  // Set the current spinned topic text in the modal
  const modalCurrentTopicSpan = document.getElementById("modal-current-topic");
  if (modalCurrentTopicSpan) {
    if (currentTab === 'picture') {
      modalCurrentTopicSpan.textContent = "Describe the picture provided.";
    } else {
      modalCurrentTopicSpan.textContent = topicMain ? topicMain.innerText.trim() : "General speaking practice";
    }
  }
}

// Custom Topic UI Toggle
const radioCurrentTopic = document.getElementById("radio-current-topic");
const radioCustomTopic = document.getElementById("radio-custom-topic");
const customTopicInput = document.getElementById("modal-custom-topic-input");

if (radioCurrentTopic && radioCustomTopic && customTopicInput) {
  radioCurrentTopic.addEventListener("change", () => {
    if (radioCurrentTopic.checked) customTopicInput.style.display = "none";
  });
  radioCustomTopic.addEventListener("change", () => {
    if (radioCustomTopic.checked) {
      customTopicInput.style.display = "block";
      customTopicInput.focus();
    }
  });
}

function closeModal() {
  modalOverlay.classList.add("hidden");
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
  isRecording = false;
  recordBtn.textContent = "🔴 Start Recording";
  recordBtn.classList.remove("recording");
}

let audioChunks = [];
let recordingStartTime = 0; // tracks when recording started (ms)
const MIN_RECORDING_MS = 15000; // 15-second minimum recording

let analysisTimestamps = [];

recordBtn.addEventListener("click", async () => {
  if (!isRecording) {
    // ── RATE LIMIT CHECK ──
    const now = Date.now();
    analysisTimestamps = analysisTimestamps.filter(t => now - t < 60000);

    if (analysisTimestamps.length >= 2) {
      const waitSeconds = Math.ceil((60000 - (now - analysisTimestamps[0])) / 1000);
      recordStatus.innerHTML = `<span style="color: #D4580A; font-weight: bold;">Whoa there, speedster! 🏃‍♂️</span><br>We love the enthusiasm, but let’s focus on quality over quantity! Take a deep breath and prepare your next amazing speech. Please wait ${waitSeconds} seconds.`;
      return;
    }

    // ── START RECORDING ──
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: { ideal: 1 }, // mono — ~50% smaller file, faster upload
          echoCancellation: true,     // removes mic echo
          noiseSuppression: true,     // cleaner audio = better Whisper accuracy
          autoGainControl: true       // normalises volume for consistent transcription
        }
      });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      recordingStartTime = Date.now();
      mediaRecorder.addEventListener("dataavailable", event => { audioChunks.push(event.data); });
      updateWhisperBadge('ready');

      mediaRecorder.addEventListener("stop", async () => {
        const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });

        // ── Build topic / image context ──
        let currentTopic    = topicMain ? topicMain.innerText.trim() : 'General speaking practice';
        let currentImageUrl = null;

        if (currentTab === 'picture') {
          currentTopic = 'Describe the picture provided.';
          if (window.PictureTalk && window.PictureTalk.getCurrent()) {
            currentImageUrl = window.PictureTalk.getCurrent().url;
          }
        }
        if (radioCustomTopic && radioCustomTopic.checked) {
          const customVal = customTopicInput.value.trim();
          if (customVal) { currentTopic = customVal; currentImageUrl = null; }
        }

        // ── TRANSCRIPTION ──
        // Always send audio to server for Groq Whisper transcription.
        // Groq Whisper is faithful to what was actually said (mispronunciations,
        // grammar errors, fillers) — essential for accurate English scoring.
        // Web Speech API is NOT used here as it auto-corrects speech.

        // ── SCORING ──
        try {
          analysisTimestamps.push(Date.now());
          recordStatus.textContent = '🔄 Analysing speech…';

          // Get Auth token
          let user = null;
          let idToken = null;

          if (window.supabase) {
            const { data: { session } } = await window.supabase.auth.getSession();
            user = session?.user;
            idToken = session?.access_token;
          } else if (window.auth) {
            user = window.auth.currentUser;
            if (user) {
              idToken = await user.getIdToken();
            }
          }

          if (!user) {
            throw new Error('Please log in to analyze your speech.');
          }

          // Always send raw audio — Groq Whisper transcribes on the server
          const reader = new FileReader();
          const base64data = await new Promise((res) => {
            reader.onloadend = () => res(reader.result.split(',')[1]);
            reader.readAsDataURL(audioBlob);
          });
          const bodyObj = { audioBase64: base64data, mimeType: audioBlob.type, topic: currentTopic, imageUrl: currentImageUrl, idToken };

          const res = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyObj),
          });

          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || `Analysis failed (${res.status})`);
          }
          
          const enqueueData = await res.json();
          const taskId = enqueueData.taskId;

          if (!taskId) {
            throw new Error('Server did not return a valid analysis task ID.');
          }

          // Poll /api/status?taskId=xxx until completed or failed
          let pollAttempts = 0;
          const maxAttempts = 60; // 60 seconds timeout limit

          const pollStatus = async () => {
            if (pollAttempts >= maxAttempts) {
              throw new Error('Speech analysis timed out. Please try again.');
            }
            pollAttempts++;

            const statusRes = await fetch(`/api/status?taskId=${taskId}`);
            if (!statusRes.ok) {
              throw new Error(`Failed to check analysis status (${statusRes.status})`);
            }

            const statusData = await statusRes.json();

            if (statusData.status === 'completed') {
              const parsedResult = typeof statusData.result === 'string'
                ? JSON.parse(statusData.result)
                : statusData.result;
              showRealAnalysis(parsedResult);
            } else if (statusData.status === 'failed') {
              throw new Error(statusData.error || 'AI analysis failed on the server.');
            } else {
              // Wait 1.2 seconds and poll again
              await new Promise(resolve => setTimeout(resolve, 1200));
              await pollStatus();
            }
          };

          await pollStatus();
        } catch (err) {
          console.error(err);
          recordStatus.textContent = `⚠️ ${err.message || 'Error analysing speech. Try again.'}`;
          recordBtn.textContent = '🔴 Try Again';
          recordBtn.disabled = false;
        }
      });

      mediaRecorder.start();
      isRecording = true;
      recordBtn.textContent = '⏹ Stop & Analyse';
      recordBtn.classList.add('recording');
      recordStatus.textContent = '🎙️ Recording… speak now!';
    } catch {
      recordStatus.textContent = '⚠️ Microphone access denied. Cannot record.';
    }
  } else {
    // ── STOP: enforce 15-second minimum ──
    const elapsed = Date.now() - recordingStartTime;
    if (elapsed < MIN_RECORDING_MS) {
      const remaining = Math.ceil((MIN_RECORDING_MS - elapsed) / 1000);
      recordStatus.innerHTML = `<span style="color:#D4580A;font-weight:bold;">⏱️ Too short!</span><br>Please speak for at least <strong>15 seconds</strong> so the AI can give you a proper analysis. Keep going for ${remaining} more second${remaining !== 1 ? 's' : ''}!`;
      return; // don't stop — let user keep speaking
    }

    if (mediaRecorder) {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(t => t.stop());
    }
    isRecording = false;
    recordBtn.textContent = '🔄 Analysing…';
    recordBtn.disabled = true;
    recordStatus.textContent = '🔄 Analysing speech…';
  }
});

function showRealAnalysis(data) {
  const fluency = Math.min(100, Math.max(0, data.fluency || 0));
  const clarity = Math.min(100, Math.max(0, data.clarity || 0));
  const confidence = Math.min(100, Math.max(0, data.confidence || 0));

  analysisResults.classList.remove("hidden");
  recordStatus.textContent = "✅ AI Analysis complete!";

  setTimeout(() => {
    document.getElementById("fluency-bar").style.width = fluency + "%";
    document.getElementById("clarity-bar").style.width = clarity + "%";
    document.getElementById("confidence-bar").style.width = confidence + "%";
    document.getElementById("fluency-val").textContent = fluency + " / 100";
    document.getElementById("clarity-val").textContent = clarity + " / 100";
    document.getElementById("confidence-val").textContent = confidence + " / 100";
    
    if (document.getElementById("feedback-val")) {
      document.getElementById("feedback-val").textContent = data.feedback || "No feedback provided.";
    }
    if (document.getElementById("transcription-val")) {
      document.getElementById("transcription-val").textContent = `"${data.transcription || "No transcription available."}"`;
    }
  }, 100);

  recordBtn.textContent = "🔴 Try Again";
  recordBtn.classList.remove("recording");
  recordBtn.disabled = false;
}
window.showRealAnalysis = showRealAnalysis;

function showDemoAnalysis() {
  showRealAnalysis({
    fluency: Math.floor(65 + Math.random() * 30),
    clarity: Math.floor(60 + Math.random() * 35),
    confidence: Math.floor(55 + Math.random() * 40),
    feedback: "Demo feedback: This is a placeholder since we couldn't connect to the AI.",
    transcription: "Demo transcription: Hello, this is a simulated transcription."
  });
}

// ─── SPEAK WORD (TTS) ────────────────────────────

function speakWord(word) {
  if ("speechSynthesis" in window) {
    const utter = new SpeechSynthesisUtterance(word);
    utter.lang = "en-US";
    utter.rate = 0.85;
    speechSynthesis.speak(utter);
  }
}
window.speakWord = speakWord;

// ─── FRAMEWORK TOGGLES ───────────────────────────

document.querySelectorAll(".framework-item").forEach(item => {
  item.addEventListener("click", () => {
    const isOpening = !item.classList.contains("active");

    // Close all other frameworks
    document.querySelectorAll(".framework-item").forEach(other => {
      if (other !== item && other.classList.contains("active")) {
        other.classList.remove("active");
        const otherBody = other.querySelector(".framework-body");
        if (otherBody) otherBody.remove();
        const otherArrow = other.querySelector(".toggle-arrow");
        if (otherArrow) otherArrow.textContent = "▼";
      }
    });

    // Toggle current
    item.classList.toggle("active");
    const body = item.querySelector(".framework-body");

    if (isOpening) {
      const title = item.querySelector(".framework-title").textContent.trim();
      const content = document.createElement("div");
      content.className = "framework-body";
      content.innerHTML = getFrameworkContent(title);
      item.appendChild(content);
    } else if (body) {
      body.remove();
    }

    const arrow = item.querySelector(".toggle-arrow");
    if (arrow) arrow.textContent = item.classList.contains("active") ? "▲" : "▼";
  });
});

function getFrameworkContent(title) {
  if (title.includes("STAR")) {
    return `<p><strong>S</strong> = Situation: Set the scene and context.</p>
            <p><strong>T</strong> = Task: Describe your responsibility.</p>
            <p><strong>A</strong> = Action: Explain what you did.</p>
            <p><strong>R</strong> = Result: Share the outcome.</p>`;
  }
  if (title.includes("PREP")) {
    return `<p><strong>P</strong> = Point: State your main point.</p>
            <p><strong>R</strong> = Reason: Explain why.</p>
            <p><strong>E</strong> = Example: Give an example.</p>
            <p><strong>P</strong> = Point: Restate your point.</p>`;
  }
  if (title.includes("PPF")) {
    return `<p><strong>P</strong> = Past: What happened before?</p>
            <p><strong>P</strong> = Present: What is happening now?</p>
            <p><strong>F</strong> = Future: What will you do next?</p>`;
  }
  return "";
}

// ─── CONFETTI ────────────────────────────────────

function resizeConfetti() {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}
resizeConfetti();
// Debounce resize to avoid excessive canvas reallocation on orientation changes
let _resizeTimeout = null;
window.addEventListener("resize", () => {
  if (_resizeTimeout) clearTimeout(_resizeTimeout);
  _resizeTimeout = setTimeout(resizeConfetti, 150);
});

const CONFETTI_COLORS = ["#D63384", "#FF6EB4", "#FFB3D1", "#FFDA9E", "#a81f65", "#fff0f5", "#FF85C2"];

function launchConfetti(count) {
  // Cap confetti particles on mobile for smoother animation
  const maxParticles = _isMobileDevice ? 40 : 120;
  const actualCount = Math.min(count, maxParticles - confettiParticles.length);
  for (let i = 0; i < actualCount; i++) {
    confettiParticles.push({
      x: Math.random() * confettiCanvas.width,
      y: -10,
      r: Math.random() * 7 + 4,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      dx: (Math.random() - 0.5) * 4,
      dy: Math.random() * 4 + 2,
      alpha: 1,
      rot: Math.random() * 360,
      drot: (Math.random() - 0.5) * 8,
    });
  }
  if (!confettiAnimId) animateConfetti();
}

function animateConfetti() {
  ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  // Faster alpha decay on mobile = particles disappear sooner = fewer draws
  const alphaDecay = _isMobileDevice ? 0.02 : 0.012;
  confettiParticles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate((p.rot * Math.PI) / 180);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6);
    ctx.restore();
    p.x += p.dx;
    p.y += p.dy;
    p.rot += p.drot;
    p.alpha -= alphaDecay;
  });
  confettiParticles = confettiParticles.filter(p => p.alpha > 0);
  if (confettiParticles.length > 0) {
    confettiAnimId = requestAnimationFrame(animateConfetti);
  } else {
    confettiAnimId = null;
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  }
}

// ─── INIT ────────────────────────────────────────

initDailyData();

// ─── PICTURE TALK ────────────────────────────────────────────────
// Initialised lazily the first time user clicks the Picture Talk tab.
// PictureTalk.init() is idempotent — safe to call multiple times.
function initPictureTalk() {
  if (window.PictureTalk) {
    PictureTalk.init().catch(console.error);
  }
}

// Wire up the speech-analysis button in picture tab
const speechBtn4 = document.getElementById('speech-analysis-btn4');
if (speechBtn4) speechBtn4.addEventListener('click', e => { e.preventDefault(); openModal(); });

// ─── THEME SWITCHER ──────────────────────────────

const themeToggleBtn = document.getElementById("theme-toggle-btn");
const themeDropdown = document.getElementById("theme-dropdown");
const themeSwatches = document.querySelectorAll(".theme-swatch");

if (themeToggleBtn && themeDropdown) {
  // Toggle dropdown open/close
  themeToggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = !themeDropdown.classList.contains("hidden");
    themeDropdown.classList.toggle("hidden", isOpen);
    themeToggleBtn.classList.toggle("open", !isOpen);
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#theme-switcher")) {
      themeDropdown.classList.add("hidden");
      themeToggleBtn.classList.remove("open");
    }
  });

  // Apply theme on swatch click
  themeSwatches.forEach(swatch => {
    swatch.addEventListener("click", () => {
      const theme = swatch.dataset.theme;
      applyTheme(theme);

      // Update active swatch
      themeSwatches.forEach(s => s.classList.remove("active"));
      swatch.classList.add("active");

      // Close dropdown with a small delay for visual feedback
      setTimeout(() => {
        themeDropdown.classList.add("hidden");
        themeToggleBtn.classList.remove("open");
      }, 220);
    });
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("speakup-theme", theme);

  if (themeToggleBtn) {
    // Update the toggle button swatch dot color to match chosen theme
    const THEME_COLORS = {
      pink: "#D63384",
      green: "#2D6A4F",
      blue: "#1A6FA8",
      purple: "#7B2FBE",
      orange: "#D4580A",
      teal: "#0D9488",
      dark: "#ffa116",
    };
    const color = THEME_COLORS[theme] || THEME_COLORS.green;
    themeToggleBtn.style.borderColor = color + "80"; // 50% opacity border hint
  }
}

function initTheme() {
  const saved = localStorage.getItem("speakup-theme") || "green";
  document.documentElement.setAttribute("data-theme", saved);

  if (themeSwatches.length > 0) {
    // Mark the matching swatch as active
    themeSwatches.forEach(s => {
      s.classList.toggle("active", s.dataset.theme === saved);
    });
  }

  // Apply color hint to toggle button
  applyTheme(saved);
}

// Run after all vars/functions are defined
initTheme();

// ─── CHATBOT LOGIC ───────────────────────────────

const chatbotToggle = document.getElementById("chatbot-toggle");
const chatbotWindow = document.getElementById("chatbot-window");
const chatbotClose = document.getElementById("chatbot-close");
const chatbotSend = document.getElementById("chatbot-send");
const chatbotInput = document.getElementById("chatbot-input");
const chatbotMessages = document.getElementById("chatbot-messages");
const chatbotPointer = document.querySelector(".chatbot-pointer");

let chatHistory = [];

chatbotToggle.addEventListener("click", () => {
  chatbotWindow.classList.toggle("hidden");
  if (!chatbotWindow.classList.contains("hidden")) {
    chatbotInput.focus();
    if (chatbotPointer) chatbotPointer.style.display = "none";
  } else {
    if (chatbotPointer) chatbotPointer.style.display = "flex";
  }
});

chatbotClose.addEventListener("click", () => {
  chatbotWindow.classList.add("hidden");
  if (chatbotPointer) chatbotPointer.style.display = "flex";
});

function appendMessage(role, text) {
  const msgDiv = document.createElement("div");
  msgDiv.className = `chat-message ${role}-message`;
  // Simple markdown to HTML for bolding/newlines
  let formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                          .replace(/\n/g, '<br/>');
  msgDiv.innerHTML = formattedText;
  chatbotMessages.appendChild(msgDiv);

  // For bot messages: scroll so the TOP of the new message is visible
  // For user messages: keep showing bottom (natural feel)
  if (role === 'bot') {
    setTimeout(() => {
      msgDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  } else {
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
  }
}

function showTyping() {
  let typingEl = document.getElementById("chat-typing");
  if (!typingEl) {
    typingEl = document.createElement("div");
    typingEl.id = "chat-typing";
    typingEl.className = "chat-typing";
    typingEl.textContent = "AI is thinking...";
    chatbotMessages.appendChild(typingEl);
  }
  typingEl.style.display = "block";
  chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
}

function hideTyping() {
  const typingEl = document.getElementById("chat-typing");
  if (typingEl) typingEl.style.display = "none";
}

async function sendChatMessage() {
  const text = chatbotInput.value.trim();
  if (!text) return;

  // Add user message to UI
  appendMessage("user", text);
  chatbotInput.value = "";
  
  // Add to history
  chatHistory.push({ role: "user", content: text });
  
  showTyping();
  
  try {
    let user = null;
    let idToken = null;

    if (window.supabase) {
      const { data: { session } } = await window.supabase.auth.getSession();
      user = session?.user;
      idToken = session?.access_token;
    } else if (window.auth) {
      user = window.auth.currentUser;
      if (user) {
        idToken = await user.getIdToken();
      }
    }

    if (!user) {
      hideTyping();
      appendMessage("bot", "Hey there! Please log in first to chat with me. 🎤");
      chatHistory.pop();
      return;
    }

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: chatHistory, idToken })
    });
    
    if (!res.ok) throw new Error("Chat request failed");
    
    const data = await res.json();
    const reply = data.reply;
    
    hideTyping();
    appendMessage("bot", reply);
    chatHistory.push({ role: "assistant", content: reply });
    
  } catch (err) {
    console.error(err);
    hideTyping();
    appendMessage("bot", "Oops! I'm having trouble connecting right now. Try again later.");
    chatHistory.pop(); // remove failed user message from history
  }
}

chatbotSend.addEventListener("click", sendChatMessage);
chatbotInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    sendChatMessage();
  }
});



// ─── MOBILE SCROLL SHOW/HIDE GENIE ───────────────────────────────────────
// Shows Genie button when user scrolls down, hides when scrolling back up
// Uses direction detection so it reacts immediately, not at the top
(function() {
  const isMobile = () => window.innerWidth <= 768;
  const chatbotContainer = document.getElementById('chatbot-container');
  if (!chatbotContainer) return;

  let lastScrollY = window.scrollY;
  let ticking = false;

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        if (!isMobile()) { ticking = false; return; }

        const currentScrollY = window.scrollY;
        const scrollingDown = currentScrollY > lastScrollY;

        if (scrollingDown && currentScrollY > 80) {
          // User scrolled down past 80px — show the chatbot button
          chatbotContainer.style.opacity = '1';
          chatbotContainer.style.pointerEvents = 'auto';
          chatbotContainer.style.transform = 'translateY(0)';
        } else if (!scrollingDown) {
          // User scrolled up — immediately hide the chatbot button (but not window if open)
          if (chatbotWindow && chatbotWindow.classList.contains('hidden')) {
            chatbotContainer.style.opacity = '0';
            chatbotContainer.style.pointerEvents = 'none';
            chatbotContainer.style.transform = 'translateY(20px)';
          }
        }

        lastScrollY = currentScrollY;
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });

  // Initial state on mobile: hidden until scroll
  if (isMobile()) {
    chatbotContainer.style.opacity = '0';
    chatbotContainer.style.pointerEvents = 'none';
    chatbotContainer.style.transform = 'translateY(20px)';
    chatbotContainer.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
  }
})();
