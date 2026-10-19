/* ============================================================
   OA — oa Section Content Group feeds
   ------------------------------------------------------------
   Drives every .content_group_feed-images (upper + lower feed, on
   the homepage and /contact) with the hero feed's engine: Swiper
   creative, vertical, loop, speed 900, autoplay 5000, slide easing
   --ease-oa (oa-styles.css). Config mirrors initHeroFeedTopSwiper in
   oa-homepage.js — change one, change both.
   Swiper comes from window.oaLoadSwiper (oa-slider.js, sitewide
   footer). Autoplay holds until the loader completes: on the homepage
   the loader waits for the hero video, so the feeds start with it.
   Page-level embed. No-ops without the markup. Raw-served (no build).
   ============================================================ */

function initContentGroupFeed(el) {
  return new Swiper(el, {
    wrapperClass: 'content_group_slide-wrap',
    slideClass: 'content_group_slide',
    allowTouchMove: false,
    direction: 'vertical',
    loop: true,
    slidesPerView: 1,
    watchSlidesProgress: true,
    speed: 900,
    observer: true,
    observeParents: true,
    autoplay: {
      delay: 5000,
      disableOnInteraction: false
    },
    effect: 'creative',
    creativeEffect: {
      limitProgress: 1,
      perspective: true,
      prev: {
        shadow: false,
        opacity: 0.1,
        scale: 1.1,
        translate: [0, '-125%', -500]
      },
      next: {
        translate: [0, '125%', -500],
        opacity: 0.1,
        scale: 1.1
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', function() {
  var feeds = [].slice.call(document.querySelectorAll('.content_group_feed-images'))
    .filter(function(el) { return el.querySelectorAll('.content_group_slide').length > 1; });
  if (!feeds.length) return;

  var swiperReady = window.oaLoadSwiper ? window.oaLoadSwiper() :
    Promise.reject(new Error('window.oaLoadSwiper missing — is oa-slider.js in the sitewide footer?'));
  var loaderDone = document.documentElement.classList.contains('loader-complete')
    ? Promise.resolve()
    : new Promise(function(resolve) {
        document.addEventListener('oa:loader-complete', resolve, { once: true });
      });

  swiperReady.then(function() {
    var swipers = feeds.map(initContentGroupFeed);
    swipers.forEach(function(s) { s.autoplay.stop(); });
    loaderDone.then(function() {
      swipers.forEach(function(s) { s.autoplay.start(); });
    });

    // Same resize shudder fix as oa-homepage.js: creative effect positions each
    // slide by its own transform, which Swiper's ResizeObserver rewrites a frame
    // late. A synchronous update() in the resize event lands before paint.
    var lastVW = window.innerWidth;
    window.addEventListener('resize', function() {
      if (window.innerWidth === lastVW) return;
      lastVW = window.innerWidth;
      swipers.forEach(function(s) { s.update(); });
    });
  }).catch(function(err) {
    console.warn('[oa-content-group]', err.message);
  });
});
