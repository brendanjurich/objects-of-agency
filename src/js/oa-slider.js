/* ============================================================
   OA — Lumos slider init (repo-driven, Swiper 12.2.0)
   ------------------------------------------------------------
   Owns the init that used to be baked into the Webflow embeds of
   the Lumos slider components (.static_slider_contain product,
   .slider_wrap homepage menu). Both share the same contract
   ([data-slider='component'] / .slider_element / .slider_list),
   so this one init drives every slider on the page.

   Per-slider config comes from data-attributes on .slider_element
   (the Lumos-native pattern). New attrs vs the original Lumos init:
     data-loop, data-parallax, data-slides-per-view, data-speed-touch,
     data-raise-on-transition.

   Folds in (and replaces) the two old oa-global.js window.load patches:
     • product speed 800/700  → data-speed + data-speed-touch
     • is-slider-transitioning → data-raise-on-transition

   Swiper 12.2.0 bundle (JS+CSS) is loaded from jsDelivr only when a
   slider exists on the page. Safe because there is no Lumos runtime —
   this is frozen init code relocated into version control.
   Page-agnostic, sitewide footer, guarded. Raw-served (no Rollup).
   ============================================================ */
(function () {
  const SWIPER_VERSION = '12.2.0';
  const SWIPER_JS = `https://cdn.jsdelivr.net/npm/swiper@${SWIPER_VERSION}/swiper-bundle.min.js`;
  const SWIPER_CSS = `https://cdn.jsdelivr.net/npm/swiper@${SWIPER_VERSION}/swiper-bundle.min.css`;

  // Inject the Swiper bundle once; resolve when the global is ready.
  function loadSwiper() {
    return new Promise((resolve, reject) => {
      if (window.Swiper) return resolve();
      if (!document.querySelector(`link[href="${SWIPER_CSS}"]`)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = SWIPER_CSS;
        document.head.appendChild(link);
      }
      const script = document.createElement('script');
      script.src = SWIPER_JS;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Swiper bundle failed to load'));
      document.head.appendChild(script);
    });
  }

  // Lumos DOM surgery (verbatim from the original Lumos init) ----------------

  // Flatten Lumos u-display-contents wrappers.
  function flattenDisplayContents(slot) {
    if (!slot) return;
    let child = slot.firstElementChild;
    while (child && child.classList.contains('u-display-contents')) {
      while (child.firstChild) slot.insertBefore(child.firstChild, child);
      slot.removeChild(child);
      child = slot.firstElementChild;
    }
  }

  // Lift CMS items out of the .w-dyn-list into the wrapper.
  function removeCMSList(slot) {
    const dynList = Array.from(slot.children).find((c) => c.classList.contains('w-dyn-list'));
    if (!dynList) return;
    const nestedItems = dynList?.querySelector('.w-dyn-items')?.children;
    if (!nestedItems) return;
    const staticWrapper = [...slot.children];
    [...nestedItems].forEach((el) => {
      const c = [...el.children].find((c) => !c.classList.contains('w-condition-invisible'));
      c && slot.appendChild(c);
    });
    staticWrapper.forEach((el) => el.remove());
  }

  function initSliders() {
    document
      .querySelectorAll("[data-slider='component']:not([data-slider='component'] [data-slider='component'])")
      .forEach((component) => {
        if (component.dataset.scriptInitialized) return;
        component.dataset.scriptInitialized = 'true';

        const swiperElement = component.querySelector('.slider_element');
        const swiperWrapper = component.querySelector('.slider_list');
        if (!swiperElement || !swiperWrapper) return;

        flattenDisplayContents(swiperWrapper);
        removeCMSList(swiperWrapper);
        [...swiperWrapper.children].forEach((el) => el.classList.add('swiper-slide'));

        // Config from data-attributes ---------------------------------------
        const followFinger = swiperElement.getAttribute('data-follow-finger') === 'true';
        const freeMode = swiperElement.getAttribute('data-free-mode') === 'true';
        const mousewheel = swiperElement.getAttribute('data-mousewheel') === 'true';
        const slideToClickedSlide = swiperElement.getAttribute('data-slide-to-clicked') === 'true';
        const parallax = swiperElement.getAttribute('data-parallax') === 'true';
        const raiseOnTransition = swiperElement.getAttribute('data-raise-on-transition') === 'true';

        const spvAttr = swiperElement.getAttribute('data-slides-per-view');
        const slidesPerView = spvAttr && spvAttr !== 'auto' ? parseInt(spvAttr, 10) || 'auto' : 'auto';

        // Speed: data-speed (default 600), with an optional touch override
        // (folds in the old product-slider 800/700 patch).
        const baseSpeed = +swiperElement.getAttribute('data-speed') || 600;
        const touchSpeed = +swiperElement.getAttribute('data-speed-touch') || 0;
        const isTouch = window.matchMedia('(pointer: coarse)').matches;
        const speed = isTouch && touchSpeed ? touchSpeed : baseSpeed;

        // Loop only with enough slides (Swiper 12 needs ≥ slidesPerView + 1).
        const loop = swiperElement.getAttribute('data-loop') === 'true' && swiperWrapper.children.length >= 2;

        const swiper = new Swiper(swiperElement, {
          slidesPerView,
          followFinger,
          loop,
          loopAdditionalSlides: 10,
          freeMode,
          slideToClickedSlide,
          parallax,
          centeredSlides: false,
          autoHeight: false,
          speed,
          mousewheel: { enabled: mousewheel, forceToAxis: true },
          keyboard: { enabled: true, onlyInViewport: true },
          navigation: {
            nextEl: component.querySelector("[data-slider='next'] button"),
            prevEl: component.querySelector("[data-slider='previous'] button"),
          },
          pagination: {
            el: component.querySelector('.slider_bullet_list'),
            bulletActiveClass: 'is-active',
            bulletClass: 'slider_bullet_item',
            bulletElement: 'button',
            clickable: true,
          },
          slideActiveClass: 'is-active',
        });

        // Folds in the old homepage "is-slider-transitioning" patch: toggle the
        // body flag while animating/dragging so the CSS only raises the active
        // card once motion has fully stopped.
        if (raiseOnTransition) {
          const addFlag = () => document.body.classList.add('is-slider-transitioning');
          const clearFlag = () => document.body.classList.remove('is-slider-transitioning');
          swiper.on('transitionStart', addFlag);
          swiper.on('transitionEnd', clearFlag);
          swiper.on('touchStart', addFlag);
          swiper.on('touchEnd', () => {
            if (!swiper.animating) clearFlag();
          });
        }
      });
  }

  function boot() {
    if (!document.querySelector("[data-slider='component']")) return; // no slider on this page
    loadSwiper()
      .then(initSliders)
      .catch((err) => console.warn('[oa-slider]', err.message));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
