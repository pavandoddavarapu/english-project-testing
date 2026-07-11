/**
 * streak-fire.js
 * 
 * Manages the LeetCode-style Streak Fire Widget in the navigation bar.
 * Fetches user progress and today's challenge to light up the fire icon when solved.
 */

export async function initStreakFireWidget(user) {
  const widget = document.getElementById('nav-streak-widget');
  const fireIcon = document.getElementById('nav-streak-fire');
  const countText = document.getElementById('nav-streak-count');

  if (!widget || !fireIcon || !countText) return;

  try {
    // 1. Fetch user data (streak & recent sessions)
    const idToken = await user.getIdToken();
    const userRes = await fetch('/api/get-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, uid: user.uid })
    });
    if (!userRes.ok) throw new Error('Failed to fetch user profile');
    const { data: userData } = await userRes.json();

    if (!userData) return;

    // Set active streak count
    const streak = userData.streak || 0;
    countText.textContent = streak;

    // 2. Fetch today's Daily Challenge topic
    const challengeRes = await fetch('/api/daily?challenge=1');
    if (!challengeRes.ok) throw new Error('Failed to fetch daily challenge');
    const challengeData = await challengeRes.json();

    const todayTopic = challengeData.topic;
    const todayDate = challengeData.date; // YYYY-MM-DD in IST

    // Check if challenge is completed today
    let isSolved = false;

    // Verify against recent sessions
    const sessions = userData.recent_sessions || [];
    const hasChallengeSession = sessions.some(s => {
      // Must be random mode and matching topic (case-insensitive)
      if (s.mode !== 'random') return false;
      const topicMatches = s.topic.trim().toLowerCase() === todayTopic.trim().toLowerCase();
      
      // Convert session timestamp to IST date string (YYYY-MM-DD)
      const dateObj = new Date(s.date);
      const istOffset = 5.5 * 60 * 60 * 1000;
      const sessionDateIST = new Date(dateObj.getTime() + istOffset).toISOString().split('T')[0];

      return topicMatches && (sessionDateIST === todayDate);
    });

    if (hasChallengeSession) {
      isSolved = true;
    }

    // Update widget visual state
    if (isSolved) {
      widget.classList.add('active');
      widget.title = `Streak active! Today's Daily Challenge solved. 🔥`;
      fireIcon.style.filter = 'none';
      fireIcon.style.opacity = '1';
    } else {
      widget.classList.remove('active');
      widget.title = `Keep your streak alive! Click to solve today's Daily Challenge.`;
      fireIcon.style.filter = 'grayscale(100%)';
      fireIcon.style.opacity = '0.45';
    }

    // Display widget
    widget.style.display = 'inline-flex';

  } catch (err) {
    console.warn('[StreakFire] Failed to update streak fire widget:', err.message);
  }
}
