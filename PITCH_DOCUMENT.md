# 🎤 Speak Up! — Project Pitch Document
### AI-Powered English Speaking Practice Platform

**Live URL:** https://english-project-testing-o32g.vercel.app  
**GitHub:** https://github.com/pavandoddavarapu/english-project-testing  
**Built by:** Pavan Doddavarapu

---

## 1. Executive Summary

**Speak Up!** is a full-stack, production-deployed web application that helps English learners improve their speaking skills through AI-powered feedback. Users record themselves speaking on daily topics, and the platform delivers instant scores on **Fluency, Clarity, and Confidence** — all powered by a real-time AI pipeline built on Groq (Whisper) and Google Gemini.

> **Not a prototype. Not a demo. A live, production-grade product with real users.**

---

## 2. The Problem

Over **1.5 billion people** are learning English globally. The #1 barrier to fluency is not grammar — it is **the lack of speaking practice**. Language learning apps like Duolingo focus on reading/writing. There is no free, accessible, AI-powered tool that gives real-time feedback on *spoken* English.

**Speak Up! solves this directly** — zero cost, zero download, zero barrier.

---

## 3. Core Features

### 🎯 Practice Modes
| Mode | Description |
|---|---|
| **Random Topics** | AI-generated daily topics — spin the wheel, speak, get scored |
| **Interview Prep** | Curated HR and technical interview questions for job seekers |
| **Vocabulary Builder** | Practice using specific words in context |
| **Picture Talk** | Describe a dynamic scene image — tests spontaneous speaking |
| **Group Discussion Rooms** | Real-time multi-user voice rooms with live topic spin wheel |

### 📊 AI Scoring System
Every speech recording is evaluated on:
- **Fluency** — Flow, pace, and continuity
- **Clarity** — Comprehensibility and articulation  
- **Confidence** — Expression, assertiveness, and delivery
- **Personalized AI Feedback** — 2–3 warm, actionable coaching sentences per session

### 🔥 Gamification & Retention
- **Daily Practice Streaks** with automatic reset logic
- **Aura Points** — earned per session, drive leaderboard ranking
- **GitHub-style Practice Heatmap** — full year activity visualization
- **Performance Badges** — unlockable at milestone thresholds
- **Public Profile Pages** — shareable with `/u/username` URLs
- **7 Custom Themes** — Pink, Green, Blue, Purple, Teal, Orange, Dark

### 📱 PWA (Progressive Web App)
- **Installable** on Android and iOS like a native app
- **Offline-capable** via Service Worker
- **Manifest** configured with splash screens, icons, and theme colors

---

## 4. Technical Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  CLIENT (Browser)                        │
│  HTML5 + CSS3 + Vanilla JS                               │
│  Firebase Auth (Google Sign-In / Email)                  │
│  MediaRecorder API (audio capture)                       │
│  Web Speech API (live transcription)                     │
│  Firebase Firestore (real-time room state for GD)        │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTPS / REST API
┌───────────────────────▼─────────────────────────────────┐
│             SERVERLESS BACKEND (Vercel)                  │
│  11 Node.js API endpoints in /api/                       │
│  Shared middleware: CORS, Rate Limiting, Auth, Errors    │
│  Asynchronous processing queue (task-based pipeline)     │
└──────┬────────────────────────┬────────────────────────-─┘
       │                        │
