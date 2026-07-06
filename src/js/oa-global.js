// ============================================================
// 1. GSAP GUARD + REGISTER PLUGINS
// ============================================================
// Fail-open: GSAP comes from Webflow's auto-updating integration. If it or
// CustomEase is ever missing (integration toggled, script blocked, publish
// glitch), a bare registerPlugin() throws and this whole file dies — the
// loader never dismisses and the nav/content stay hidden (their reveal gates
// on .loader-complete). Degrade instead: reveal the page, run the GSAP-free
// features, skip animation.
var oaGsapOk = !!(window.gsap && window.CustomEase);
if (oaGsapOk) {
  gsap.registerPlugin(CustomEase);

  // ============================================================
  // 2. CUSTOM EASES
  // ============================================================
  CustomEase.create("slideshow-wipe", "0.625, 0.05, 0, 1");
  CustomEase.create("loader", "0.65, 0.01, 0.05, 0.99");
} else {
  console.warn('[OA] GSAP unavailable — revealing page without animations.');
}


// ============================================================
// 3. SMOOTH SCROLL (Lenis)
// ============================================================
function initSmoothScroll() {
  if (typeof Lenis === 'undefined') return; // CDN failed — fall back to native scroll
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const lenis = new Lenis({
    autoRaf: false,   // gsap.ticker drives the loop instead (single RAF)
    syncTouch: false, // native touch scroll on mobile — no Swiper conflict
    anchors: true,    // smooth in-page anchor links (/all-products)
    lerp: 0.2,        // smoothing intensity (0.1 default is floatier; lower = smoother)
  });
  window.lenis = lenis; // expose for the menu scroll-lock in initNavSafariFix

  if (typeof ScrollTrigger !== 'undefined') {
    lenis.on('scroll', ScrollTrigger.update); // future-ready glue, no-op until ScrollTrigger is used
  }
  gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
  gsap.ticker.lagSmoothing(0);

  // Lock scroll during the loader; release when it completes. Robust to the
  // loader being skipped (event already fired synchronously → class present).
  lenis.stop();
  if (document.documentElement.classList.contains('loader-complete')) {
    lenis.start();
  } else {
    document.addEventListener('oa:loader-complete', function () { lenis.start(); }, { once: true });
  }
}


// ============================================================
// 4. PAGE TRANSITION (content fade-through)
// ============================================================
function initPageTransition() {
  const content = document.querySelectorAll('[data-page-transition]');
  if (!content.length) return; // not tagged — feature is a no-op
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const loaderWillRun = !!document.querySelector('[data-load-wrap] [data-load-progress]');

  // --- ENTER: fade content in once the page is actually painted. ---
  // Content starts hidden via the CSS guard in oa-styles.css. Loader pages let
  // the loader own the reveal moment (snap, no double fade); same for reduced
  // motion. Otherwise fade it in.
  const reveal = function () {
    if (loaderWillRun || reduce) {
      gsap.set(content, { autoAlpha: 1 });
    } else {
      gsap.to(content, { autoAlpha: 1, duration: 0.6, ease: 'slideshow-wipe' });
    }
  };

  // Gate the reveal on real readiness, not DOMContentLoaded (which fires before
  // images decode → reveals half-painted content on uncached pages):
  //  - loader pages already wait for window.load → reuse their gate
  //  - other pages → window.load (images decoded), capped so a slow asset
  //    never blocks the reveal; reduced-motion reveals immediately
  if (loaderWillRun) {
    if (document.documentElement.classList.contains('loader-complete')) reveal();
    else document.addEventListener('oa:loader-complete', reveal, { once: true });
  } else if (reduce || document.readyState === 'complete') {
    reveal();
  } else {
    let done = false;
    const go = function () { if (done) return; done = true; reveal(); };
    window.addEventListener('load', go, { once: true });
    setTimeout(go, 1200); // safety cap — never hang on a slow asset
  }

  // --- LEAVE: fade content out, then navigate. Nav stays put. ---
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a');
    if (!a || !a.href || a.target === '_blank' || a.hasAttribute('download')) return;
    if (a.closest('[data-transition-prevent]')) return;
    let url;
    try { url = new URL(a.href, location.href); } catch (_) { return; }
    if (url.origin !== location.origin) return;                  // external
    if (url.pathname === location.pathname && url.hash) return;  // same-page anchor → Lenis
    if (url.href === location.href) return;                      // same page

    e.preventDefault();
    if (window.lenis) window.lenis.stop();
    if (reduce) { location.href = url.href; return; }
    gsap.to(content, {
      autoAlpha: 0,
      duration: 0.45,
      ease: 'slideshow-wipe',
      onComplete: function () { location.href = url.href; },
    });
  });

  // --- bfcache: a restored page must come back visible AND scrollable.
  // The leave handler stopped Lenis before navigating; a bfcache restore keeps
  // the same JS heap, so Lenis returns stopped unless we restart it. ---
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    gsap.set(content, { autoAlpha: 1 });
    if (window.lenis) window.lenis.start();
  });
}


