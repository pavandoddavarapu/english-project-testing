/**
 * api/images.js  –  Smart Cached Unsplash Image Service
 *
 * GET  /api/images          → returns one random image from cache
 * GET  /api/images?batch=1  → returns the full cached array (admin)
 * GET  /api/images?refill=1 → forces a cache refill
 *
 * Vercel keeps serverless function instances warm for a few minutes,
 * so the module-level `imageCache` array persists across requests
 * within the same instance – giving us free in-memory caching.
 */

// ─── CONFIG ────────────────────────────────────────────────────────────────
const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;

// ─── DYNAMIC QUERY GENERATOR ───────────────────────────────────────────────
// Generates thousands of unique search combinations based on target themes

const VOCAB = {
  objects: ['teapot', 'backpack', 'camera', 'sneaker', 'coffee mug', 'book', 'plant', 'clock', 'chair', 'lamp', 'bicycle', 'guitar', 'headphones', 'sunglasses', 'watch', 'typewriter', 'vase'],
  objMods: ['ceramic', 'leather', 'vintage', 'modern', 'colorful', 'minimalist', 'wooden', 'glass', 'metallic', 'retro', 'elegant'],
  objCtx:  ['on plain background', 'isolated', 'still life', 'clean background', 'minimalism', 'hero shot', 'studio lighting'],

  scenes:  ['park', 'kitchen', 'airport terminal', 'cafe', 'street market', 'train station', 'office', 'classroom', 'subway', 'shopping mall', 'festival', 'gym'],
  scnMods: ['crowded', 'messy', 'busy', 'action packed', 'chaotic', 'bustling', 'lively', 'energetic'],




  styles:  ['photorealistic', 'real photography', 'high quality photo', 'documentary photography']
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateDynamicQuery() {
  const type = Math.floor(Math.random() * 3); // Now 3 categories: Objects, Scenes, Situations
  let query = '';
  
  if (type === 0) {
    query = `${pick(VOCAB.objMods)} ${pick(VOCAB.objects)} ${pick(VOCAB.objCtx)}`;
  } else if (type === 1) {
    query = `${pick(VOCAB.scnMods)} ${pick(VOCAB.scenes)}`;
  } else {
    query = pick(VOCAB.situations);
  }
  
  // 30% chance to append a specific style constraint
  if (Math.random() < 0.3) {
    query += ` ${pick(VOCAB.styles)}`;
  }
  
  return query;
}

const BATCH_SIZE        = 75;   // total images to hold in cache
const LOW_CACHE_THRESH  = 15;   // trigger background refill below this
const PER_QUERY         = 5;    // fetch 5 images per dynamic query
const IMAGE_WIDTH       = 1200; // Unsplash CDN resize param
const IMAGE_HEIGHT      = 800;

// ─── MODULE-LEVEL CACHE (persists across warm invocations) ──────────────────
let imageCache          = [];   // array of { url, alt, category, color }
let usedIndices         = new Set();
let isRefilling         = false;
let lastRefillAt        = 0;
const REFILL_COOLDOWN   = 60_000; // 1 min minimum between refills

// ─── FETCH HELPERS ─────────────────────────────────────────────────────────

async function fetchUnsplashQuery(query, count = PER_QUERY) {
  if (!UNSPLASH_KEY) return [];

  const page = 1 + Math.floor(Math.random() * 5); // randomise page for variety
  const url  = `https://api.unsplash.com/search/photos`
    + `?query=${encodeURIComponent(query)}`
    + `&per_page=${count}`
    + `&page=${page}`
    + `&orientation=landscape`
    + `&content_filter=high`;   // Unsplash content safety filter

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
    });
    if (!res.ok) {
      console.warn(`Unsplash query "${query}" failed: ${res.status}`);
      return [];
    }
    const json = await res.json();
    return (json.results || []).map(photo => ({
      url  : `${photo.urls.raw}&w=${IMAGE_WIDTH}&h=${IMAGE_HEIGHT}&fit=crop&auto=format&q=80`,
      alt  : photo.alt_description || query,
      color: photo.color || '#1a1a2e',
      category: query,
      id   : photo.id,
    }));
  } catch (e) {
    console.error('Unsplash fetch error:', e);
    return [];
  }
}

/**
 * Refill cache up to BATCH_SIZE images by rotating through categories.
 * Called once at cold-start and again when cache runs low.
 */