┌──────▼──────┐        ┌────────▼──────────────────┐
│  PostgreSQL  │        │     External AI APIs       │
│  (Supabase)  │        │  Groq Whisper (STT)        │
│  3 tables    │        │  Groq Llama 3.1 (scoring)  │
│  4 indexes   │        │  Gemini 1.5 Flash (fallback│
│              │        │  + picture talk context)   │
│  Firebase    │        │  Unsplash / Pexels         │
│  Firestore   │        │  (image pipeline)          │
└─────────────┘        └────────────────────────────┘
```

---

## 5. Engineering Highlights

### ⚡ Asynchronous AI Processing Pipeline
The single most complex engineering piece in the project. Rather than blocking the HTTP response while waiting for AI analysis (5–15 seconds), I built a **queue-based async pipeline**:

1. User submits audio → API receives it, creates a `task_id`, immediately returns `202 Accepted`
2. Client polls `/api/status?taskId=...` every 2 seconds (non-blocking UX)
3. Background worker `/api/process-queue` processes the task:
   - Transcribes audio via **Groq Whisper** (ultra-fast, <1s latency)
   - Scores the transcript via **Groq Llama 3.1 8B Instant**
   - Falls back to **Gemini 1.5 Flash** if Groq fails or rate-limits
4. Result saved to PostgreSQL, client receives the final analysis
5. Raw audio base64 is **deleted from DB** after processing (storage efficiency)
6. Tasks older than 1 hour are auto-pruned (zero-maintenance)

### 🔄 Multi-Key API Rotation with Automatic Failover
Production systems fail. Resilience is built in from the ground up:
- **Groq API key rotation**: When one key hits a rate limit (HTTP 429), the system automatically tries the next key — zero downtime.
- **Full AI fallback chain**: Groq Whisper → Gemini 1.5 Flash → Graceful error message
- **Image fallback chain**: Unsplash → Pexels → Hardcoded images (3 layers of resilience)

### 🔒 Enterprise-Level Security (All custom-built)

| Feature | Implementation |
|---|---|
| **CORS Lockdown** | Origin whitelist via `ALLOWED_ORIGINS` env variable |
| **Rate Limiting** | IP-based in-memory rate limiter (120 req/min; 20/min for images) |
| **Worker Auth** | `WORKER_SECRET` header check on process-queue — prevents external abuse |
| **Firebase Token Verification** | All write operations verify the Firebase ID token server-side |
| **Safe Error Handling** | Raw DB errors sanitized — no internal details leaked to client |
| **Content Security Policy** | Full CSP header — restricts scripts/styles/frames to known origins |
| **HSTS** | `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` |
| **Permissions Policy** | Microphone access restricted to only trusted video-call domains |

### 🖼️ Smart Image Cache System
- 150+ curated picture-talk scenarios (cozy cafés, rainy streets, mountain trails...)
- Module-level **in-memory cache** (75 images) persists across warm Vercel invocations
- Background **async cache refill** when stock drops below 15 — never blocks a user request
- **Deduplication** by image ID prevents repeat images
- Falls back through 3 layers: Unsplash → Pexels → Hardcoded images

### 🌐 Real-Time Group Discussion Rooms
- **Firebase Firestore** for room state (participants, topics, approvals, timers)
- **Jitsi Meet** embedded for voice communication
- **Topic Spin Wheel** — host spins, proposed topic goes through participant approval voting
- **Shared countdown timer** visible to all participants simultaneously
- Room auto-cleanup via Firestore — no stale data

### 🗄️ Database Design
```sql
-- 3 tables, 4 performance indexes
users              → uid, streaks, aura_points, username (unique, case-insensitive index)
practice_sessions  → user_id (FK), score, fluency, clarity, confidence, mode, topic
analysis_queue     → task_id, status, transcript, result, audio_base64 (cleared post-processing)

