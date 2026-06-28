// ============================================================
// 1. REGISTER GSAP PLUGINS
// ============================================================
gsap.registerPlugin(CustomEase);

// ============================================================
// 2. CUSTOM EASES
// ============================================================
CustomEase.create("slideshow-wipe", "0.625, 0.05, 0, 1");
CustomEase.create("loader", "0.65, 0.01, 0.05, 0.99");
CustomEase.create("button-046-ease", "0.32, 0.72, 0, 1");


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
  window.lenis = lenis; // expose for the mobile-menu scroll-lock in initNavigation

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
    inner: Array.from(el.querySelectorAll('[data-slideshow="parallax"]')),
    thumbs: Array.from(thumbsInEl.length ? thumbsInEl : document.querySelectorAll('[data-slideshow="thumb"]')), // Intentional: thumbs are siblings of the slideshow element, not children — document scope is correct
  };

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
    const currentInner = ui.inner[previous];
    const upcomingSlide = ui.slides[current];
    const upcomingInner = ui.inner[current];

    gsap.timeline({
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
      .to(currentInner, { xPercent: direction * 75 }, 0)
      .fromTo(upcomingSlide, { xPercent: direction * 100 }, { xPercent: 0 }, 0)
      .fromTo(upcomingInner, { xPercent: -direction * 75 }, { xPercent: 0 }, 0);
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
  document.documentElement.classList.add('w-mod-ix3');
  document.documentElement.classList.add('loader-complete');
  document.dispatchEvent(new CustomEvent('oa:loader-complete'));
}

function initLogoRevealLoader() {
  const wrap = document.querySelector('[data-load-wrap]');
  if (!wrap) { revealAfterLoader(); return; }

  // Pages without the full animated loader (no inner elements) — reveal immediately.
  const progressBar = wrap.querySelector('[data-load-progress]');
  if (!progressBar) { revealAfterLoader(); return; }

  const container = wrap.querySelector('[data-load-container]');
  const bg = wrap.querySelector('[data-load-bg]');
  const logo = wrap.querySelector('[data-load-logo]');
  const resetTargets = Array.from(wrap.querySelectorAll('[data-load-reset]'));

  if (resetTargets.length) {
    gsap.set(resetTargets, { autoAlpha: 1 });
  }

  // Entrance: branding moment plays immediately (1.5s).
  gsap.set(wrap, { display: 'block' });
  gsap.timeline({ defaults: { ease: 'loader', duration: 1.5 } })
    .to(progressBar, { scaleX: 1 })
    .to(logo, { clipPath: 'inset(0% 0% 0% 0%)' }, '<');

  // Exit: waits for whichever is longer — the 1.5s minimum or window.load.
  const minDelay = new Promise(resolve => setTimeout(resolve, 1500));
  const pageReady = Promise.race([
    new Promise(resolve => {
      if (document.readyState === 'complete') resolve();
      else window.addEventListener('load', resolve, { once: true });
    }),
    new Promise(resolve => setTimeout(resolve, 1200)) // cap the window.load wait; the 1.5s brand minimum below is the real floor
  ]);

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
// 7. NAVIGATION (Osmo Multilevel Nav — adapted)
// Desktop dropdowns are CSS-driven (hover/focus); this layer adds
// click/keyboard/aria + the mobile burger. Mobile open/close also
// drives the Lenis scroll-lock + body.menu-open (parity with the
// old nav fix this replaces).
// ============================================================
function initNavigation() {
  if (!initNavigation._hasResizeListener) {
    initNavigation._hasResizeListener = true;
    window.addEventListener('resize', debounce(initNavigation, 200));
  }

  const isMobile = window.innerWidth < 768;
  if (isMobile && initNavigation._lastMode !== 'mobile') {
    initMobileMenu();
    initNavigation._lastMode = 'mobile';
  } else if (!isMobile && initNavigation._lastMode !== 'desktop') {
    initDesktopDropdowns();
    initNavigation._lastMode = 'desktop';
  }
}

function debounce(fn, delay) {
  let timer;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(fn, delay);
  };
}

function initMobileMenu() {
  const btn = document.querySelector('[data-menu-button]');
  const nav = document.querySelector('[data-menu-status]');
  if (!btn || !nav) return;

  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', 'mobile-navigation');
  nav.setAttribute('id', 'mobile-navigation');
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', 'Main navigation');

  if (!btn._mobileClick) {
    btn._mobileClick = true;
    btn.addEventListener('click', () => {
      const open = nav.dataset.menuStatus === 'open';
      nav.dataset.menuStatus = open ? 'closed' : 'open';
      btn.setAttribute('aria-expanded', String(!open));

      // Scroll-lock: stop Lenis + flag body while the menu is open.
      if (open) {
        document.body.classList.remove('menu-open');
        if (window.lenis) window.lenis.start();
        // Close all dropdowns when closing the menu
        Array.from(document.querySelectorAll('[data-dropdown-toggle]')).forEach(toggle => {
          toggle.dataset.dropdownToggle = 'closed';
          toggle.setAttribute('aria-expanded', 'false');
        });
      } else {
        document.body.classList.add('menu-open');
        if (window.lenis) window.lenis.stop();
      }
    });
  }

  Array.from(document.querySelectorAll('[data-dropdown-toggle]')).forEach((toggle, i) => {
    const dd = toggle.nextElementSibling;
    if (!dd || !dd.classList.contains('nav-dropdown')) return;
    if (toggle._mobileDropdownInit) return;
    toggle._mobileDropdownInit = true;

    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-haspopup', 'true');
    toggle.setAttribute('aria-controls', `dropdown-${i}`);

    dd.setAttribute('id', `dropdown-${i}`);
    dd.setAttribute('role', 'menu');
    dd.querySelectorAll('.nav-dropdown__link')
      .forEach(link => link.setAttribute('role', 'menuitem'));

    toggle.addEventListener('click', () => {
      const open = toggle.dataset.dropdownToggle === 'open';
      Array.from(document.querySelectorAll('[data-dropdown-toggle]'))
        .forEach(other => {
          if (other !== toggle) {
            other.dataset.dropdownToggle = 'closed';
            other.setAttribute('aria-expanded', 'false');
            if (other === document.activeElement) other.blur();
          }
        });
      toggle.dataset.dropdownToggle = open ? 'closed' : 'open';
      toggle.setAttribute('aria-expanded', String(!open));
      if (open && toggle === document.activeElement) toggle.blur();
    });
  });
}

function initDesktopDropdowns() {
  const toggles = Array.from(document.querySelectorAll('[data-dropdown-toggle]'));
  const links = Array.from(document.querySelectorAll('.nav-link:not([data-dropdown-toggle])'));

  toggles.forEach((toggle, i) => {
    const dd = toggle.nextElementSibling;
    if (!dd || !dd.classList.contains('nav-dropdown') || toggle._desktopInit) return;
    toggle._desktopInit = true;

    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-haspopup', 'true');
    toggle.setAttribute('aria-controls', `desktop-dropdown-${i}`);

    dd.setAttribute('id', `desktop-dropdown-${i}`);
    dd.setAttribute('role', 'menu');
    dd.setAttribute('aria-hidden', 'true');
    dd.querySelectorAll('.nav-dropdown__link')
      .forEach(link => link.setAttribute('role', 'menuitem'));

    toggle.addEventListener('click', e => {
      e.preventDefault();
      toggles.forEach(other => {
        if (other !== toggle) {
          other.dataset.dropdownToggle = 'closed';
          other.setAttribute('aria-expanded', 'false');
          const otherDropdown = other.nextElementSibling;
          if (otherDropdown) otherDropdown.setAttribute('aria-hidden', 'true');
        }
      });
      const open = toggle.dataset.dropdownToggle !== 'open';
      toggle.dataset.dropdownToggle = 'open';
      toggle.setAttribute('aria-expanded', 'true');
      dd.setAttribute('aria-hidden', 'false');
      if (open) {
        const first = dd.querySelector('.nav-dropdown__link');
        if (first) first.focus();
      }
    });

    toggle.addEventListener('mouseenter', () => {
      const anyOpen = toggles.some(x => x.dataset.dropdownToggle === 'open');
      toggles.forEach(other => {
        if (other !== toggle) {
          other.dataset.dropdownToggle = 'closed';
          other.setAttribute('aria-expanded', 'false');
          const otherDropdown = other.nextElementSibling;
          if (otherDropdown) otherDropdown.setAttribute('aria-hidden', 'true');
        }
      });
      if (anyOpen) {
        setTimeout(() => {
          toggle.dataset.dropdownToggle = 'open';
          toggle.setAttribute('aria-expanded', 'true');
          dd.setAttribute('aria-hidden', 'false');
        }, 20);
      } else {
        toggle.dataset.dropdownToggle = 'open';
        toggle.setAttribute('aria-expanded', 'true');
        dd.setAttribute('aria-hidden', 'false');
      }
    });

    dd.addEventListener('mouseleave', () => {
      toggle.dataset.dropdownToggle = 'closed';
      toggle.setAttribute('aria-expanded', 'false');
      dd.setAttribute('aria-hidden', 'true');
    });

    toggle.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle.click();
      } else if (e.key === 'Escape') {
        toggle.dataset.dropdownToggle = 'closed';
        toggle.setAttribute('aria-expanded', 'false');
        dd.setAttribute('aria-hidden', 'true');
        toggle.focus();
      }
    });

    dd.addEventListener('keydown', e => {
      const items = Array.from(dd.querySelectorAll('.nav-dropdown__link'));
      const idx = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        items[(idx + 1) % items.length].focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        items[(idx - 1 + items.length) % items.length].focus();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        toggle.dataset.dropdownToggle = 'closed';
        toggle.setAttribute('aria-expanded', 'false');
        dd.setAttribute('aria-hidden', 'true');
        toggle.focus();
      } else if (e.key === 'Tab' && !dd.contains(e.relatedTarget)) {
        toggle.dataset.dropdownToggle = 'closed';
        toggle.setAttribute('aria-expanded', 'false');
        dd.setAttribute('aria-hidden', 'true');
      }
    });
  });

  links.forEach(link => {
    link.addEventListener('mouseenter', () => {
      toggles.forEach(toggle => {
        toggle.dataset.dropdownToggle = 'closed';
        toggle.setAttribute('aria-expanded', 'false');
        const dd = toggle.nextElementSibling;
        if (dd) dd.setAttribute('aria-hidden', 'true');
      });
    });
  });

  document.addEventListener('click', e => {
    const inside = toggles.some(toggle => {
      const dd = toggle.nextElementSibling;
      return toggle.contains(e.target) || (dd && dd.contains(e.target));
    });
    if (!inside) {
      toggles.forEach(toggle => {
        toggle.dataset.dropdownToggle = 'closed';
        toggle.setAttribute('aria-expanded', 'false');
        const dd = toggle.nextElementSibling;
        if (dd) dd.setAttribute('aria-hidden', 'true');
      });
    }
  });
}

