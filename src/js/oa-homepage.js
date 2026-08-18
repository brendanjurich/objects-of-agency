/* ============================================================
   OA — homepage hero feeds + Bunny background video
   ------------------------------------------------------------
   Raw-served (no build step). Swiper comes from window.oaLoadSwiper
   (oa-slider.js, sitewide footer) — one Swiper source for the whole
   site; the swiper-bundle registers every module, so no `modules`
   arrays are needed. The background video is a direct MP4 from Bunny
   storage, in two encodes — see initBunnyPlayerBackground below.
   ============================================================ */

function initHeroFeedTopSwiper() {
  var el = document.querySelector('.hero_feed_top');
  if (!el) return;

  return new Swiper(el, {
    wrapperClass: 'hero_feed_top-wrap',
    slideClass: 'hero_feed_top-slide',
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

function initHeroFeedRightSwiper() {
  var el = document.querySelector('.hero_feed_right');
  if (!el) return;

  return new Swiper(el, {
    wrapperClass: 'hero_feed_right-wrap',
    slideClass: 'hero_feed_right-slide',
    allowTouchMove: false,
    direction: 'vertical',
    loop: true,
    // FIXME: Swiper bug — lazyPreloadPrevNext may not reliably strip loading="lazy"
    // on neighbour slides under loop mode. No workaround applied; revisit if blanks persist.
    lazyPreloadPrevNext: 1,
    speed: 900,
    observer: true,
    observeParents: true,
    autoplay: {
      delay: 5000,
      disableOnInteraction: false
    },
    effect: 'creative',
    creativeEffect: {
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

// The HEVC encode's exact codec string. A bare 'hvc1' returns '' even in browsers
// that can decode it, so the full profile.compat.tier+level.constraints is required
// to get a meaningful answer out of canPlayType. Tied to the file: Main profile,
// Main tier, Level 4.0 (encoded with x265 high-tier=0). Re-encode at a different
// level or tier and this string must change with it.
var HEVC_CODEC = 'video/mp4; codecs="hvc1.1.6.L120.90"';

function initBunnyPlayerBackground() {
  var players = document.querySelectorAll('[data-bunny-background-init]');
  if (!players.length) return;

  var loaderReady = document.documentElement.classList.contains('loader-complete')
    ? Promise.resolve()
    : new Promise(function(resolve) {
        document.addEventListener('oa:loader-complete', resolve, { once: true });
      });

  players.forEach(function(player) {
    var video = player.querySelector('video');
    if (!video) return;

    // Four encodes of the same clip, all direct MP4 from Bunny storage: two framings
    // (1920x1080 landscape, 1080x1920 portrait) x two codecs (HEVC, H.264). The codec
    // branch is a real one, not a formality — Chrome and Edge decode HEVC only via a
    // hardware decoder, so Windows without the HEVC extension and desktop Linux both
    // land on H.264.
    //
    // The mobile file is a 9:16 PORTRAIT REFRAME, not a downscale of the landscape
    // one, so orientation is part of the test and not an optional refinement. Handing
    // a portrait file to a landscape phone crops it to a ~26% horizontal sliver of the
    // frame — worse than simply serving the landscape file, which is what happens now.
    //
    // Decided ONCE, here, and never re-evaluated: swapping src on rotate restarts the
    // clip and re-downloads it. A phone rotated after load therefore keeps whichever
    // file it opened with. 767px is Webflow's "small" breakpoint;
    // data-player-mobile-max moves it.
    var mobileMax = parseInt(player.getAttribute('data-player-mobile-max'), 10);
    if (!(mobileMax > 0)) mobileMax = 767;
    var wantsSmall = window.matchMedia(
      '(max-width: ' + mobileMax + 'px) and (orientation: portrait)'
    ).matches;

    // data-player-src (H.264 landscape) is the only required one. Each of the other
    // three degrades independently: clear -hevc and everything takes H.264, clear
    // either -mobile and that codec serves the landscape file to phones — a centre
    // crop, never a broken source. No combination breaks.
    function srcFor(codec) {
      return (wantsSmall && player.getAttribute('data-player-src' + codec + '-mobile')) ||
             player.getAttribute('data-player-src' + codec);
    }
    // One probe covers both HEVC files: same pixel count, same Main profile, same
    // Level, so a device that decodes one decodes the other. Keep it that way — if the
    // two encodes ever diverge in profile or Level, this single string starts lying.
    // A false negative merely drops to H.264; a false POSITIVE is a black hero, because
    // the codec is chosen up front and there is no decode-failure fallback.
    var srcHevc = srcFor('-hevc');
    var src = (srcHevc && video.canPlayType(HEVC_CODEC)) ? srcHevc : srcFor('');
    if (!src) return;

    try { video.pause(); } catch(_) {}
    try { video.removeAttribute('src'); video.load(); } catch(_) {}

    function setStatus(s) {
      if (player.getAttribute('data-player-status') !== s) {
        player.setAttribute('data-player-status', s);
      }
      // Mirrored onto the controls because a control is not necessarily inside the
      // player — see ownerOf() below. The play/pause icon swap is a descendant
      // selector off [data-player-status], so an outside control needs its own copy.
      controls.forEach(function(btn) { btn.setAttribute('data-player-status', s); });
    }
    function setActivated(v) { player.setAttribute('data-player-activated', v ? 'true' : 'false'); }
    if (!player.hasAttribute('data-player-activated')) setActivated(false);

    // Controls usually sit inside the player, but the homepage play/pause lives in the
    // hero CTA row (.hero_feed_cta-wrap) — a sibling branch, outside
    // [data-bunny-background-init] entirely. A control inside a player drives that
    // player; a control outside every player drives the only player on the page. With
    // more than one player an outside control is ambiguous, so it drives nothing
    // rather than guessing.
    function ownerOf(btn) {
      return btn.closest('[data-bunny-background-init]') ||
             (players.length === 1 ? players[0] : null);
    }
    var controls = [].slice.call(document.querySelectorAll('[data-player-control]'))
      .filter(function(btn) { return ownerOf(btn) === player; });

    var lazyMode   = player.getAttribute('data-player-lazy');
    var isLazyTrue = lazyMode === 'true';
    var autoplay   = player.getAttribute('data-player-autoplay') === 'true';
    var initialMuted = player.getAttribute('data-player-muted') === 'true';

    var pendingPlay = false;

    if (autoplay) { video.muted = true; video.loop = true; }
    else { video.muted = initialMuted; }

    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.playsInline = true;
    if (typeof video.disableRemotePlayback !== 'undefined') video.disableRemotePlayback = true;
    if (autoplay) video.autoplay = false;

    var isAttached = false;
    var userInteracted = false;
    var lastPauseBy = '';

    function attachMediaOnce() {
      if (isAttached) return;
      isAttached = true;

      video.preload = isLazyTrue ? 'none' : 'auto';
      video.src = src;
      video.addEventListener('loadedmetadata', function() {
        readyIfIdle(player, pendingPlay);
      }, { once: true });
    }

    if (isLazyTrue) {
      video.preload = 'none';
    } else {
      attachMediaOnce();
    }

    function togglePlay() {
      userInteracted = true;
      if (video.paused || video.ended) {
        if (isLazyTrue && !isAttached) attachMediaOnce();
        pendingPlay = true;
        lastPauseBy = '';
        setStatus('loading');
        safePlay(video);
      } else {
        lastPauseBy = 'manual';
        video.pause();
      }
    }

    function toggleMute() {
      video.muted = !video.muted;
      player.setAttribute('data-player-muted', video.muted ? 'true' : 'false');
    }

    // Delegated on the document, not on the player: a listener on the player can only
    // ever see controls inside it, and the homepage play/pause is not.
    document.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-player-control]');
      if (!btn || ownerOf(btn) !== player) return;
      var type = btn.getAttribute('data-player-control');
      if (type === 'play' || type === 'pause' || type === 'playpause') togglePlay();
      else if (type === 'mute') toggleMute();
    });

    video.addEventListener('play', function() { setStatus('playing'); });
    video.addEventListener('playing', function() { pendingPlay = false; setActivated(true); setStatus('playing'); });
    video.addEventListener('pause', function() { pendingPlay = false; setStatus('paused'); });
    video.addEventListener('waiting', function() { setStatus('loading'); });
    video.addEventListener('canplay', function() { readyIfIdle(player, pendingPlay); });
    // Loader gate (oa-global.js): first frames buffered — safe to reveal, no frame-mush.
    video.addEventListener('canplay', function() {
      document.dispatchEvent(new CustomEvent('oa:hero-media-ready'));
    }, { once: true });
    video.addEventListener('ended', function() { pendingPlay = false; setStatus('paused'); setActivated(false); });

    if (autoplay) {
      if (player._io) { try { player._io.disconnect(); } catch(_) {} }
      var io = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          var inView = entry.isIntersecting && entry.intersectionRatio > 0;
          if (inView) {
            if (isLazyTrue && !isAttached) attachMediaOnce();
            if ((lastPauseBy === 'io') || (video.paused && lastPauseBy !== 'manual')) {
              lastPauseBy = '';
              loaderReady.then(function() {
                if (video.paused && lastPauseBy !== 'manual') {
                  setStatus('loading');
                  togglePlay();
                }
              });
            }
          } else {
            if (!video.paused && !video.ended) {
              lastPauseBy = 'io';
              video.pause();
            }
          }
        });
      }, { threshold: 0.1 });
      io.observe(player);
      player._io = io;
    }
  });

  function readyIfIdle(player, pendingPlay) {
    if (!pendingPlay &&
        player.getAttribute('data-player-activated') !== 'true' &&
        player.getAttribute('data-player-status') === 'idle') {
      player.setAttribute('data-player-status', 'ready');
    }
  }

  function safePlay(video) {
    var p = video.play();
    if (p && typeof p.then === 'function') p.catch(function(){});
  }
}

