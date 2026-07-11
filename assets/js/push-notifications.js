/**
 * push-notifications.js
 *
 * Client-side PWA Push Notification helper.
 * Import this in dashboard or any page where you want the opt-in prompt.
 *
 * Usage:
 *   import { initPushNotifications } from './push-notifications.js';
 *   initPushNotifications(user, idToken);
 */

// VAPID public key is injected via a <meta name="vapid-key"> tag in the dashboard HTML.
// To generate keys: npx web-push generate-vapid-keys
// Then add VAPID_PUBLIC_KEY to Vercel env vars and inject below in genz-streak-test.html.
const VAPID_PUBLIC_KEY = (document.querySelector('meta[name="vapid-key"]') || {}).content || '';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map(c => c.charCodeAt(0)));
}

async function getOrCreateSubscription() {
  const sw = await navigator.serviceWorker.ready;
  let sub = await sw.pushManager.getSubscription();
  if (sub) return sub;

  sub = await sw.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
  return sub;
}

async function saveSubscription(user, idToken, subscription) {
  const res = await fetch('/api/update-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idToken,
      uid: user.uid,
      subscription: subscription.toJSON(),
      action: 'push-subscribe',
    }),
  });
  return res.ok;
}

async function removeSubscription(user, idToken) {
  const sw = await navigator.serviceWorker.ready;
  const sub = await sw.pushManager.getSubscription();
  if (sub) await sub.unsubscribe();

  await fetch('/api/update-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, uid: user.uid, action: 'push-unsubscribe' }),
  });
}

/**
 * Show a beautiful notification opt-in prompt.
 * Call this from dashboard after the user has logged in.
 */
export async function initPushNotifications(user, idToken) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('[Push] Not supported in this browser');
    return;
  }

  const permission = Notification.permission;

  // Already denied — don't ask again
  if (permission === 'denied') return;

  // Already granted — just make sure we have a subscription saved
  if (permission === 'granted') {
    try {
      const sub = await getOrCreateSubscription();
      await saveSubscription(user, idToken, sub);
    } catch (e) {
      console.warn('[Push] Could not re-subscribe:', e.message);
    }
    return;
  }

  // Show custom prompt — don't use native browser prompt immediately
  showPushPromptBanner(user, idToken);
}

function showPushPromptBanner(user, idToken) {
  // Check if user already dismissed this banner recently
  const dismissed = localStorage.getItem('speakup-push-dismissed');
  if (dismissed && Date.now() - Number(dismissed) < 7 * 24 * 3600 * 1000) return;

  const banner = document.createElement('div');
  banner.id = 'push-prompt-banner';
  banner.style.cssText = `
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    background: var(--card-bg, #1a1a2e);
    border: 1.5px solid var(--border, #2d2d4e);
    border-radius: 20px; padding: 18px 22px;
    display: flex; align-items: center; gap: 14px;
    max-width: 480px; width: calc(100% - 40px);
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    z-index: 9999; animation: slideUp 0.35s ease;
    font-family: 'Nunito', sans-serif;
  `;

  banner.innerHTML = `
    <style>@keyframes slideUp { from { transform: translateX(-50%) translateY(100px); opacity:0; } to { transform: translateX(-50%) translateY(0); opacity:1; } }</style>
    <span style="font-size:2rem;flex-shrink:0">🔔</span>
    <div style="flex:1">
      <div style="font-weight:800;font-size:0.95rem;color:var(--text,#fff);margin-bottom:2px">Never lose your streak!</div>
      <div style="font-size:0.8rem;color:var(--text-muted,#888)">Get notified when your 🔥 streak is at risk.</div>
    </div>
    <div style="display:flex;gap:8px;flex-shrink:0">
      <button id="push-yes" style="padding:8px 16px;border-radius:20px;background:var(--primary,#D63384);color:white;border:none;font-weight:700;font-size:0.82rem;cursor:pointer;">Enable</button>
      <button id="push-no" style="padding:8px 14px;border-radius:20px;background:transparent;color:var(--text-muted,#888);border:1.5px solid var(--border,#333);font-weight:600;font-size:0.82rem;cursor:pointer;">Not now</button>
    </div>`;

  document.body.appendChild(banner);

  document.getElementById('push-yes').onclick = async () => {
    banner.remove();
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        const sub = await getOrCreateSubscription();
        await saveSubscription(user, idToken, sub);
        showMiniToast('✅ Streak reminders enabled!');
      }
    } catch (e) {
      console.warn('[Push] Permission request failed:', e.message);
    }
  };

  document.getElementById('push-no').onclick = () => {
    banner.remove();
    localStorage.setItem('speakup-push-dismissed', String(Date.now()));
  };
}

function showMiniToast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = `
    position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
    background:var(--card-bg,#1a1a2e);border:1px solid var(--border,#333);
    color:var(--text,#fff);padding:10px 20px;border-radius:12px;
    font-family:Nunito,sans-serif;font-weight:700;font-size:0.88rem;
    z-index:9999;animation:fadeIn 0.3s ease;
    box-shadow:0 4px 20px rgba(0,0,0,0.3);
  `;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

export { removeSubscription };
