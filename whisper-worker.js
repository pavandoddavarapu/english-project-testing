/**
 * whisper-worker.js
 *
 * Runs OpenAI Whisper 100% inside the user's browser using WebAssembly.
 * No server calls, no rate limits, completely free.
 *
 * Model: Xenova/whisper-tiny.en  (~39 MB, cached after first download)
 * Why Xenova/whisper-tiny.en?
 *   - Most battle-tested model for browser Transformers.js (thousands of users)
 *   - Only 39 MB download vs 145 MB for whisper-base
 *   - 95%+ accuracy for clear English speech
 *   - Runs in 3-8 seconds on most laptops/phones
 *
 * Fallback: If this worker fails for any reason, app.js automatically
 * falls back to the original Groq Whisper server-side path.
 */

// ── Use Transformers.js v2 (most stable for browser Whisper) ──────────────────
// v3 changed APIs; v2.17 is the gold standard for browser ASR
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

// Always use remote models from the HuggingFace CDN (not local filesystem)
env.allowLocalModels = false;
// Store downloaded model files in the browser's Cache Storage permanently
// (user only downloads once, ~39 MB, then it's instant forever)
env.useBrowserCache = true;

let transcriber = null;

// ── Singleton model loader ────────────────────────────────────────────────────
async function getTranscriber() {
  if (transcriber) return transcriber;

  self.postMessage({ type: 'loading', message: 'Downloading Whisper AI (~39 MB, first time only)…' });

  transcriber = await pipeline(
    'automatic-speech-recognition',
    'Xenova/whisper-tiny.en',
    {
      // Report download progress so the UI can show a loading state
      progress_callback: (progress) => {
        if (progress.status === 'downloading') {
          self.postMessage({
            type: 'progress',
            file: progress.file,
            progress: Math.round(progress.progress || 0),
          });
        }
      },
    }
  );

  return transcriber;
}

// ── Message handler ───────────────────────────────────────────────────────────
self.addEventListener('message', async (e) => {
  const { type, audio } = e.data;

  // ── 'load' → preload the model in the background silently
  if (type === 'load') {
    try {
      await getTranscriber();
      self.postMessage({ type: 'ready' });
    } catch (err) {
      console.error('[whisper-worker] Failed to load model:', err);
      self.postMessage({ type: 'error', error: err.message });
    }
  }

  // ── 'transcribe' → convert Float32Array audio → English text
  if (type === 'transcribe') {
    try {
      const model = await getTranscriber();
      self.postMessage({ type: 'transcribing' });

      const result = await model(audio, {
        // Process in 30-second overlapping chunks so long speeches work correctly
        chunk_length_s: 30,
        stride_length_s: 5,
        // Return plain text (no timestamps needed for scoring)
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
