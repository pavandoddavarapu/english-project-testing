/* =============================================
   image-cache.js  –  Picture Talk Image Engine
   Speak Up! English Practice App

   This module manages the "Picture Talk" tab:
   - Fetches & pre-loads images from /api/images
   - Maintains a client pool for instant delivery
   - Crossfades between images inside #picture-display-area
   - Shows skeleton shimmer while loading
   - Completely independent from the word/topic tabs
   ============================================= */

const PictureTalk = (() => {

  // ─── CONSTANTS ──────────────────────────────────────────────────
  const POOL_SIZE       = 4;    // images to preload ahead of time
  const LOW_POOL_THRESH = 2;    // refill when pool drops below this
  const FETCH_TIMEOUT   = 9000; // ms before giving up on a fetch

  // ─── STATE ──────────────────────────────────────────────────────
  let pool         = [];    // { url, alt, category, color }
  let isFetching   = false;
  let activeLayer  = 'a';   // 'a' or 'b'
  let currentImage = null;
  let initialized  = false;

  // ─── DOM REFS (resolved lazily after DOM is ready) ──────────────
  const el = () => ({
    skeleton  : document.getElementById('picture-skeleton'),
    layerA    : document.getElementById('picture-layer-a'),
    layerB    : document.getElementById('picture-layer-b'),
    prompt    : document.getElementById('picture-speak-prompt'),
    catPill   : document.getElementById('picture-cat-label'),
  });

  // ─── FALLBACK IMAGES (no API key / quota exhausted) ─────────────
  const FALLBACKS = [
    // Simple Objects
    { url: 'https://images.unsplash.com/photo-1577005477439-ebbc64f2165c?w=1400&h=900&fit=crop&auto=format&q=80', alt: 'ceramic teapot on plain background', category: 'Simple Object' },
    { url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=1400&h=900&fit=crop&auto=format&q=80', alt: 'leather backpack', category: 'Simple Object' },
    { url: 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=1400&h=900&fit=crop&auto=format&q=80', alt: 'ice cream cone isolated', category: 'Simple Object' },
    { url: 'https://images.unsplash.com/photo-1512152272829-e3139592d56f?w=1200&h=800&fit=crop&auto=format&q=80', alt: 'fast food burger', category: 'Food' },
    { url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1200&h=800&fit=crop&auto=format&q=80', alt: 'white smart watch', category: 'Simple Object' },
    { url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1200&h=800&fit=crop&auto=format&q=80', alt: 'headphones on desk', category: 'Simple Object' },
    { url: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=1200&h=800&fit=crop&auto=format&q=80', alt: 'coffee mug', category: 'Simple Object' },
    
    // Busy Scenes
    { url: 'https://images.unsplash.com/photo-1517783999520-f068d7431a60?w=1400&h=900&fit=crop&auto=format&q=80', alt: 'crowded street scene', category: 'Busy Scene' },
    { url: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1400&h=900&fit=crop&auto=format&q=80', alt: 'messy desk and students', category: 'Busy Scene' },
    { url: 'https://images.unsplash.com/photo-1506012787146-f92b2d7d6d96?w=1400&h=900&fit=crop&auto=format&q=80', alt: 'busy airport terminal', category: 'Busy Scene' },
    { url: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200&h=800&fit=crop&auto=format&q=80', alt: 'people in a cafe', category: 'Busy Scene' },
    { url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&h=800&fit=crop&auto=format&q=80', alt: 'busy open plan office', category: 'Busy Scene' },
    
    // Situations
    { url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&h=800&fit=crop&auto=format&q=80', alt: 'group of people working together', category: 'Situation' },
    { url: 'https://images.unsplash.com/photo-1530099486328-e021101a494a?w=1200&h=800&fit=crop&auto=format&q=80', alt: 'friends laughing', category: 'Situation' },
    { url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&h=800&fit=crop&auto=format&q=80', alt: 'musician playing guitar', category: 'Situation' }
  ];
  let fallbackIdx = Math.floor(Math.random() * FALLBACKS.length);

  // ─── FETCH ONE IMAGE FROM SERVER ────────────────────────────────
  async function fetchOne() {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    try {
      const res = await fetch('/api/images', { signal: controller.signal });
      clearTimeout(tid);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      clearTimeout(tid);
      return null;
    }
  }

  // Pre-decode the image so it's cached by the browser before display
  function preload(imgData) {
    return new Promise(resolve => {
      if (!imgData) { resolve(null); return; }
      const img = new Image();
      img.onload  = () => resolve(imgData);
      img.onerror = () => resolve(null);
      img.src = imgData.url;
    });
  }

  // ─── POOL MANAGEMENT ────────────────────────────────────────────
  async function fillPool() {
    if (isFetching) return;
    isFetching = true;

    const needed = POOL_SIZE - pool.length;
    const promises = [];
    for (let i = 0; i < needed; i++) {
      promises.push(
        fetchOne().then(raw => preload(raw))
      );
    }
    const results = await Promise.all(promises);
    results.forEach(img => { if (img) pool.push(img); });

    console.log(`🖼️ PictureTalk pool: ${pool.length} ready`);
    isFetching = false;
  }

  function pickFromPool() {
    if (!pool.length) return null;
    const idx = Math.floor(Math.random() * pool.length);
    const img = pool.splice(idx, 1)[0];
    if (pool.length < LOW_POOL_THRESH) fillPool().catch(console.error);
    return img;
  }

  // Get a fallback image (cycles through the array)
  function getFallback() {
    const img = FALLBACKS[fallbackIdx % FALLBACKS.length];
    fallbackIdx++;
    return img;
  }

  // ─── SKELETON ───────────────────────────────────────────────────
  function showSkeleton() {
    const { skeleton, prompt } = el();
    if (skeleton) skeleton.classList.remove('hidden');
    if (prompt)   prompt.classList.add('hidden');
  }

  function hideSkeleton() {
    const { skeleton, prompt } = el();
    if (skeleton) skeleton.classList.add('hidden');
    if (prompt)   prompt.classList.remove('hidden');
  }

  // ─── CROSSFADE DISPLAY ──────────────────────────────────────────
  function applyImage(imgData) {
    const { layerA, layerB, catPill } = el();
    if (!layerA || !layerB) return;

    const nextLayer = activeLayer === 'a' ? 'b' : 'a';
    const nextEl    = nextLayer === 'a' ? layerA : layerB;
    const activeEl  = activeLayer === 'a' ? layerA : layerB;

    // Set the background on the incoming layer BEFORE fading it in
    nextEl.style.backgroundImage = `url(${imgData.url})`;
    // Small tick delay so the browser paints the background first
    requestAnimationFrame(() => {
      nextEl.classList.add('visible');
      activeEl.classList.remove('visible');
    });

    activeLayer = nextLayer;
    currentImage = imgData;

    // Update category pill
    if (catPill) {
      const cat = imgData.category || 'Photo';
      catPill.textContent = `📍 ${capitalize(cat)}`;
    }

    hideSkeleton();
  }

  // ─── PUBLIC API ─────────────────────────────────────────────────

  /** Call once when the user switches to Picture Talk tab */
  async function init() {
    if (initialized && currentImage) {
      // Already have an image, just make sure it's visible
      hideSkeleton();
      return;
    }
    initialized = true;
    showSkeleton();

    // Kick off pool fill in background
    fillPool().catch(console.error);

    // Fetch first image (could come from pool after fillPool, or direct fetch)
    const raw    = await fetchOne();
    const loaded = raw ? await preload(raw) : null;
    const img    = loaded || getFallback();
    // Make sure the layer is not pre-loaded yet
    applyImage(img);
  }

  /** Spin to next image — called when Spin button clicked in picture tab */
  async function next() {
    showSkeleton();

    let img = pickFromPool();
    if (!img) {
      // Pool empty — fetch synchronously with short timeout
      const raw = await fetchOne();
      img = raw ? await preload(raw) : null;
    }

    // Final fallback
    if (!img) img = getFallback();

    // Tiny delay so skeleton shimmer is visible for at least one frame
    setTimeout(() => applyImage(img), 80);
  }

  function getCurrent() { return currentImage; }

  // ─── UTIL ───────────────────────────────────────────────────────
  function capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  }

  return { init, next, getCurrent };

})();

window.PictureTalk = PictureTalk;
