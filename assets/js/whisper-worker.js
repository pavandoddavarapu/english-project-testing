/**
 * whisper-worker.js
 *
 * Runs OpenAI Whisper 100% inside the user's browser using WebAssembly.
 * No server calls, no rate limits, completely free.
 *
 * EVERY TIME a user visits the site, this worker:
 *   1. Checks the browser's Cache Storage for the model files
 *   2a. If FOUND (cached) → loads from cache in ~2-3 seconds, no download
 *   2b. If NOT FOUND → downloads ~39 MB from HuggingFace CDN, stores in cache
 *   3. Signals 'ready' so the main page can use it for free transcription
 *
 * Fallback: If this worker fails for any reason, app.js automatically
 * falls back to the original Groq Whisper server-side path. Users never see an error.
 */

// ── Transformers.js v2 — most stable for browser Whisper ─────────────────────
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

// Never try to load from local filesystem — always use the HuggingFace CDN.
env.allowLocalModels = false;
// Store downloaded model files in the browser's Cache Storage permanently.
// Transformers.js uses the 'transformers-cache' Cache Storage bucket.
// On every visit: checks cache first → only downloads if not found.
env.useBrowserCache = true;

const MODEL_NAME = 'Xenova/whisper-tiny.en';
// Key file to check in Cache Storage to determine if model is already downloaded.
// Transformers.js stores files with their CDN URL as the cache key.
const MODEL_CACHE_CHECK_URL = 'https://huggingface.co/Xenova/whisper-tiny.en/resolve/main/config.json';

let transcriber = null;

// ── Check if the model is already in the browser cache ───────────────────────
async function isModelCached() {
  try {
    // Transformers.js v2 uses 'transformers-cache' as the Cache Storage name
    const cache = await caches.open('transformers-cache');
    const keys = await cache.keys();
    // If any cached key contains our model name, it's already downloaded
    return keys.some(req => req.url.includes('whisper-tiny'));
  } catch {
    // Cache API not available (very rare) — assume not cached
    return false;
  }
}

// ── Singleton model loader ────────────────────────────────────────────────────
async function getTranscriber() {
  // Already loaded in memory this session — return immediately
  if (transcriber) return transcriber;

  // Check cache BEFORE starting the pipeline so we can show the right message
  const cached = await isModelCached();

  if (cached) {
    // Model files exist in browser cache → fast load, no network needed
    self.postMessage({
      type: 'loading',
      cached: true,
      message: '⚡ Loading Whisper from cache…',
    });
  } else {
    // First time — need to download ~39 MB
    self.postMessage({
      type: 'loading',
      cached: false,
      message: '⬇️ Downloading Whisper AI (39 MB, one time only)…',
    });
  }

  let downloadStarted = false;

  transcriber = await pipeline(
    'automatic-speech-recognition',
    MODEL_NAME,
    {
      // Track download progress — only fires when actually downloading (not cached)
      progress_callback: (progress) => {
        if (progress.status === 'downloading') {
          if (!downloadStarted) {
            downloadStarted = true;
            self.postMessage({ type: 'downloading' });
          }
          self.postMessage({
            type: 'progress',
            file: progress.file,
            progress: Math.round(progress.progress || 0),
          });
        }
        // 'initiate' fires when loading from cache (no download progress)
        if (progress.status === 'initiate' && cached) {
          self.postMessage({ type: 'cache_hit', file: progress.file });
        }
      },
    }
  );

  return transcriber;
}

// ── Message handler ───────────────────────────────────────────────────────────
self.addEventListener('message', async (e) => {
  const { type, audio } = e.data;

  // ── 'load': Called on every page visit.
  //    Checks cache → loads from cache or downloads → signals 'ready'.
  if (type === 'load') {
    try {
      await getTranscriber();
      self.postMessage({ type: 'ready' });
    } catch (err) {
      console.error('[whisper-worker] Failed to load model:', err);
      self.postMessage({ type: 'error', error: err.message });
    }
  }

  // ── 'transcribe': Convert Float32Array audio → English text (100% local)
  if (type === 'transcribe') {
    try {
      const model = await getTranscriber();
      self.postMessage({ type: 'transcribing' });

      const result = await model(audio, {
        // Process in 30-second overlapping chunks so long speeches work correctly
        chunk_length_s: 30,
        stride_length_s: 5,
        // Return plain text only (no timestamps needed for scoring)
        return_timestamps: false,
      });

      const text = (result.text || '').trim();
      self.postMessage({ type: 'complete', text });

    } catch (err) {
      console.error('[whisper-worker] Transcription failed:', err);
      self.postMessage({ type: 'error', error: err.message });
    }
  }
});