async function refillCache() {
  if (isRefilling) return;
  const now = Date.now();
  if (now - lastRefillAt < REFILL_COOLDOWN) return;

  isRefilling   = true;
  lastRefillAt  = now;

  console.log('🖼️  Refilling image cache…');

  // Generate unique dynamic queries
  const needed   = BATCH_SIZE - imageCache.length;
  const queries  = Math.ceil(needed / PER_QUERY);
  const selected = Array.from({ length: queries }, () => generateDynamicQuery());

  const results = await Promise.all(selected.map(q => fetchUnsplashQuery(q)));
  const newImgs = results.flat();

  // Deduplicate by id against existing cache
  const existingIds = new Set(imageCache.map(i => i.id));
  const fresh = newImgs.filter(img => img.id && !existingIds.has(img.id));

  imageCache = [...imageCache, ...fresh];
  // Cap total size to prevent unbounded growth
  if (imageCache.length > BATCH_SIZE * 2) {
    imageCache = imageCache.slice(-BATCH_SIZE);
  }
  usedIndices.clear(); // reset rotation when cache is refreshed

  console.log(`✅  Image cache now has ${imageCache.length} images.`);
  isRefilling = false;
}

/**
 * Pick a random image that hasn't been served recently.
 * When all images have been used, reset the rotation.
 */
function pickImage() {
  if (!imageCache.length) return null;

  const available = imageCache
    .map((img, i) => i)
    .filter(i => !usedIndices.has(i));

  if (!available.length) {
    usedIndices.clear();
    return pickImage();
  }

  const idx = available[Math.floor(Math.random() * available.length)];
  usedIndices.add(idx);
  return imageCache[idx];
}

// ─── FALLBACK IMAGES (used when Unsplash key is absent or quota exhausted) ──
// These are stable Unsplash "source" URLs — no key required, no quota.
const FALLBACK_IMAGES = [
  // Simple Objects
  { url: 'https://images.unsplash.com/photo-1577005477439-ebbc64f2165c?w=1200&h=800&fit=crop&auto=format&q=80', alt: 'ceramic teapot on plain background', category: 'Simple Object', color: '#e8e8e8' },
  { url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=1200&h=800&fit=crop&auto=format&q=80', alt: 'leather backpack', category: 'Simple Object', color: '#8B4513' },
  { url: 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=1200&h=800&fit=crop&auto=format&q=80', alt: 'ice cream cone isolated', category: 'Simple Object', color: '#f39c12' },
  { url: 'https://images.unsplash.com/photo-1512152272829-e3139592d56f?w=1200&h=800&fit=crop&auto=format&q=80', alt: 'fast food burger', category: 'Food', color: '#e07b39' },
  { url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1200&h=800&fit=crop&auto=format&q=80', alt: 'white smart watch', category: 'Simple Object', color: '#e0e0e0' },
  { url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1200&h=800&fit=crop&auto=format&q=80', alt: 'headphones on desk', category: 'Simple Object', color: '#2c3e50' },
  { url: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=1200&h=800&fit=crop&auto=format&q=80', alt: 'coffee mug', category: 'Simple Object', color: '#d35400' },
  
  // Busy Scenes
  { url: 'https://images.unsplash.com/photo-1517783999520-f068d7431a60?w=1200&h=800&fit=crop&auto=format&q=80', alt: 'crowded street scene', category: 'Busy Scene', color: '#34495e' },
  { url: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1200&h=800&fit=crop&auto=format&q=80', alt: 'messy desk and students', category: 'Busy Scene', color: '#3498db' },
  { url: 'https://images.unsplash.com/photo-1506012787146-f92b2d7d6d96?w=1200&h=800&fit=crop&auto=format&q=80', alt: 'busy airport terminal', category: 'Busy Scene', color: '#1a2a4a' },
  { url: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200&h=800&fit=crop&auto=format&q=80', alt: 'people in a cafe', category: 'Busy Scene', color: '#8B6F47' },
  { url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&h=800&fit=crop&auto=format&q=80', alt: 'busy open plan office', category: 'Busy Scene', color: '#bdc3c7' },
  
  // Situations
  { url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&h=800&fit=crop&auto=format&q=80', alt: 'group of people working together', category: 'Situation', color: '#2c3e50' },
  { url: 'https://images.unsplash.com/photo-1530099486328-e021101a494a?w=1200&h=800&fit=crop&auto=format&q=80', alt: 'friends laughing', category: 'Situation', color: '#f39c12' },
  { url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&h=800&fit=crop&auto=format&q=80', alt: 'musician playing guitar', category: 'Situation', color: '#8e44ad' }
];

let globalFallbackIdx = 0;

// ─── HANDLER ────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  // Force refill if requested or first cold start
  if (req.query.refill === '1' || imageCache.length === 0) {
    await refillCache();
  }

  // Async background refill when cache is running low (non-blocking)
  if (imageCache.length < LOW_CACHE_THRESH && !isRefilling) {
    refillCache().catch(console.error); // fire-and-forget
  }

  // Return full batch for admin/debug
  if (req.query.batch === '1') {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ count: imageCache.length, images: imageCache });
  }

  // Return a single image
  const img = UNSPLASH_KEY ? pickImage() : null;

  if (!img) {
    // Serve a fallback (no key or empty cache)
    const fallback = FALLBACK_IMAGES[globalFallbackIdx % FALLBACK_IMAGES.length];
    globalFallbackIdx++;
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ...fallback, source: 'fallback' });
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ ...img, source: 'unsplash', cacheSize: imageCache.length });
}
