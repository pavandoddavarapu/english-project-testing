# 🗣️ Speak Up! — Production-Grade English Practice App

A serverless English speaking practice platform that provides daily challenges, real-time speech analysis, picture talks, and progress tracking using Gemini, Groq (Whisper), and a PostgreSQL database.

---

## 🛠️ Architecture

- **Frontend**: Plain HTML5, CSS3, & vanilla Javascript (with Firebase Auth for client-side user sessions).
- **Backend API**: Serverless Node.js endpoints (deployed as Vercel Functions).
- **Database**: PostgreSQL (Neon, Supabase, or any managed instance) with a resilient migration layer.
- **AI Processing**: Asynchronous background queue executing audio transcription and evaluation using Groq and Gemini.

---

## 🔒 Production Hardening & Security

This project has been hardened with enterprise-level security:
1. **CORS Lockdown**: Restricted to domain-specific origins configured via the `ALLOWED_ORIGINS` environment variable.
2. **Server-side Rate Limiting**: IP-based rate limiting on write endpoints to prevent bot abuse and key exhaustion.
3. **Safe Error Handling**: Error sanitization prevents leaking raw database queries or API error details to client applications.
4. **Internal Worker Authorization**: The asynchronous process-queue worker is protected from external triggers using a secure `WORKER_SECRET` header check.
5. **Auto-Cleanup**: The background task queue automatically prunes older completed and failed tasks to maintain a light database footprint.

---

## 🚀 Environment Variables

Configure the following variables in your `.env` or Vercel settings:

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` / `POSTGRES_URL` | PostgreSQL connection string | `postgres://user:pass@host:5432/db` |
| `ALLOWED_ORIGINS` | Comma-separated domains allowed to call the APIs | `https://speakup.vercel.app` |
| `GROQ_API_KEY` | Comma-separated Groq API keys (rotated automatically) | `gsk_key1,gsk_key2` |
| `GEMINI_API_KEY` | Gemini API key for fallback LLM scoring & translation | `AIzaSy...` |
| `WORKER_SECRET` | Secret token to authenticate process-queue background calls | `a-long-random-string` |

---

## ⚙️ Development Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure local environment**:
   Create a `.env` file containing your environment variables.

3. **Run the local Vercel Dev server**:
   ```bash
   npm run dev
   ```

4. **Verify Database Schema**:
   Run the schema script located in [schema.sql](file:///c:/Users/pavan/OneDrive/Desktop/english%20%20project%20-%20testing%20version/english-project/database/schema.sql) in your database query editor.
