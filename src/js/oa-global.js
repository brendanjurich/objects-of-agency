// ============================================================
// 1. REGISTER GSAP PLUGINS
// ============================================================
gsap.registerPlugin(CustomEase);

// ============================================================
// 2. CUSTOM EASES
// ============================================================
CustomEase.create("slideshow-wipe", "0.625, 0.05, 0, 1");
CustomEase.create("loader", "0.65, 0.01, 0.05, 0.99");


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

  // --- ENTER: fade content in once the page is ready ---
  // Content starts hidden via the CSS guard in oa-styles.css. On pages that run
  // the branded loader, the loader owns the reveal moment — snap content visible
  // (no double fade). Detection reuses the loader's own gate.
  const loaderWillRun = !!document.querySelector('[data-load-wrap] [data-load-progress]');
  const reveal = function () {
    if (loaderWillRun || reduce) {
      gsap.set(content, { autoAlpha: 1 });
    } else {
      gsap.to(content, { autoAlpha: 1, duration: 0.6, ease: 'slideshow-wipe' });
    }
  };
  if (document.documentElement.classList.contains('loader-complete')) {
    reveal();
  } else {
    document.addEventListener('oa:loader-complete', reveal, { once: true });
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
  const pageReady = new Promise(resolve => {
    if (document.readyState === 'complete') resolve();
    else window.addEventListener('load', resolve, { once: true });
  });

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

// ============================================================
// 8. INIT ON DOM READY
// ============================================================
document.querySelectorAll('.config_svg_embed').forEach(function (el) {
  el.innerHTML = el.textContent;
});
document.addEventListener('DOMContentLoaded', function () {
  initSmoothScroll();
  initPageTransition();
  initLogoRevealLoader();
  document.querySelectorAll('[data-slideshow="wrap"]').forEach(wrap => initSlideShow(wrap));
  initNavSafariFix();
});

// Patch Lumos-initialized Swipers after window.load.
// Lumos init runs before window.load, so instances are available by then.
window.addEventListener('load', function () {
  // --- Static product slider: 800ms desktop / 700ms touch ---
  // Scoped to .static_slider-wrap so we don't accidentally grab the first
  // .slider_element on pages that have multiple sliders.
  const staticSliderEl = document.querySelector(
    '.static_slider-wrap .slider_element'
  );
  if (staticSliderEl && staticSliderEl.swiper) {
    const isTouch = window.matchMedia('(pointer: coarse)').matches;
    staticSliderEl.swiper.params.speed = isTouch ? 700 : 800;
  }

  // --- Home Products slider: gate the mobile "raise on settle" ---
  // Toggles body.is-slider-transitioning while Swiper is animating or the
  // user is actively dragging, so the CSS only raises the active card once
  // motion has fully stopped. Prevents outgoing/incoming cards from
  // competing for the raised state during a swipe (visible jitter with
  // slidesPerView: 1.1).
  document
    .querySelectorAll('.section_menu_wrap .slider_element')
    .forEach(function (el) {
      if (!el.swiper) {
        console.warn('[OA] Lumos Swiper patch: .swiper instance not found on', el,
          '— patch skipped. Lumos may have changed its init timing.');
        return;
      }
      const sw = el.swiper;

      const addFlag = function () {
        document.body.classList.add('is-slider-transitioning');
      };
      const clearFlag = function () {
        document.body.classList.remove('is-slider-transitioning');
      };

      sw.on('transitionStart', addFlag);
      sw.on('transitionEnd', clearFlag);
      sw.on('touchStart', addFlag);
      sw.on('touchEnd', function () {
        // If the touch ended without triggering a slide transition
        // (e.g. a tap), clear the flag immediately. Otherwise
        // transitionEnd will clear it after the snap animation.
        if (!sw.animating) clearFlag();
      });
    });
});
