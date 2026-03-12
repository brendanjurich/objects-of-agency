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

  const loadTimeline = gsap.timeline({ defaults: { ease: 'loader', duration: 2.2 } })
    .set(wrap, { display: 'block' })
    .to(progressBar, { scaleX: 1 })
    .to(logo, { clipPath: 'inset(0% 0% 0% 0%)' }, '<')
    .to(container, { autoAlpha: 0, duration: 0.5 })
    .to(progressBar, { scaleX: 0, transformOrigin: 'right center', duration: 0.5 }, '<')
    .add('hideContent', '<')
    .to(bg, { yPercent: -101, duration: 1 }, 'hideContent')
    .set(wrap, { display: 'none' });

  if (resetTargets.length) {
    loadTimeline.set(resetTargets, { autoAlpha: 1 }, 0);
  }
}

// ============================================================
// 5. CASCADING SLIDER
// ============================================================
function initCascadingSlider() {

  const duration = 0.65;
  const ease = 'power3.inOut';

  const breakpoints = [
    { maxWidth: 479, activeWidth: 0.75, siblingWidth: 0.08 },
    { maxWidth: 767, activeWidth: 0.75, siblingWidth: 0.08 },
    { maxWidth: 991, activeWidth: 0.75, siblingWidth: 0.08 },
    { maxWidth: Infinity, activeWidth: 0.78, siblingWidth: 0.06 },
  ];

  const wrappers = document.querySelectorAll('[data-cascading-slider-wrap]');
  wrappers.forEach(setupInstance);

  function setupInstance(wrapper) {
    const viewport = wrapper.querySelector('[data-cascading-viewport]');
    if (!viewport) return;

    const prevButton = wrapper.querySelector('[data-cascading-slider-prev]');
    const nextButton = wrapper.querySelector('[data-cascading-slider-next]');

    // ── Hoist slides out of w-dyn-item wrappers ───────────────
    // Original CMS slides sit inside config_slider_item (position:absolute).
    // Clones are appended directly to the viewport. Hoisting originals
    // to the same level ensures identical coordinate origins for all slides.
    viewport.querySelectorAll('.config_slider_item').forEach(function (item) {
      const slide = item.querySelector('[data-cascading-slide]');
      if (slide) viewport.appendChild(slide);
      item.remove();
    });

    const slides = Array.from(viewport.querySelectorAll('[data-cascading-slide]'));
    let totalSlides = slides.length;
    if (totalSlides === 0) return;

    // ── Clone until we have at least 9 for smooth looping ─────
    if (totalSlides < 9) {
      const originalSlides = slides.slice();
      while (slides.length < 9) {
        originalSlides.forEach(function (original) {
          const clone = original.cloneNode(true);
          clone.setAttribute('data-clone', '');
          viewport.appendChild(clone);
          slides.push(clone);
        });
      }
      totalSlides = slides.length;
    }

    // Radio button sync — store original (non-cloned) count
    const radioInputs = Array.from(wrapper.querySelectorAll('input[type="radio"]'));
    const originalCount = radioInputs.length;

    let activeIndex = 0;
    let isAnimating = false;
    let slideWidth = 0;
    let slotCenters = {};
    let slotWidths = {};

    // ── Helpers ───────────────────────────────────────────────

    function readGap() {
      const raw = getComputedStyle(viewport).getPropertyValue('--gap').trim();
      if (!raw) return 0;
      const temp = document.createElement('div');
      temp.style.cssText = 'width:' + raw + ';position:absolute;visibility:hidden';
      viewport.appendChild(temp);
      const px = temp.offsetWidth;
      viewport.removeChild(temp);
      return px;
    }

    function getSettings(viewportWidth) {
      for (let i = 0; i < breakpoints.length; i++) {
        if (viewportWidth <= breakpoints[i].maxWidth) return breakpoints[i];
      }
      return breakpoints[breakpoints.length - 1];
    }

    function getOffset(slideIndex, fromIndex) {
      if (fromIndex === undefined) fromIndex = activeIndex;
      let distance = slideIndex - fromIndex;
      const half = totalSlides / 2;
      if (distance > half) distance -= totalSlides;
      if (distance < -half) distance += totalSlides;
      return distance;
    }

    // ── Measure & Layout ──────────────────────────────────────

    function measure() {
      const viewportWidth = viewport.getBoundingClientRect().width;
      const settings = getSettings(viewportWidth);
      const gap = readGap();

      const activeSlideWidth = viewportWidth * settings.activeWidth;
      const siblingSlideWidth = viewportWidth * settings.siblingWidth;
      const farSlideWidth = Math.max(
        0,
        (viewportWidth - activeSlideWidth - 2 * siblingSlideWidth - 4 * gap) / 2
      );

      slideWidth = activeSlideWidth;

      // Build slot positions symmetrically outward from guaranteed center
      const center = viewportWidth / 2;

      slotCenters['0'] = center;
      slotWidths['0'] = activeSlideWidth;

      slotCenters['-1'] = center - activeSlideWidth / 2 - gap - siblingSlideWidth / 2;
      slotWidths['-1'] = siblingSlideWidth;
      slotCenters['1'] = center + activeSlideWidth / 2 + gap + siblingSlideWidth / 2;
      slotWidths['1'] = siblingSlideWidth;

      slotCenters['-2'] = slotCenters['-1'] - siblingSlideWidth / 2 - gap - farSlideWidth / 2;
      slotWidths['-2'] = farSlideWidth;
      slotCenters['2'] = slotCenters['1'] + siblingSlideWidth / 2 + gap + farSlideWidth / 2;
      slotWidths['2'] = farSlideWidth;

      slotCenters['-3'] = slotCenters['-2'] - farSlideWidth / 2 - gap - farSlideWidth / 2;
      slotWidths['-3'] = farSlideWidth;
      slotCenters['3'] = slotCenters['2'] + farSlideWidth / 2 + gap + farSlideWidth / 2;
      slotWidths['3'] = farSlideWidth;

      slides.forEach(function (slide) { slide.style.width = slideWidth + 'px'; });
    }

    function getSlideProps(offset) {
      const clamped = Math.max(-3, Math.min(3, offset));
      const slotW = slotWidths[String(clamped)];
      const clipAmount = Math.max(0, (slideWidth - slotW) / 2);
      const translateX = slotCenters[String(clamped)] - slideWidth / 2;
      return {
        x: translateX,
        '--clip': clipAmount,
        zIndex: 10 - Math.abs(clamped),
      };
    }

    function layout(animate, previousIndex) {
      slides.forEach(function (slide, index) {
        const offset = getOffset(index);

        if (offset < -3 || offset > 3) {
          if (animate && previousIndex !== undefined) {
            const previousOffset = getOffset(index, previousIndex);
            if (previousOffset >= -2 && previousOffset <= 2) {
              const exitSlot = previousOffset < 0 ? -3 : 3;
              gsap.to(slide, Object.assign({}, getSlideProps(exitSlot), {
                duration,
                ease,
                overwrite: true,
              }));
              return;
            }
          }
          gsap.set(slide, getSlideProps(offset < 0 ? -3 : 3));
          return;
        }

        const props = getSlideProps(offset);
        slide.setAttribute('data-status', offset === 0 ? 'active' : 'inactive');

        if (animate) {
          gsap.to(slide, Object.assign({}, props, { duration, ease, overwrite: true }));
        } else {
          gsap.set(slide, props);
        }
      });
    }

    // ── Radio Sync ────────────────────────────────────────────
    let isSyncing = false;

    function syncRadio() {
      if (!originalCount) return;
      const realIndex = activeIndex % originalCount;
      isSyncing = true;
      radioInputs.forEach(function (input, i) {
        const isActive = i === realIndex;
        input.checked = isActive;
        const customRadio = input.closest('label') &&
          input.closest('label').querySelector('.config_radio_button');
        if (customRadio) customRadio.classList.toggle('w--redirected-checked', isActive);
      });
      isSyncing = false;
    }

    radioInputs.forEach(function (input, index) {
      input.addEventListener('change', function () {
        if (isSyncing) return;
        goTo(index);
      });
    });

    // ── Navigation ────────────────────────────────────────────

    function goTo(targetIndex) {
      const normalizedTarget = ((targetIndex % totalSlides) + totalSlides) % totalSlides;
      if (isAnimating || normalizedTarget === activeIndex) return;
      isAnimating = true;

      const previousIndex = activeIndex;
      const travelDirection = getOffset(normalizedTarget, previousIndex) > 0 ? 1 : -1;

      slides.forEach(function (slide, index) {
        const currentOffset = getOffset(index, previousIndex);
        const nextOffset = getOffset(index, normalizedTarget);
        const wasInRange = currentOffset >= -3 && currentOffset <= 3;
        const willBeVisible = nextOffset >= -2 && nextOffset <= 2;

        if (!wasInRange && willBeVisible) {
          gsap.set(slide, getSlideProps(travelDirection > 0 ? 3 : -3));
        }

        const wasInvisible = Math.abs(currentOffset) >= 3;
        const willBeStaging = Math.abs(nextOffset) === 3;
        const crossesSides = currentOffset * nextOffset < 0;
        if (wasInvisible && willBeStaging && crossesSides) {
          gsap.set(slide, getSlideProps(nextOffset > 0 ? 3 : -3));
        }
      });

      activeIndex = normalizedTarget;
      syncRadio();
      layout(true, previousIndex);
      gsap.delayedCall(duration + 0.05, function () { isAnimating = false; });
    }

    // ── Event Listeners ───────────────────────────────────────

    if (prevButton) prevButton.addEventListener('click', function () { goTo(activeIndex - 1); });
    if (nextButton) nextButton.addEventListener('click', function () { goTo(activeIndex + 1); });

    slides.forEach(function (slide, index) {
      slide.addEventListener('click', function () {
        if (index !== activeIndex) goTo(index);
      });
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft') goTo(activeIndex - 1);
      if (event.key === 'ArrowRight') goTo(activeIndex + 1);
    });

    // ResizeObserver handles desktop resize with single rAF
    const ro = new ResizeObserver(function () {
      requestAnimationFrame(function () {
        measure();
        layout(false);
        syncRadio();
      });
    });
    ro.observe(viewport);

    // orientationchange needs a longer settle time on iOS Safari
    window.addEventListener('orientationchange', function () {
      setTimeout(function () {
        measure();
        layout(false);
        syncRadio();
      }, 150);
    });

    // ── Init ──────────────────────────────────────────────────

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        measure();
        layout(false);
        syncRadio();
      });
    });
  }
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
// 7. FIX DUPLICATE RADIO IDs
// ============================================================
function applyUniqueId(input, uniqueId) {
  input.id = uniqueId;
  const label = input.closest('label');
  if (label) {
    label.setAttribute('for', uniqueId);
    const span = label.querySelector('.config_radio_label');
    if (span) span.setAttribute('for', uniqueId);
  }
}

function fixRadioIds() {
  document.querySelectorAll('input[name="Sizes"]')
    .forEach(function (input, index) { applyUniqueId(input, 'size-' + index); });
  document.querySelectorAll('input[name="Top-Material"]')
    .forEach(function (input, index) { applyUniqueId(input, 'top-material-' + index); });
  document.querySelectorAll('input[name="Timber"]')
    .forEach(function (input, index) { applyUniqueId(input, 'timber-' + index); });
  document.querySelectorAll('input[name="Anodised-Finish"]')
    .forEach(function (input, index) { applyUniqueId(input, 'anodised-' + index); });
}

// ============================================================
// 8. INIT ON DOM READY
// ============================================================
document.querySelectorAll('.config_svg_embed').forEach(function (el) {
  el.innerHTML = el.textContent;
});
document.addEventListener('DOMContentLoaded', function () {
  initLogoRevealLoader();
  document.querySelectorAll('[data-slideshow="wrap"]').forEach(wrap => initSlideShow(wrap));
  initCascadingSlider();
  initNavSafariFix();
  fixRadioIds();
});