// ============================================================
// 5. SLIDESHOW
// ============================================================
function initSlideShow(el) {
  const thumbsInEl = el.querySelectorAll('[data-slideshow="thumb"]');
  const ui = {
    el,
    slides: Array.from(el.querySelectorAll('[data-slideshow="slide"]')),
    thumbs: Array.from(thumbsInEl.length ? thumbsInEl : document.querySelectorAll('[data-slideshow="thumb"]')), // Intentional: thumbs are siblings of the slideshow element, not children — document scope is correct
  };
  // CMS-driven counts can drift; a mismatch would index past the arrays below.
  if (!ui.slides.length || ui.thumbs.length !== ui.slides.length) return;

  // Parallax layers are optional per slide — resolve from the slide itself, never
  // from a parallel document-order array (counts drifted once: 4 slides, 2 layers).
  const innerOf = slide => slide.querySelector('[data-slideshow="parallax"]');

  let current = 0;
  const length = ui.slides.length;
  let animating = false;
  const animationDuration = 1.5;

  ui.slides.forEach((slide, index) => slide.setAttribute('data-index', index));
  ui.thumbs.forEach((thumb, index) => thumb.setAttribute('data-index', index));

  ui.slides[current].classList.add('is--current');
  ui.thumbs[current].classList.add('is--current');

  function navigate(direction, targetIndex = null) {
    if (animating) return;
    animating = true;

    const previous = current;
    current =
      targetIndex !== null && targetIndex !== undefined ?
      targetIndex :
      direction === 1 ?
      current < length - 1 ? current + 1 : 0 :
      current > 0 ? current - 1 : length - 1;

    const currentSlide = ui.slides[previous];
    const currentInner = innerOf(currentSlide);
    const upcomingSlide = ui.slides[current];
    const upcomingInner = innerOf(upcomingSlide);

    const tl = gsap.timeline({
        defaults: { duration: animationDuration, ease: 'slideshow-wipe' },
        onStart() {
          upcomingSlide.classList.add('is--current');
          ui.thumbs[previous].classList.remove('is--current');
          ui.thumbs[current].classList.add('is--current');
        },
        onComplete() {
          currentSlide.classList.remove('is--current');
          animating = false;
        },
      })
      .to(currentSlide, { xPercent: -direction * 100 }, 0)
      .fromTo(upcomingSlide, { xPercent: direction * 100 }, { xPercent: 0 }, 0);
    if (currentInner) tl.to(currentInner, { xPercent: direction * 75 }, 0);
    if (upcomingInner) tl.fromTo(upcomingInner, { xPercent: -direction * 75 }, { xPercent: 0 }, 0);
  }

  ui.thumbs.forEach(thumb => {
    thumb.addEventListener('click', event => {
      const targetIndex = parseInt(event.currentTarget.getAttribute('data-index'), 10);
      if (targetIndex === current || animating) return;
      const direction = targetIndex > current ? 1 : -1;
      navigate(direction, targetIndex);
    });
  });
}