-- Indexes
CREATE INDEX idx_sessions_user_date ON practice_sessions(user_id, date DESC);
CREATE INDEX idx_queue_status_created ON analysis_queue(status, created_at);
CREATE UNIQUE INDEX idx_users_username ON users(LOWER(username));
```

### 🔍 SEO — Production Grade
- **6 JSON-LD Schemas**: WebApplication, WebSite, FAQPage, HowTo, Course, Speakable
- Every page: canonical URLs, Open Graph, Twitter Card meta tags
- `sitemap.xml` with priority ratings + `robots.txt` with crawl directives
- Custom animated 404 page — reduces bounce rates
- `noindex` on auth pages — correct SEO hygiene

---

## 6. Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | HTML5, CSS3, Vanilla JS | Zero framework overhead, max performance |
| Auth | Firebase Auth | Google/Email SSO — one-click sign-in |
| Real-time DB | Firebase Firestore | WebSocket-level updates for GD rooms |
| Backend | Vercel Serverless (Node.js) | Auto-scaling, zero infra management |
| Database | PostgreSQL (Supabase) | Relational data for users and sessions |
| Speech-to-Text | Groq Whisper Large v3 Turbo | Fastest STT available (~300ms latency) |
| AI Scoring | Groq Llama 3.1 8B Instant | Real-time LLM inference |
| AI Fallback | Google Gemini 1.5 Flash | Multi-modal: handles both audio & image context |
| Images | Unsplash + Pexels APIs | High-quality, copyright-free photos |
| Voice (GD rooms) | Jitsi Meet (systemli.org) | Free, open-source WebRTC video conferencing |
| PWA | Service Worker + Web Manifest | Installable, offline-capable |
| CI/CD | GitHub → Vercel auto-deploy | Every push deploys in ~30 seconds |
| Hosting | Vercel (Singapore region) | Low latency for Indian users |

---

## 7. Project Scale

| Component | Count |
|---|---|
| API Endpoints | 11 serverless functions |
| Frontend Pages | 9 complete HTML pages |
| CSS Lines | 2,883 lines — 7-theme system |
| Picture Talk scenarios | 150+ curated prompts |
| JSON-LD Schemas | 6 (rich Google snippet coverage) |
| Database tables | 3 tables, 4 performance indexes |
| Security features | 8 implemented from scratch |
| Git commits | 40+ with descriptive messages |
| AI models integrated | 3 (Groq Whisper, Llama 3.1, Gemini 1.5) |

---

## 8. Competitive Differentiation

| Feature | Duolingo | ChatGPT | **Speak Up!** |
|---|---|---|---|
| Speaking Practice | ❌ Limited | ✅ Yes | ✅ Yes |
| Instant AI Scoring | ❌ | ❌ No metrics | ✅ Fluency / Clarity / Confidence |
| Group Discussion | ❌ | ❌ | ✅ Real-time voice rooms |
| Picture Description | ❌ | ✅ Text only | ✅ Visual + Voice |
| Free forever | ❌ Freemium | ❌ $20/month | ✅ 100% Free |
| Gamification | ✅ Streaks | ❌ | ✅ Streaks, Aura, Badges, Heatmap |
| PWA Installable | ✅ | ❌ | ✅ |
| Indian Interview Prep | ❌ | ❌ | ✅ Focused mode |
| Public Profile | ❌ | ❌ | ✅ Shareable /u/username |

---

## 9. Live Demo Links

| Resource | Link |
|---|---|
| 🌐 Live App | https://english-project-testing-o32g.vercel.app |
| 🎤 Practice Page | https://english-project-testing-o32g.vercel.app/practice |
| 👥 Group Discussion | https://english-project-testing-o32g.vercel.app/group-meet |
| 📂 GitHub Repo | https://github.com/pavandoddavarapu/english-project-testing |
| ℹ️ About Page | https://english-project-testing-o32g.vercel.app/about |

---

## 10. Future Roadmap

1. **AI Moderation in GD Rooms** — Gemini-based toxicity detection on live speech transcripts with auto-kick. Full design spec documented in `AI_MODERATION_DESIGN.md`.
2. **Custom Domain** — All canonical URLs ready to update with one command.
3. **Google Analytics** — Track user journeys, session counts, and retention.
4. **Pronunciation Scoring** — Phoneme-level feedback.
5. **Global Leaderboard** — Ranking by Aura Points with weekly resets.

---

## 11. Key Engineering Decisions

**Why vanilla JS instead of React?**
> The app must load fast on mobile in India (2G/3G). No framework overhead means first meaningful paint in under 1 second. Each page only loads what it needs.

**Why PostgreSQL + Firebase (two databases)?**
> PostgreSQL stores structured user data with relational queries. Firebase Firestore handles real-time ephemeral GD room state needing WebSocket-level updates — something PostgreSQL cannot do cheaply.

**Why async queue instead of direct AI call?**
> AI transcription + scoring takes 5–15 seconds. Blocking HTTP for 15 seconds times out on mobile. The queue returns immediately, keeping UX responsive.

**Why Groq over OpenAI?**
> Groq's hardware-accelerated inference is ~10x faster for Whisper transcription at the same cost. On free tier, this means a dramatically better user experience.

---

*Built with ❤️ for English learners everywhere.*