// ============================================================
// 8. INIT ON DOM READY
// ============================================================
document.querySelectorAll('.config_svg_embed').forEach(function (el) {
  el.innerHTML = el.textContent;
});

// Run the loader immediately, NOT on DOMContentLoaded. This is a footer script so
// the loader markup (near the top of <body>) is already parsed, and GSAP is injected
// ahead of footer code — both ready. DOMContentLoaded is itself held back until the
// heavy footer scripts (hls.js, ~157KB) finish, which delayed the loader ~15s on slow
// connections. Requires oa-global.js to load before hls.js in the footer.
initLogoRevealLoader();

// ============================================================
// BUTTON 046 — magnetic radial wipe (glass CTA in .hero_feed_cta-wrap)
// Orange circle grows from the cursor and follows it. Desktop-pointer only;
// touch/reduced-motion fall back to the static glass button (no wipe).
// ============================================================
function initButton046() {
  const buttons = document.querySelectorAll('[data-button-046]');
  if (!buttons.length) return;

  const mm = gsap.matchMedia();

  buttons.forEach((button) => {
    const circle = button.querySelector('[data-button-046-circle]');
    if (!circle) return;

    mm.add('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)', () => {
      const xSet = gsap.quickSetter(circle, 'xPercent');
      const ySet = gsap.quickSetter(circle, 'yPercent');

      function getXY(e) {
        const { left, top, width, height } = button.getBoundingClientRect();
        const xT = gsap.utils.pipe(gsap.utils.mapRange(0, width, 0, 100), gsap.utils.clamp(0, 100));
        const yT = gsap.utils.pipe(gsap.utils.mapRange(0, height, 0, 100), gsap.utils.clamp(0, 100));
        return { x: xT(e.clientX - left), y: yT(e.clientY - top) };
      }

      function onEnter(e) {
        const { x, y } = getXY(e);
        xSet(x);
        ySet(y);
        gsap.to(circle, { scale: 1, duration: 1.25, ease: 'button-046-ease', overwrite: 'auto' });
      }
      function onLeave(e) {
        const { x, y } = getXY(e);
        gsap.killTweensOf(circle);
        gsap.to(circle, {
          xPercent: x > 90 ? x + 25 : x < 12.5 ? x - 25 : x,
          yPercent: y > 90 ? y + 25 : y < 12.5 ? y - 25 : y,
          scale: 0,
          duration: 0.45,
          ease: 'button-046-ease',
          overwrite: 'auto',
        });
      }
      function onMove(e) {
        const { x, y } = getXY(e);
        gsap.to(circle, { xPercent: x, yPercent: y, duration: 0.5, ease: 'power1', overwrite: 'auto' });
      }

      button.addEventListener('pointerenter', onEnter);
      button.addEventListener('pointerleave', onLeave);
      button.addEventListener('pointermove', onMove);

      return () => {
        button.removeEventListener('pointerenter', onEnter);
        button.removeEventListener('pointerleave', onLeave);
        button.removeEventListener('pointermove', onMove);
      };
    });
  });
}