// ============================================================
// 6. LOADER
// ============================================================
function revealAfterLoader() {
  // w-mod-ix3 is a deliberate IX2 guard: slow IX2 init on mobile otherwise blocks
  // the nav reveal. Load-bearing — see docs/REFERENCE.md "Hard constraints".
  document.documentElement.classList.add('w-mod-ix3');
  document.documentElement.classList.add('loader-complete');
  document.dispatchEvent(new CustomEvent('oa:loader-complete'));
}

function initLogoRevealLoader() {
  const wrap = document.querySelector('[data-load-wrap]');
  if (!wrap) { revealAfterLoader(); return; }

  // No GSAP — hide the overlay and reveal immediately (see guard §1).
  if (!oaGsapOk) { wrap.style.display = 'none'; revealAfterLoader(); return; }

  // Pages without the full animated loader (no inner elements) — reveal immediately.
  const progressBar = wrap.querySelector('[data-load-progress]');
  if (!progressBar) { revealAfterLoader(); return; }

  const container = wrap.querySelector('[data-load-container]');
  const bg = wrap.querySelector('[data-load-bg]');
  const logo = wrap.querySelector('[data-load-logo]');

  // Entrance: branding moment plays immediately (1.5s).
  gsap.set(wrap, { display: 'block' });
  gsap.timeline({ defaults: { ease: 'loader', duration: 1.5 } })
    .to(progressBar, { scaleX: 1 })
    .to(logo, { clipPath: 'inset(0% 0% 0% 0%)' }, '<');

  // Exit: waits for whichever is longer — the 1.5s brand minimum, or (on pages
  // with a hero background video) the video buffering its first frames
  // (oa:hero-media-ready, dispatched by oa-homepage.js on 'canplay') so the
  // reveal never lands on frame-mush. Capped so a stalled CDN can't trap the
  // loader. Deliberate trade-off: the anticipation beat outranks raw TTI here.
  const minDelay = new Promise(resolve => setTimeout(resolve, 1500));
  const pageReady = document.querySelector('[data-bunny-background-init] video') ?
    Promise.race([
      new Promise(resolve => document.addEventListener('oa:hero-media-ready', resolve, { once: true })),
      new Promise(resolve => setTimeout(resolve, 4000)) // cap — slow video must never hold the page hostage
    ]) :
    Promise.resolve();

  Promise.all([minDelay, pageReady]).then(function () {
    gsap.timeline({ defaults: { ease: 'loader' } })
      .to(container, { autoAlpha: 0, duration: 0.5 })
      .to(progressBar, { scaleX: 0, transformOrigin: 'right center', duration: 0.5 }, '<')
      .to(bg, { yPercent: -101, duration: 1 }, '<')
      .set(wrap, { display: 'none' })
      .call(revealAfterLoader);
  });
}

// ============================================================
// 7. SAFARI WEBKIT NAV FIX
// ============================================================
function initNavSafariFix() {
  const navButton = document.querySelector('.w-nav-button');
  const navComponent = document.querySelector('.nav_component');
  if (!navButton || !navComponent) return;

  const observer = new MutationObserver(function () {
    if (navButton.classList.contains('w--open')) {
      navComponent.classList.add('is-open');
      document.body.classList.add('menu-open');
      if (window.lenis) window.lenis.stop();
    } else {
      document.body.classList.remove('menu-open');
      if (window.lenis) window.lenis.start();
      setTimeout(function () {
        if (!navButton.classList.contains('w--open')) {
          navComponent.classList.remove('is-open');
        }
      }, 400);
    }
  });

  observer.observe(navButton, { attributes: true, attributeFilter: ['class'] });
}