// Pin the hero to the *actually visible* viewport height. CSS svh can't see
// browser UI that WebKit doesn't report as chrome (e.g. Arc iOS's floating
// pill), so the hero renders too tall and sits behind it; window.innerHeight
// does see it. Measured on load + on orientation/width change only — never on
// height-only toolbar show/hide, which would be wasted work (the hero height is
// pinned, it does not track the toolbar). CSS `100svh` is the pre-JS fallback.
function setHeroHeight() {
  if (!document.querySelector('.crisp-header')) return;
  document.documentElement.style.setProperty('--hero-h', window.innerHeight + 'px');
}

document.addEventListener('DOMContentLoaded', function() {
  initBunnyPlayerBackground();

  var topSwiper   = null;
  var rightSwiper = null;

  // Swiper arrives via the shared loader in oa-slider.js (single sitewide
  // source — no bundled copy). Hold autoplay until the video plays, unless
  // startHeroFeed already fired while the bundle was still loading.
  var swiperReady = window.oaLoadSwiper ? window.oaLoadSwiper() :
    Promise.reject(new Error('window.oaLoadSwiper missing — is oa-slider.js in the sitewide footer?'));
  swiperReady.then(function() {
    topSwiper   = initHeroFeedTopSwiper();
    rightSwiper = initHeroFeedRightSwiper();
    if (!started) {
      if (topSwiper)   topSwiper.autoplay.stop();
      if (rightSwiper) rightSwiper.autoplay.stop();
    }
  }).catch(function(err) {
    console.warn('[oa-homepage]', err.message);
    // Fail-open: the FOUC guard hides slides until .swiper-initialized — reveal them.
    document.querySelectorAll('.hero_feed_top, .hero_feed_right').forEach(function(el) {
      el.classList.add('swiper-initialized');
    });
  });

  setHeroHeight();

  // Resize shudder fix. With effect:'creative' Swiper uses virtualTranslate, so
  // each slide is positioned by an individual transform of magnitude
  // activeIndex × slideSize. Swiper's ResizeObserver rewrites those transforms
  // one frame AFTER the browser reflows on resize, so for that frame the active
  // slide is displaced by activeIndex × ΔslideSize — amplified by loop's deep
  // activeIndex (pronounced on hero_feed_right). A synchronous update() in the
  // resize event runs before paint, recomputing the transforms in the same frame
  // as the reflow so the jump never renders. Must stay synchronous — rAF/debounce
  // would defer past paint and reintroduce the shudder.
  // Gated to width changes: mobile fires resize on every toolbar show/hide while
  // scrolling (height only), where re-measuring and updating is wasted work — the
  // hero height is pinned (--hero-h) and only changes on orientation flip.
  var lastVW = window.innerWidth;
  window.addEventListener('resize', function () {
    if (window.innerWidth === lastVW) return;
    lastVW = window.innerWidth;
    setHeroHeight();
    if (topSwiper)   topSwiper.update();
    if (rightSwiper) rightSwiper.update();
  });

  var portraitMQ = window.matchMedia('(orientation: portrait)');
  function onOrientationFlip() {
    requestAnimationFrame(function () {
      setHeroHeight();
      if (topSwiper) topSwiper.update();
      if (rightSwiper) rightSwiper.update();
    });
  }
  if (portraitMQ.addEventListener) portraitMQ.addEventListener('change', onOrientationFlip);
  else portraitMQ.addListener(onOrientationFlip); // legacy iOS Safari <14

  var started = false;
  function startHeroFeed() {
    if (started) return;
    started = true;
    document.documentElement.classList.add('hero-playing');
    if (topSwiper)   topSwiper.autoplay.start();
    if (rightSwiper) rightSwiper.autoplay.start();
  }

  var bgVideo = document.querySelector('[data-bunny-background-init] video');
  if (bgVideo) {
    bgVideo.addEventListener('playing', startHeroFeed, { once: true });
    // Fallback: if video never plays, start hero feed 4s after loader completes
    var loaderDone = document.documentElement.classList.contains('loader-complete')
      ? Promise.resolve()
      : new Promise(function(resolve) {
          document.addEventListener('oa:loader-complete', resolve, { once: true });
        });
    loaderDone.then(function() { setTimeout(startHeroFeed, 4000); });
  } else {
    startHeroFeed();
  }
});
