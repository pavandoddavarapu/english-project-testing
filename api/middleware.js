/**
 * api/middleware.js
 * 
 * Shared production middleware for all API endpoints.
 * Provides: CORS origin locking, IP-based rate limiting, error sanitization.
 */

import crypto from 'crypto';

// ── 1. CORS ORIGIN LOCK ────────────────────────────────────────────────────
// Set ALLOWED_ORIGINS in Vercel env vars (comma-separated).
// Example: "https://english-project-testing.vercel.app,https://speakup.yourdomain.com"
// If not set, defaults to '*' (development mode).
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

export function setCorsHeaders(req, res) {
  // Generate a unique Request ID for log correlation
  const requestId = crypto.randomBytes(4).toString('hex');
  req.requestId = requestId;

  const origin = req.headers.origin || '';
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
             req.headers['x-real-ip'] ||
             req.socket?.remoteAddress ||
             'unknown';

  const method = req.method || 'GET';
  const url = (req.url || '/').split('?')[0];

  console.log(`📡 [${requestId}] ${method} ${url} - IP: ${ip}`);

  if (ALLOWED_ORIGINS.length > 0) {
    // Production mode: only allow listed origins
    if (ALLOWED_ORIGINS.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    } else if (!origin) {
      // Server-to-server calls (no browser origin) — allow internal Vercel calls
      res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
    }
  } else {
    // Development mode: no ALLOWED_ORIGINS configured, allow everything
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Worker-Secret');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('X-Request-Id', requestId);
}


// ── 2. IP-BASED RATE LIMITING ───────────────────────────────────────────────
// In-memory rate limiter. Works within a single warm Vercel instance.
// Not globally perfect (different instances have separate stores), but catches
// most abuse patterns and is completely free (no Redis needed).
const rateLimitStore = new Map();
let lastCleanup = Date.now();

function cleanupStaleEntries() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return; // run cleanup at most once per minute
  lastCleanup = now;
  for (const [key, entry] of rateLimitStore) {
    if (now - entry.windowStart > 120_000) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Returns true if the request is allowed, false if rate-limited (429 already sent).
 * @param {object} req 
 * @param {object} res 
 * @param {{ maxRequests?: number, windowMs?: number }} options 
 */
export function checkRateLimit(req, res, { maxRequests = 10, windowMs = 60_000 } = {}) {
  cleanupStaleEntries();

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
             req.headers['x-real-ip'] ||
             req.socket?.remoteAddress ||
             'unknown';

  const endpoint = (req.url || '/unknown').split('?')[0];
  const key = `${ip}:${endpoint}`;
  const now = Date.now();

  let entry = rateLimitStore.get(key);
  if (!entry || now - entry.windowStart > windowMs) {
    entry = { count: 0, windowStart: now };
    rateLimitStore.set(key, entry);
  }

  entry.count++;

  if (entry.count > maxRequests) {
    const retryAfter = Math.ceil((entry.windowStart + windowMs - now) / 1000);
    res.setHeader('Retry-After', String(retryAfter));
    res.status(429).json({ error: 'Too many requests. Please slow down and try again.' });
    return false; // blocked
  }

  return true; // allowed
}


// ── 3. ERROR SANITIZATION ───────────────────────────────────────────────────
// Never return raw error messages (e.g. DB connection strings, API key info) to clients.

const GENERIC_MESSAGES = {
  400: 'Invalid request. Please check your input.',
  401: 'Authentication required.',
  403: 'Access denied.',
  404: 'Not found.',
  405: 'Method not allowed.',
  429: 'Too many requests. Please slow down.',
  500: 'Something went wrong. Please try again later.',
};

/**
 * Logs the full error server-side, returns a generic message to the client.
 * @param {object} res 
 * @param {number} statusCode 
 * @param {Error|string} err 
 * @param {string} logPrefix - e.g. '[analyze]'
 */
export function safeError(res, statusCode, err, logPrefix = '[API]') {
  const message = typeof err === 'string' ? err : (err?.message || 'Unknown error');
  console.error(`${logPrefix} Error:`, message);
  return res.status(statusCode).json({
    error: GENERIC_MESSAGES[statusCode] || 'An unexpected error occurred.'
  });
}


// ── 4. INPUT SANITIZATION HELPERS ───────────────────────────────────────────

/** Trim and truncate a string to maxLen characters. Returns '' if input is falsy. */
export function sanitizeString(input, maxLen = 255) {
  if (!input || typeof input !== 'string') return '';
  return input.trim().substring(0, maxLen);
}

/** Clamp a number between min and max. Returns 0 if NaN. */
export function clampInt(value, min = 0, max = 100) {
  const num = Number(value);
  if (isNaN(num)) return 0;
  return Math.min(max, Math.max(min, Math.round(num)));
}


// ── 5. WORKER AUTH ──────────────────────────────────────────────────────────
// Protects internal-only endpoints (process-queue) from being called externally.
const WORKER_SECRET = process.env.WORKER_SECRET || '';

/** Returns the worker secret to include in internal fetch calls. */
export function getWorkerSecret() {
  return WORKER_SECRET;
}

/** Verifies the worker secret header. Returns true if valid or if no secret is configured. */
export function verifyWorkerSecret(req) {
  if (!WORKER_SECRET) return true; // No secret configured = dev mode, allow all
  return req.headers['x-worker-secret'] === WORKER_SECRET;
}
