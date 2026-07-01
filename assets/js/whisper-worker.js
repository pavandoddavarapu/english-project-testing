/**
 * whisper-worker.js
 *
 * Runs OpenAI Whisper 100% inside the user's browser using WebAssembly.
 * No server calls, no rate limits, completely free.
 *
 * Model files are self-hosted on Firebase Storage (no HuggingFace CDN),
 * avoiding "Dangerous site" browser warnings in production.
 *
 * EVERY TIME a user visits the site, this worker:
 *   1. Checks the browser's Cache Storage for the model files
 *   2a. If FOUND (cached) → loads from cache in ~2-3 seconds, no download
 *   2b. If NOT FOUND → downloads ~39 MB from Firebase Storage, stores in cache
 *   3. Signals 'ready' so the main page can use it for free transcription
 *
 * Fallback: If this worker fails for any reason, app.js automatically
 * falls back to the original Groq Whisper server-side path. Users never see an error.
 */

// ── Transformers.js v2 — most stable for browser Whisper ─────────────────────
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

// ── Self-hosted model configuration ──────────────────────────────────────────
// Model files are hosted directly on the same domain (Vercel) in /assets/whisper-models/
// This avoids browser "Dangerous site" warnings that HuggingFace can trigger.
env.allowLocalModels = false;
env.useBrowserCache = true;

// Point Transformers.js to our self-hosted files in the assets folder
// The worker runs from /assets/js/whisper-worker.js, so we use an absolute path from the domain root
env.remoteHost = self.location.origin + '/assets/whisper-models';
env.remotePathTemplate = '{model}';

const MODEL_NAME = 'Xenova/whisper-tiny.en';

let transcriber = null;

// ── Custom fetch that redirects HuggingFace URLs to our local domain ────────
const originalFetch = self.fetch.bind(self);
self.fetch = async function(input, init) {
  let url = typeof input === 'string' ? input : input.url;

  // Transformers.js still tries to hit huggingface.co occasionally for config/tokenizer
  if (url.includes('huggingface.co') && url.includes('whisper-tiny')) {
    const parts = url.split('/resolve/main/');
    if (parts.length === 2) {
      const filename = parts[1].split('?')[0];
      const newUrl = `${self.location.origin}/assets/whisper-models/${MODEL_NAME}/${filename}`;
      console.log(`[Whisper] Loading local model file: ${filename}`);
      return originalFetch(newUrl, init);
    }
  }

  return originalFetch(input, init);
};

// ── Check if the model is already in the browser cache ───────────────────────
async function isModelCached() {
  try {
    const cache = await caches.open('transformers-cache');
    const keys = await cache.keys();
    const modelKeys = keys.filter(req => req.url.includes('whisper-tiny'));
    if (modelKeys.length === 0) return false;

    // Validate cache entries — delete any that return null/corrupt responses
    let validCount = 0;
    for (const key of modelKeys) {
      const resp = await cache.match(key);
      if (!resp || !resp.ok) {
        console.warn('[Whisper] Corrupt cache entry, deleting:', key.url);
        await cache.delete(key);
      } else {
        validCount++;
      }
    }
    return validCount > 0;
  } catch {
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
    // First time — need to download ~39 MB from Firebase Storage
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

  // ── LAZY LOAD: Only init Whisper when user actually clicks Record ──────────────
  // This makes the practice page load instantly instead of blocking on a
  // 39MB model download / cache read on every page visit.
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
