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

// The nav's section links are absolute (`/all-products#tables`) so they work from
// any page — the only correct way to author them for a sitewide nav. But THREE
// separate systems each decide what to do by testing whether the href *starts*
// with "#", and an absolute path fails all three. On /all-products, where these
// resolve to a same-document hash change:
//   1. Webflow's navbar never closes the mobile overlay
//      (webflow.js: `href.indexOf('#') === 0 && open && close()`) — the menu is
//      left stranded over the page while it scrolls underneath.
//   2. Lenis's `anchors` handler never intercepts, so there is no smooth scroll —
//      verified live: zero calls reach lenis.scrollTo on a real link click.
//   3. The browser's own fragment jump ignores the section's scroll-margin-top,
//      landing the heading under the fixed nav — verified with Lenis destroyed.
// None of that is fixable by changing the hrefs, so own the interaction instead.
// Reproduces 100% on /all-products and never from another page — which is why it
// read as intermittent.
function initNavAnchorLinks() {
  const nav = document.querySelector('.nav_component');
  if (!nav) return;
  const navButton = document.querySelector('.w-nav-button');

  document.addEventListener('click', function (e) {
    // NOT gated on e.defaultPrevented — a smooth-scroll library may already have
    // claimed this click, and it is still a legitimate user click.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href]');
    if (!a || !nav.contains(a)) return;
    if (a.target === '_blank' || a.hasAttribute('download')) return;
    let url;
    try { url = new URL(a.href, location.href); } catch (_) { return; }
    if (url.origin !== location.origin) return;
    if (url.pathname !== location.pathname || url.search !== location.search) return; // real navigation
    if (!url.hash) return;
    let target;
    try { target = document.querySelector(url.hash); } catch (_) { return; } // ids starting with a digit aren't valid selectors
    if (!target) return;

    e.preventDefault();
    // Capture phase + stopPropagation: Webflow's own anchor scroll is a
    // document-delegated bubble handler that animates to the target's raw
    // offset, ignoring scroll-margin-top. preventDefault alone does not stop it
    // — it would run after ours and drag the page the last 130px back down.
    e.stopPropagation();

    const scrollToTarget = function () {
      // Clearance under the fixed nav comes from the section's own
      // scroll-margin-top, so it stays one number, editable in the Designer —
      // and it tracks the breakpoint, since this is read live.
      const offset = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
      const y = target.getBoundingClientRect().top + window.scrollY - offset;
      if (window.lenis) window.lenis.scrollTo(y);
      else window.scrollTo({ top: y, behavior: 'smooth' }); // reduced motion / Lenis CDN down
      history.pushState(null, '', url.hash);

      // Native fragment navigation is what moves focus to the target; the
      // preventDefault above kills it. Nobody noticed on section links, but it
      // silently broke the skip link — it scrolled, then left focus on the skip
      // link itself, so the next Tab went back into the nav instead of into the
      // page. Sections aren't focusable, so make the target programmatically
      // focusable; tabindex="-1" keeps it out of the tab order. preventScroll
      // stops the browser issuing its own instant jump on top of the smooth one.
      // wf-force-outline-none is Webflow's own hook for elements it focuses
      // programmatically — without it the project's [tabindex]:focus-visible
      // rule draws a 2px ring around the whole section. It out-specifies that
      // rule, so the fix needs no CSS of ours.
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.classList.add('wf-force-outline-none');
      target.focus({ preventScroll: true });
    };

    // Webflow already closes the menu for hrefs that start with "#", so closing
    // it again for those would toggle it straight back open.
    const mustClose = navButton && navButton.classList.contains('w--open') &&
                      a.getAttribute('href').charAt(0) !== '#';
    if (!mustClose) { scrollToTarget(); return; }

    // Scrolling cannot happen until the menu is actually shut: body.menu-open
    // sets overflow:hidden and initNavSafariFix stops Lenis, so a scroll issued
    // now is silently dropped (even with Lenis's force option). Webflow's toggle
    // is debounced, so the class has not flipped by the next frame either —
    // wait for the flip rather than guessing a delay. initNavSafariFix observes
    // the same attribute and is registered first, so the lock is already
    // released by the time this runs.
    const closed = new MutationObserver(function () {
      if (navButton.classList.contains('w--open')) return;
      closed.disconnect();
      requestAnimationFrame(scrollToTarget);
    });
    closed.observe(navButton, { attributes: true, attributeFilter: ['class'] });
    navButton.click(); // Webflow's own toggle — proper close animation + cleanup
  }, true); // capture — must run before Webflow's delegated anchor-scroll handler
}

