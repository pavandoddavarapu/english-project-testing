# AI-Powered Moderation Design Document (Group Discussion Rooms)

This document outlines the architecture, design, and cost analysis for implementing user moderation and automatic AI-powered speech moderation in the **Speak Up!** Group Discussion rooms.

---

## 1. Feature Overview

To ensure group discussion rooms remain safe, friendly, and focused on English learning, we planned a multi-level moderation system:

### Level 1: Host Kick (Manual)
* **Action:** The room creator (host) can kick any user.
* **Mechanism:** Clicking a "Kick" button removes the target user's UID from the Firestore room `participants` list.
* **Result:** The kicked user's browser client detects they are no longer in the room list and auto-redirects them to the lobby with a notification.

### Level 2: Room Ban (Manual/Persistent)
* **Action:** The host bans a user from rejoining.
* **Mechanism:** The kicked user's UID is added to a `banned` array in the Firestore room document.
* **Result:** The database security rules and client-side checks prevent that UID from re-joining the room.

### Level 3: AI Speech Moderation (Automatic)
* **Action:** Automatic toxicity, profanity, and harassment detection based on spoken speech transcripts.
* **Mechanism:** 
  1. The browser uses the native **Web Speech API** to transcribe each participant's voice locally in the background.
  2. Every $X$ seconds/minutes, the transcript is sent to `/api/moderate-speech`.
  3. Gemini AI scores the content across safety categories (Toxicity, Profanity, Harassment, Coherence).
  4. If a threshold is crossed, action is taken automatically (warning → kick → suspend).

---

## 2. Technical Architecture Flow (AI Mode)

```
[ User Speaks ]
       ↓
[ Web Speech API (Local Browser) ] (Transcribes speech in real-time)
       ↓ (Batched every 1–2 minutes or when word count > 50)
[ API Endpoint: /api/moderate-speech ]
       ↓
[ Gemini AI Analysis ] (Checks for safety scores 0-100)
       ↓
[ Response Evaluated ]
       ↓
[ Action Taken ] ──→ (If Score > 70) ──→ Firestore warning doc created (alert user)
                 ──→ (If Score > 90) ──→ Firestore room.banned.push(UID) (auto-kick)
```

### Why this workaround?
We use embedded **Jitsi Meet** for audio. Because Jitsi is run inside an `iframe`, browsers block us from accessing the raw audio stream of other participants. Therefore, we use each client's browser microphone locally via the **Web Speech API** to record and transcribe their own voice, then send it to our server.

---

## 3. Cost & API Call Impact Analysis

A major consideration is API call usage, especially under Gemini's free tier and Vercel's hobby limitations.

### Expected API Loads (Per Room of 5 Users, 1-Hour Session)

#### Baseline (Naive 30-Second Polling)
* **Gemini calls:** 5 users $\times$ 2 requests/min $\times$ 60 mins = **600 calls/hour per room**.
* **Impact:** 3 active rooms in one day will completely consume the daily Gemini Free Tier (limit: 1,500 requests/day).

#### Optimized Batching (Recommended)
* **Rule:** Only call Gemini when a user speaks $>50$ words, or at most every 2 minutes.
* **Gemini calls:** ~60 calls/hour per room.
* **Impact:** Easily remains within the free tier limits even with multiple concurrent rooms.

### Vercel Serverless Function Limit
* **Problem:** Vercel Hobby accounts are limited to **12 serverless functions** in the `/api/` directory.
* **Current status:** The project is already at the 12-function limit.
* **Solution:** We cannot add `/api/moderate-speech` as a new file. Instead, we must **merge the moderation logic** into an existing endpoint (like `/api/chat.js` or `/api/analyze.js`) by checking a request type or flag.

---

## 4. Implementation Phases

We recommend implementing this in phases to manage complexity and costs:

### Phase 1: Manual Moderation & Live Transcription (Zero API Cost)
* Implement the "Kick" and "Ban" database lists in Firestore.
* Enable the Web Speech API on the client to show live subtitling/transcripts of what the active speaker is saying on-screen.
* **Cost:** $0 extra API calls (uses free browser speech API).

### Phase 2: Report System
* Let participants flag/report another user manually. 
* Flag reports are saved directly to Firestore for review by the admin panel.

### Phase 3: AI Auto-Moderation (Gemini Integration)
* Hook the batched transcripts up to Gemini via the merged API endpoint.
* Implement the auto-warning and auto-kick logic based on the returned toxicity scores.
