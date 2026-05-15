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
const PEXELS_KEY   = process.env.PEXELS_API_KEY;

// ─── DYNAMIC QUERY GENERATOR ───────────────────────────────────────────────
// Generates thousands of unique search combinations based on target themes

const PICTURE_TALK_PROMPTS = [
    "Cozy bedroom with rain outside",
    "Warm cafe corner with books",
    "Study desk with laptop and coffee",
    "Messy student room",
    "Balcony with tea during sunset",
    "Rainy street at night",
    "Small town road in evening",
    "Train station with empty platform",
    "Night market with warm lights",
    "Bus stop during heavy rain",
    "Old city alley with lanterns",
    "Mountain road during sunrise",
    "Beach with chair and umbrella",
    "Tent beside a lake",
    "Campfire in forest at night",
    "Picnic setup in park",
    "Boat near calm river",
    "Hammock between trees",
    "Snow cabin in mountains",
    "Fishing dock during sunset",
    "Bicycle near mountain trail",
    "Open diary on wooden desk",
    "Half-finished cup of coffee",
    "Open laptop at midnight",
    "Forgotten umbrella on street",
    "Packed suitcase near door",
    "Books scattered on floor",
    "Window with rain drops",
    "Lights glowing in dark room",
    "Old bookshelf with warm lighting",
    "Gaming setup with LED lights",
    "Kitchen late at night",
    "Living room with fireplace",
    "Artist workspace with paintings",
    "Messy kitchen after cooking",
    "Garage filled with random tools",
    "Creative art studio",
    "Supermarket shopping aisle",
    "Bookstore reading corner",
    "Festival street decorations",
    "Backpack with travel items",
    "Camping gear near tent",
    "Desk full of notebooks",
    "Vintage bicycle near cafe",
    "Empty cinema hall",
    "Rooftop with city lights",
    "Sunset view from balcony",
    "Cloudy sky above city",
    "Neon street during rain",
    "Train window mountain view",
    "Ocean waves during sunrise",
    "Street filled with autumn leaves",
    "Small bakery with warm lights",
    "Wooden bridge in forest",
    "Quiet library corner",
    "Cozy coffee shop during rain",
    "Laptop beside window",
    "Vinyl records on table",
    "Morning breakfast table",
    "Street musician setup",
    "Travel map on desk",
    "Polaroid photos on wall",
    "Empty classroom after school",
    "Candles and books aesthetic",
    "Tea stall during monsoon",
    "Street food market",
    "Park bench under tree",
    "Garden with flowers and lights",
    "City skyline at night",
    "Desert road trip scene",
    "Road with cherry blossom trees",
    "Flower shop interior",
    "Music room with guitar",
    "Retro arcade room",
    "Corner desk with plants",
    "Boat dock during fog",
    "Mountain campsite morning view",
    "Lighthouse near ocean",
    "Rainy car window view",
    "Wooden cabin interior",
    "Open notebook beside coffee",
    "Library table with lamp",
    "Cafe table beside window",
    "Street crossing in Tokyo style",
    "Night highway from car",
    "Countryside road with bicycle",
    "Lantern-lit street",
    "Abandoned train tracks",
    "Rain puddles reflecting lights",
    "Picnic blanket under tree",
    "Village market morning scene",
    "Empty airport waiting area",
    "Workspace with dual monitors",
    "Minimalist room aesthetic",
    "Old camera on wooden table",
    "Forest trail during fog",
    "Rooftop movie night setup",
    "Chess board in cafe",
    "Raincoat hanging near door",
    "Open suitcase with clothes",
    "Firewood beside campfire",
    "Snowfall outside cabin window",
    "Moonlit beach scene",
    "Wooden dock with canoe",
    "Street with bicycles parked",
    "Tiny bookstore alley",
    "Vintage train compartment",
    "Candlelight dinner setup",
    "Laptop and headphones on desk",
    "Quiet subway station",
    "Rainy evening convenience store",
    "Bedroom with fairy lights",
    "Cozy attic workspace",
    "Lake surrounded by mountains",
    "Roadside diner at night",
    "Warm soup on table",
    "Wooden swing in garden",
    "Cloudy weather from apartment window",
    "Empty parking lot during rain",
    "Street cafe during winter",
    "Piano in dimly lit room",
    "Camping van near forest",
    "Coffee machine in kitchen",
    "Old typewriter on desk",
    "Night sky full of stars",
    "Art supplies on wooden table",
    "Festival lanterns hanging above street",
    "Morning sunlight through curtains",
    "Bridge over calm river",
    "Hidden cafe in alley",
    "Movie projector setup",
    "Street after rainfall",
    "Cozy reading nook",
    "Tea and cookies on table",
    "Forest cabin with smoke chimney",
    "Bicycle basket with flowers",
    "Rainy rooftop city view",
    "Sunlight in quiet library",
    "Notebook with handwritten notes",
    "Small garden cafe",
    "Winter street with lights",
    "Clouds visible from airplane window",
    "Countryside train crossing",
    "Desk setup with plants",
    "Night camping under stars",
    "Vintage radio beside window",
    "Messy creative workspace",
    "Hiking shoes near backpack",
    "Cafe menu board aesthetic",
    "Wooden staircase with lights",
    "Street with colorful umbrellas",
    "Quiet beach during evening",
    "Open terrace with plants",
    "Reading chair beside lamp",
    "Train passing through snowy mountains",
    "Indoor plants near sunny window",
    "Street lined with small shops",
    "Notebook and fountain pen",
    "Warm blanket and coffee setup",
    "Foggy morning road",
    "Skateboard near staircase",
    "Old town during sunset",
    "Music headphones beside laptop",
    "Ice cream truck near beach",
    "Cooking ingredients on kitchen counter",
    "Mountain lake reflection",
    "Cozy rainy afternoon room",
    "Open sketchbook on desk",
    "Rural village evening scene",
    "Decorated room during festival",
    "Road trip supplies in car",
    "Quiet rooftop during sunset",
    "Wooden cafe aesthetic interior",
    "Old lantern beside books",
    "Seaside cafe during morning",
    "Cabin with glowing windows",
    "Photography camera setup",
    "Street market with fruits",
    "Long empty highway",
    "Comfortable sofa with blanket",
    "Warm lights in bookstore",
    "Travel backpack beside train seat"
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateDynamicQuery() {
  return pick(PICTURE_TALK_PROMPTS);
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

// ─── PEXELS FALLBACK API ───────────────────────────────────────────────────
// Uses the exact same dynamic queries so images remain highly descriptive
async function fetchPexelsFallback(query, count = PER_QUERY) {
  if (!PEXELS_KEY) return [];

  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: PEXELS_KEY },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.photos || []).map(photo => ({
      url: photo.src.large, // Pexels provides pre-sized URLs
      alt: photo.alt || query,
      color: photo.avg_color || '#e8e8e8',
      category: query,
      id: `pexels-${photo.id}`,
    }));
  } catch (e) {
    console.error('Pexels fetch error:', e);
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

  const needed   = BATCH_SIZE - imageCache.length;
  let newImgs = [];

  if (UNSPLASH_KEY) {
    // Generate unique dynamic queries
    const queries  = Math.ceil(needed / PER_QUERY);
    const selected = Array.from({ length: queries }, () => generateDynamicQuery());
    const results = await Promise.all(selected.map(q => fetchUnsplashQuery(q)));
    newImgs = results.flat();
  }

  // If Unsplash failed (quota) or no key, use Pexels API to maintain quality/context
  if (newImgs.length === 0 && PEXELS_KEY) {
    console.log('Using Pexels fallback API...');
    const queries  = Math.ceil(needed / PER_QUERY);
    const selected = Array.from({ length: queries }, () => generateDynamicQuery());
    const results = await Promise.all(selected.map(q => fetchPexelsFallback(q)));
    newImgs = results.flat();
  }

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
  { url: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=1200&h=800&fit=crop&auto=format&q=80', alt: 'coffee mug', category: 'Simple Object', color: '#d35400' }
];

let globalFallbackIdx = Math.floor(Math.random() * FALLBACK_IMAGES.length);

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
  const img = pickImage();

  if (!img) {
    // Serve a hardcoded fallback (if both Unsplash and Pexels fail)
    const fallback = FALLBACK_IMAGES[globalFallbackIdx % FALLBACK_IMAGES.length];
    globalFallbackIdx++;
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ...fallback, source: 'hardcoded-fallback' });
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ ...img, source: img.id && img.id.startsWith('pexels') ? 'pexels' : 'unsplash', cacheSize: imageCache.length });
}