function initNavDropdownHover() {
  const items = document.querySelectorAll('.nav_dropdown_link');
  if (!items.length) return;

  const exitMap = {
    top: 'translateY(-100%)',
    bottom: 'translateY(100%)',
    left: 'translateX(-100%)',
    right: 'translateX(100%)'
  };

  function getDirection(e, el) {
    const { left, top, width, height } = el.getBoundingClientRect();
    const x = e.clientX - left;
    const y = e.clientY - top;
    const distances = { top: y, right: width - x, bottom: height - y, left: x };
    return Object.entries(distances).reduce((a, b) => (a[1] < b[1] ? a : b))[0];
  }

  items.forEach(item => {
    const tile = item.querySelector('.nav_dropdown_hover_tile');
    if (!tile) return;

    item.addEventListener('mouseenter', e => {
      const dir = getDirection(e, item);
      tile.style.transition = 'none';
      tile.style.transform = exitMap[dir];
      void tile.offsetHeight;
      tile.style.transition = '';
      tile.style.transform = 'translate(0%, 0%)';
    });

    item.addEventListener('mouseleave', e => {
      const dir = getDirection(e, item);
      tile.style.transform = exitMap[dir];
    });
  });
}

// ============================================================
// 8. INIT ON DOM READY
// ============================================================
// Run the loader immediately, NOT on DOMContentLoaded. This is a footer script so
// the loader markup (near the top of <body>) is already parsed, and GSAP is injected
// ahead of footer code — both ready. DOMContentLoaded is itself held back until the
// heavy footer scripts (hls.js, ~157KB) finish, which delayed the loader ~15s on slow
// connections. Requires oa-global.js to load before hls.js in the footer.
initLogoRevealLoader();

// ============================================================
// 9. STRIP ORPHANED WEBFLOW SCROLL HANDLER
// ============================================================
// The "OA Statement [Scroll]" IX2 interaction (continuous "While scrolling in
// view" on the homepage statement block) is applied site-wide, so Webflow writes
// it into EVERY page's IX2 data (Webflow support ticket open). When IX2 drives it
// via a jQuery scroll handler, pages WITHOUT the block run jQuery .offset()
// against a missing target every frame → forced reflow (~376ms per scroll on the
// long /all-products, ~57fps). Strip the dead handler wherever the block is
// absent; the homepage keeps the real animation.
// NOTE 06-07-2026: the current Webflow runtime no longer binds scroll.webflow at
// all (verified live: zero jQuery scroll handlers on any page, no forced reflow
// in traces — the wipe runs through another driver). This is dormant insurance
// in case a future runtime publish reverts to jQuery binding. The guard selector
// MUST track the statement block's Designer class if it's ever renamed
// (originally .oa_statement_layout, renamed → .oa_statement-home).
function stripOrphanScrollHandler() {
  if (document.querySelector('.oa_statement-home')) return; // block present → keep the real interaction
  const $ = window.jQuery;
  if ($) $(window).off('scroll.webflow');
}

function initLocalTime() {
  const el = document.querySelector('[data-perth-time]');
  if (!el) return; // homepage map card only — no-op elsewhere
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Australia/Perth', hour: '2-digit', minute: '2-digit', hour12: false
  });
  const tick = () => { el.textContent = fmt.format(new Date()); };
  tick();
  setInterval(tick, 30000); // visible minute never more than ~30s stale
}

document.addEventListener('DOMContentLoaded', function () {
  if (!oaGsapOk) {
    // No GSAP: unhide the transition-tagged content the CSS pre-hides, then
    // run only the GSAP-free features.
    document.querySelectorAll('[data-page-transition]').forEach(function (el) {
      el.style.opacity = '1';
      el.style.visibility = 'visible';
    });
    initNavSafariFix();
    initNavDropdownHover();
    initLocalTime();
    return;
  }
  initSmoothScroll();
  initPageTransition();
  document.querySelectorAll('[data-slideshow="wrap"]').forEach(wrap => initSlideShow(wrap));
  initNavSafariFix();
  initNavDropdownHover();
  initLocalTime();
});

// Run after Webflow's modules (incl. IX2) have initialised and bound their
// scroll handler, so the .off() actually has something to remove.
if (window.Webflow && typeof window.Webflow.push === 'function') {
  window.Webflow.push(stripOrphanScrollHandler);
} else {
  window.addEventListener('load', stripOrphanScrollHandler);
}

// The Lumos slider patches (product speed 800/700, homepage
// is-slider-transitioning) moved into oa-slider.js, which now owns the slider
// init. See src/js/oa-slider.js (data-speed-touch, data-raise-on-transition).