// One tile-slide behaviour, two consumers: the nav dropdown links (class hooks,
// all four directions) and the directional list on /about (data hooks, with
// data-type choosing the axis — "y" for a stacked list, "x", or "all").
// Pointer events rather than mouse events so the effect can be scoped to a real
// mouse by pointerType — a device capability — instead of to a breakpoint, which
// gets both an iPad Pro and a touchscreen laptop wrong. Cheaper than two copies
// of the same 25 lines.
function initDirectionalHover() {
  const exitMap = {
    top: 'translateY(-100%)',
    bottom: 'translateY(100%)',
    left: 'translateX(-100%)',
    right: 'translateX(100%)'
  };

  function getDirection(e, el, axis) {
    const { left, top, width, height } = el.getBoundingClientRect();
    const x = e.clientX - left;
    const y = e.clientY - top;
    // A stacked list is only ever entered from above or below in practice, so
    // "y" keeps the fill reading as one continuous vertical motion down the
    // column; nearest-edge would flip it sideways on a slow horizontal entry.
    if (axis === 'y') return y < height / 2 ? 'top' : 'bottom';
    if (axis === 'x') return x < width / 2 ? 'left' : 'right';
    const distances = { top: y, right: width - x, bottom: height - y, left: x };
    return Object.entries(distances).reduce((a, b) => (a[1] < b[1] ? a : b))[0];
  }

  function bind(item, tileSelector, axis) {
    const tile = item.querySelector(tileSelector);
    if (!tile) return;

    const enter = dir => {
      tile.style.transition = 'none';
      tile.style.transform = exitMap[dir];
      void tile.offsetHeight;     // forced reflow to flush the jump
      tile.style.transition = '';  // back to the CSS transition
      tile.style.transform = 'translate(0%, 0%)';
    };
    const leave = dir => { tile.style.transform = exitMap[dir]; };

    // Mouse: in from the edge the cursor crossed, out towards the edge it left by.
    item.addEventListener('pointerenter', e => {
      if (e.pointerType === 'mouse') enter(getDirection(e, item, axis));
    });
    item.addEventListener('pointerleave', e => {
      if (e.pointerType === 'mouse') leave(getDirection(e, item, axis));
    });

    // Touch gets nothing, deliberately. The awards rows are plain divs with no
    // destination, so a fill-on-tap would advertise an affordance that isn't
    // there. Gating on pointerType rather than a breakpoint keeps it honest per
    // device: a touchscreen laptop still hovers, an iPad Pro still doesn't.

    // Keyboard: no coordinates to read, so always from the top. :focus-visible
    // keeps it off a mouse click, and the flag stops a stray blur yanking the
    // tile out from under a cursor that is still hovering.
    let viaKeyboard = false;
    item.addEventListener('focus', () => {
      if (!item.matches(':focus-visible')) return;
      viaKeyboard = true;
      enter('top');
    });
    item.addEventListener('blur', () => {
      if (!viaKeyboard) return;
      viaKeyboard = false;
      leave('top');
    });
  }

  document.querySelectorAll('.nav_dropdown_link')
    .forEach(item => bind(item, '.nav_dropdown_hover_tile', 'all'));

  document.querySelectorAll('[data-directional-hover]').forEach(container => {
    const axis = container.getAttribute('data-type') || 'all';
    container.querySelectorAll('[data-directional-hover-item]')
      .forEach(item => bind(item, '[data-directional-hover-tile]', axis));
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
// NOTE 26-07-2026: load-bearing, NOT dormant — supersedes the 06-07-2026 note
// that claimed the runtime no longer binds scroll.webflow. Verified live: the
// homepage (statement block present → strip returns early) keeps a
// scroll.webflow handler, while /all-products has no scroll binding but still
// has resize/orientationchange/load from that same Webflow call — the
// fingerprint of this .off(). The orphan is also still real: /all-products'
// IX2 data carries 2 SCROLLING_IN_VIEW events with no statement block to drive
// (Webflow ticket still open, nudged 26-07-2026).
// Cost of removing the strip, measured on /all-products (3 rounds, scripted
// scroll, desktop CPU): p95 frame 17.4ms → 33.3ms (one dropped frame in ~20),
// mean +1.2ms, p50 unchanged. The old "~376ms per scroll" figure no longer
// reproduces — the mechanism holds, the severity does not.
// Side effect: this also disables Webflow's scroll-spy w--current on in-page
// anchor links. Deliberate and unused — the mega menu is a dropdown, so an
// active state would only ever be visible on reopen; not worth a per-scroll cost.
// The guard selector MUST track the statement block's Designer class if it's
// ever renamed (originally .oa_statement_layout, renamed → .oa_statement-home).
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
    initNavAnchorLinks();
    initDirectionalHover();
    initLocalTime();
    return;
  }
  initSmoothScroll();
  initPageTransition();
  document.querySelectorAll('[data-slideshow="wrap"]').forEach(wrap => initSlideShow(wrap));
  initNavSafariFix();
  initNavAnchorLinks();
  initDirectionalHover();
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
