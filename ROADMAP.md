# 🗺️ Speak Up! — Feature Roadmap

> Features to build in future sprints. Tick off when done!

---

## 🔴 High Priority (Do These First)

### 1. 🏆 Public Leaderboard Page
- [ ] New page `/leaderboard` showing top users ranked by Aura Points
- [ ] Weekly + All-time tabs
- [ ] Shows username, avatar, aura points, streak count
- [ ] Clickable — links to public profile `/u/username`
- [ ] Auto-refreshes weekly (resets weekly leaderboard every Monday)
- **SEO benefit:** New indexed page = more Google traffic
- **API needed:** `GET /api/leaderboard`

---

### 2. 📝 Blog / Articles Page
- [ ] New page `/blog` with articles about English learning tips
- [ ] Static HTML articles (no CMS needed)
- [ ] Article ideas:
  - "How to improve English fluency in 30 days"
  - "Top 10 English speaking tips for interviews"
  - "Why speaking practice beats grammar study"
  - "How AI scores your English speaking"
- **SEO benefit:** HUGE — articles rank for long-tail keywords
- **Each article = new indexed page = more traffic**

---

### 3. 📊 Progress Chart on Dashboard
- [ ] Line chart showing fluency/clarity/confidence scores over time
- [ ] Date range selector: Last 7 days / 30 days / All time
- [ ] Per-mode breakdown (Random Topics vs Interview vs Picture Talk)
- [ ] Use Chart.js (free, lightweight)
- **API needed:** `GET /api/progress-history`

---

## 🟡 Medium Priority

### 4. 🔔 Email Notifications for Streaks
- [ ] Send email reminder if user hasn't practiced in 24 hours
- [ ] "Your streak is at risk!" notification
- [ ] Use Resend.com (free tier: 3000 emails/month)
- [ ] Opt-in only (add toggle in dashboard settings)
- **Retention boost:** Keeps users coming back daily

---

### 5. 🌍 Public Profile Pages
- [ ] `/u/username` pages already have URL structure
- [ ] Make profile pages fully public (no login needed to view)
- [ ] Show: avatar, aura points, streak, badges, practice heatmap
- [ ] Shareable link — users share their profiles on LinkedIn/Twitter
- **Viral growth:** Every shared profile = backlink + new users
- **SEO benefit:** Thousands of indexed `/u/username` pages

---

### 6. 🎯 Daily Challenge Mode
- [ ] One special topic per day (same for all users)
- [ ] Global leaderboard for that day's challenge only
- [ ] Badge for completing daily challenge
- [ ] Resets at midnight IST
- **Engagement:** Creates daily habit + competition

---

### 7. 📱 Push Notifications (PWA)
- [ ] Browser push notifications for streak reminders
- [ ] "Practice time! Keep your 🔥 streak alive"
- [ ] Uses Web Push API (free, no server needed)
- [ ] Opt-in prompt after 3rd practice session

---

## 🟢 Nice to Have (Future)

### 8. 🤖 AI Moderation in Group Discussion Rooms
- [ ] Design spec already in `AI_MODERATION_DESIGN.md`
- [ ] Gemini-based toxicity detection on live speech
- [ ] Auto-warn → auto-kick pipeline
- [ ] Real-time moderation dashboard for room host

### 9. 🔤 Pronunciation Scoring
- [ ] Phoneme-level feedback on specific words
- [ ] Highlight mispronounced words in transcript
- [ ] "You said X, try saying Y" with audio example
- [ ] Needs specialized pronunciation API (Azure Speech or similar)

### 10. 📈 Google Analytics Integration
- [ ] Track: page views, session duration, practice completions
- [ ] Funnel: Homepage → Signup → First Practice
- [ ] Add `gtag.js` to all pages
- [ ] Dashboard in Google Analytics 4

### 11. 🌐 Multi-language UI
- [ ] Hindi, Telugu, Tamil UI translations
- [ ] English practice stays in English
- [ ] Just buttons/labels translated for accessibility
- [ ] Use i18n JSON files

### 12. 💬 Vocabulary Flash Cards
- [ ] Learn a new word each day
- [ ] Use it in a sentence (recorded)
- [ ] AI checks if word was used correctly
- [ ] Builds personal vocabulary list

---

## ✅ Already Done

- [x] AI speech scoring (Fluency, Clarity, Confidence)
- [x] Daily practice streaks
- [x] Aura Points gamification
- [x] GitHub-style practice heatmap
- [x] Performance badges
- [x] Public profile pages (`/u/username`)
- [x] 7 custom themes
- [x] PWA (installable on mobile)
- [x] Group Discussion Rooms with Jitsi
- [x] Picture Talk mode
- [x] Interview Prep mode
- [x] Vocabulary Builder mode
- [x] Async AI processing pipeline
- [x] Multi-key API rotation + fallback
- [x] Custom domain: speakupai.me
- [x] SEO: JSON-LD schemas, sitemap, hreflang
- [x] Google Search Console indexing

---

*Last updated: 2026-06-30*
