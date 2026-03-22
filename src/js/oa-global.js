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
// 3. SLIDESHOW
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
// 4. LOADER
// ============================================================
function initLogoRevealLoader() {
  const wrap = document.querySelector('[data-load-wrap]');
  if (!wrap) return;

  const container = wrap.querySelector('[data-load-container]');
  const bg = wrap.querySelector('[data-load-bg]');
  const progressBar = wrap.querySelector('[data-load-progress]');
  const logo = wrap.querySelector('[data-load-logo]');
  const resetTargets = Array.from(wrap.querySelectorAll('[data-load-reset]'));
  const nav = document.querySelector('.nav_component');

  // Take ownership of nav visibility — keep it hidden for the full loader
  // duration regardless of IX2 init timing, then reveal it ourselves.
  // Requires the IX2 page-load interaction on nav_component to be removed
  // in the Webflow Designer.
  if (nav) gsap.set(nav, { autoAlpha: 0 });

  const loadTimeline = gsap.timeline({ defaults: { ease: 'loader', duration: 2.2 } })
    .set(wrap, { display: 'block' })
    .to(progressBar, { scaleX: 1 })
    .to(logo, { clipPath: 'inset(0% 0% 0% 0%)' }, '<')
    .to(container, { autoAlpha: 0, duration: 0.5 })
    .to(progressBar, { scaleX: 0, transformOrigin: 'right center', duration: 0.5 }, '<')
    .add('hideContent', '<')
    .to(bg, { yPercent: -101, duration: 1 }, 'hideContent')
    .set(wrap, { display: 'none' })
    .call(() => {
      // Unlock the Webflow IX3 visibility gate, then fade the nav in.
      document.documentElement.classList.add('w-mod-ix3');
      if (nav) gsap.to(nav, { autoAlpha: 1, duration: 0.25, ease: 'none' });
    });

  if (resetTargets.length) {
    loadTimeline.set(resetTargets, { autoAlpha: 1 }, 0);
  }
}

// ============================================================
// 5. SAFARI WEBKIT NAV FIX
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
// 6. INIT ON DOM READY
// ============================================================
document.querySelectorAll('.config_svg_embed').forEach(function (el) {
  el.innerHTML = el.textContent;
});
document.addEventListener('DOMContentLoaded', function () {
  initLogoRevealLoader();
  document.querySelectorAll('[data-slideshow="wrap"]').forEach(wrap => initSlideShow(wrap));
  initNavSafariFix();
});
