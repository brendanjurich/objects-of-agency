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
// 4. SLIDESHOW
// ============================================================
function initSlideShow(el) {
  const ui = {
    el,
    slides: Array.from(el.querySelectorAll('[data-slideshow="slide"]')),
    inner: Array.from(el.querySelectorAll('[data-slideshow="parallax"]')),
    thumbs: Array.from(el.querySelectorAll('[data-slideshow="thumb"]')),
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
// 5. LOADER
// ============================================================
function revealAfterLoader() {
  document.documentElement.classList.add('w-mod-ix3');
  document.documentElement.classList.add('loader-complete');
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
// 6. SAFARI WEBKIT NAV FIX
// ============================================================
function initNavSafariFix() {
  const navButton = document.querySelector('.w-nav-button');
  const navComponent = document.querySelector('.nav_component');
  if (!navButton || !navComponent) return;

  const observer = new MutationObserver(function () {
    if (navButton.classList.contains('w--open')) {
      navComponent.classList.add('is-open');
      document.body.classList.add('menu-open');
    } else {
      document.body.classList.remove('menu-open');
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
// 7. INIT ON DOM READY
// ============================================================
document.querySelectorAll('.config_svg_embed').forEach(function (el) {
  el.innerHTML = el.textContent;
});
document.addEventListener('DOMContentLoaded', function () {
  initLogoRevealLoader();
  document.querySelectorAll('[data-slideshow="wrap"]').forEach(wrap => initSlideShow(wrap));
  initNavSafariFix();
});

// Patch Lumos-initialized Swiper on the product static slider to use 800ms speed.
// Lumos init runs before window.load, so the instance is available by then.
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
      const sw = el.swiper;
      if (!sw) return;

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
