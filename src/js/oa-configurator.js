// ============================================================
// 1. CASCADING SLIDER
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

    viewport.querySelectorAll('.config_slider_item').forEach(function (item) {
      const slide = item.querySelector('[data-cascading-slide]');
      if (slide) viewport.appendChild(slide);
      item.remove();
    });

    const slides = Array.from(viewport.querySelectorAll('[data-cascading-slide]'));
    let totalSlides = slides.length;
    if (totalSlides === 0) return;

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

    const radioInputs = Array.from(wrapper.querySelectorAll('input[type="radio"]'));
    const originalCount = radioInputs.length;

    let activeIndex = 0;
    let isAnimating = false;
    let slideWidth = 0;
    let slotCenters = {};
    let slotWidths = {};

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

    let isSyncing = false;

    function syncRadio() {
      if (!originalCount) return;
      const realIndex = activeIndex % originalCount;
      isSyncing = true;
      radioInputs.forEach(function (input, i) {
        const isActive = i === realIndex;
        input.checked = isActive;
        if (isActive) input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      isSyncing = false;
    }

    radioInputs.forEach(function (input, index) {
      input.addEventListener('change', function () {
        if (isSyncing) return;
        goTo(index);
      });
    });

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

    if (prevButton) prevButton.addEventListener('click', function () { goTo(activeIndex - 1); });
    if (nextButton) nextButton.addEventListener('click', function () { goTo(activeIndex + 1); });

    slides.forEach(function (slide, index) {
      slide.addEventListener('click', function () {
        if (index !== activeIndex) goTo(index);
      });
    });

    let sliderHasFocus = false;
    wrapper.addEventListener('mouseenter', function () { sliderHasFocus = true; });
    wrapper.addEventListener('mouseleave', function () { sliderHasFocus = false; });
    wrapper.addEventListener('focusin', function () { sliderHasFocus = true; });
    wrapper.addEventListener('focusout', function () { sliderHasFocus = false; });
    document.addEventListener('keydown', function (event) {
      if (!sliderHasFocus) return;
      if (event.key === 'ArrowLeft') { event.preventDefault(); goTo(activeIndex - 1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); goTo(activeIndex + 1); }
    });

    const ro = new ResizeObserver(function () {
      requestAnimationFrame(function () {
        measure();
        layout(false);
        syncRadio();
      });
    });
    ro.observe(viewport);

    window.addEventListener('orientationchange', function () {
      setTimeout(function () {
        measure();
        layout(false);
        syncRadio();
      }, 150);
    });

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
// 2. FIX DUPLICATE RADIO IDs
// ============================================================
function applyUniqueId(input, uniqueId) {
  input.id = uniqueId;
  const label = input.closest('label');
  if (label) {
    label.setAttribute('for', uniqueId);
    const span = label.querySelector('.form_ui_label');
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
// 3. PRICING ENGINE
// ============================================================
function initPricingEngine() {
  const basePriceEl = document.querySelector('.config_base_price');
  const fromPriceEl = document.querySelector('.config_from_price');
  const configuredPriceEl = document.querySelector('.configure_price');
  if (!basePriceEl || (!fromPriceEl && !configuredPriceEl)) return;

  const formatter = new Intl.NumberFormat('en-AU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  function calculatePrice() {
    const basePrice = parseFloat(basePriceEl.textContent.replace(/[^0-9.]/g, '')) || 0;
    let modifier = 0;

    document.querySelectorAll('input[type="radio"]:checked').forEach(function (input) {
      const priceEl = input.closest('[data-price]');
      if (priceEl) {
        modifier += parseFloat(priceEl.getAttribute('data-price')) || 0;
      }
    });

    if (fromPriceEl) fromPriceEl.textContent = formatter.format(basePrice);
    if (configuredPriceEl) configuredPriceEl.textContent = formatter.format(basePrice + modifier);
  }

  document.addEventListener('change', function (event) {
    if (event.target.type === 'radio') calculatePrice();
  });

  calculatePrice();
}

// ============================================================
// 4. SUMMARY UPDATER
// ============================================================
function initSummaryUpdater() {
  const groups = [
    { name: 'Sizes',           id: 'summary-size' },
    { name: 'Top-Material',    id: 'summary-top-material' },
    { name: 'Timber',          id: 'summary-timber' },
    { name: 'Anodised-Finish', id: 'summary-anodising' },
  ];

  function updateSummary() {
    groups.forEach(function (group) {
      const summaryEl = document.getElementById(group.id);
      if (!summaryEl) return;

      const checked = document.querySelector('input[name="' + group.name + '"]:checked');
      if (!checked) return;

      // Radio card structure (e.g. sizes) — label text is in .form_ui_text
      const formItem = checked.closest('.form_ui_item');
      if (formItem) {
        const labelEl = formItem.querySelector('.form_ui_text');
        if (labelEl) { summaryEl.textContent = labelEl.textContent.trim(); return; }
      }

      // Swatch slider structure — label text is in the active slide's .config_content_text
      const sliderWrap = checked.closest('[data-cascading-slider-wrap]');
      if (sliderWrap) {
        const activeSlide = sliderWrap.querySelector('[data-cascading-slide][data-status="active"]');
        if (activeSlide) {
          const labelEl = activeSlide.querySelector('.config_content_text');
          if (labelEl) summaryEl.textContent = labelEl.textContent.trim();
        }
      }
    });
  }

  document.addEventListener('change', function (event) {
    if (event.target.type === 'radio') updateSummary();
  });

  updateSummary();
}

// ============================================================
// 5. INIT ON DOM READY
// ============================================================
document.addEventListener('DOMContentLoaded', function () {
  fixRadioIds();
  initCascadingSlider();
  initPricingEngine();
  initSummaryUpdater();
});