// ============================================================
// 9. STRIP ORPHANED WEBFLOW SCROLL HANDLER
// ============================================================
// The "OA Statement [Scroll]" interaction (continuous "While scrolling in view"
// on .oa_statement_layout) is applied site-wide, so Webflow registers its scroll
// event in EVERY page's IX2 data — including pages that don't contain the block
// (/all-products, /product/*, /materials-finishes/*). On those pages IX2's
// throttled scroll.webflow handler still runs jQuery .offset() every frame against
// a missing target → forced reflow. It's cheap on short pages but on the long,
// image-heavy /all-products it costs ~376ms of reflow per scroll and drops to
// ~57fps (visible jitter). The interaction can't be unscoped per-page in the
// Webflow UI, so strip the dead handler wherever the block is absent. Pages WITH
// the block (homepage) keep the real, wanted animation. No other Webflow scroll
// interaction exists on the site, so unbinding scroll.webflow here is safe.
function stripOrphanScrollHandler() {
  if (document.querySelector('.oa_statement_layout')) return; // block present → keep the real interaction
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

// Nav inits at execution, NOT on DOMContentLoaded: this is a footer script so
// the nav markup is already parsed, and DOMContentLoaded is held back ~17s on
// Slow 4G behind parser-blocking hls.js — which would freeze the mobile burger.
initNavigation();

document.addEventListener('DOMContentLoaded', function () {
  initSmoothScroll();
  initPageTransition();
  document.querySelectorAll('[data-slideshow="wrap"]').forEach(wrap => initSlideShow(wrap));
  initButton046();
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
