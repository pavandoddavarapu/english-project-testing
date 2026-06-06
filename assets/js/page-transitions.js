/**
 * page-transitions.js
 * 
 * Intercepts all internal link clicks to add a smooth animated top progress
 * bar + page fade-out before navigating, and a fade-in on load.
 * Works on every page that includes this script.
 * 
 * Mobile-optimized: uses rAF instead of setInterval for smoother animation.
 */

(function () {
  // Inject the progress bar element into the DOM
  function createProgressBar() {
    if (document.getElementById('speakup-progress-bar')) return;
    const bar = document.createElement('div');
    bar.id = 'speakup-progress-bar';
    document.body.insertBefore(bar, document.body.firstChild);
  }

  function startProgress(bar) {
    bar.style.width = '0%';
    bar.classList.add('loading');
    // Use rAF instead of setInterval for GPU-friendly animation
    let pct = 0;
    let rafId = null;
    let lastTime = performance.now();
    function step(now) {
      if (pct < 85) {
        // Throttle to ~20fps updates (50ms) to match original timing
        if (now - lastTime >= 50) {
          pct += pct < 30 ? 8 : pct < 60 ? 4 : 1;
          bar.style.width = pct + '%';
          lastTime = now;
        }
        rafId = requestAnimationFrame(step);
      }
    }
    rafId = requestAnimationFrame(step);
    return rafId;
  }

  function completeProgress(bar, rafId) {
    if (rafId) cancelAnimationFrame(rafId);
    bar.style.width = '100%';
    setTimeout(() => {
      bar.classList.remove('loading');
      bar.style.width = '0%';
    }, 300);
  }

  function isSameSite(href) {
    try {
      const url = new URL(href, window.location.href);
      return url.hostname === window.location.hostname;
    } catch (e) {
      return true;
    }
  }

  function isExternalOrJavaScript(href) {
    if (!href) return true;
    if (href.startsWith('#')) return true;
    if (href.startsWith('javascript:')) return true;
    if (href.startsWith('mailto:') || href.startsWith('tel:')) return true;
    return false;
  }

  document.addEventListener('DOMContentLoaded', function () {
    createProgressBar();
    const bar = document.getElementById('speakup-progress-bar');

    // Use event delegation on body — single listener for all links
    document.body.addEventListener('click', function (e) {
      // Find the nearest anchor
      const link = e.target.closest('a[href]');
      if (!link) return;

      const href = link.getAttribute('href');

      // Skip external links, hash links, JS links
      if (isExternalOrJavaScript(href)) return;
      if (!isSameSite(href)) return;

      // Skip if modifier keys pressed (open in new tab etc.)
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      // Skip target="_blank"
      if (link.target && link.target !== '_self' && link.target !== '') return;

      e.preventDefault();

      // Start progress bar animation
      const rafId = startProgress(bar);

      // Start page exit animation
      document.body.classList.add('speakup-page-exit');

      // Navigate after the exit animation completes
      // Shorter delay on mobile for snappier feel
      const isMobile = window.innerWidth <= 768;
      setTimeout(() => {
        completeProgress(bar, rafId);
        window.location.href = href;
      }, isMobile ? 120 : 200);
    });
  });
})();
