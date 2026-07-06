/* ============================================================
   OA — homepage hero feeds + Bunny background video
   ------------------------------------------------------------
   Raw-served (no build step). Swiper comes from window.oaLoadSwiper
   (oa-slider.js, sitewide footer) — one Swiper source for the whole
   site; the swiper-bundle registers every module, so no `modules`
   arrays are needed. hls.js is injected on demand below, only when a
   Bunny background player exists on the page.
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

// hls.js, injected on demand. This used to be a parser-blocking 157KB sitewide
// footer <script> that every page paid for while only pages with a Bunny player
// use it. Exact-pinned; bumping the version requires re-testing video.
var HLS_VERSION = '1.6.11';
function loadHls() {
  return new Promise(function(resolve) {
    if (window.Hls) return resolve();
    var script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/hls.js@' + HLS_VERSION;
    script.onload = resolve;
    script.onerror = resolve; // fail-open — the init below falls back to direct video.src
    document.head.appendChild(script);
  });
}

function initBunnyPlayerBackground() {
  var players = document.querySelectorAll('[data-bunny-background-init]');
  if (!players.length) return;

  var loaderReady = document.documentElement.classList.contains('loader-complete')
    ? Promise.resolve()
    : new Promise(function(resolve) {
        document.addEventListener('oa:loader-complete', resolve, { once: true });
      });

  loadHls().then(function() {
  players.forEach(function(player) {
    var src = player.getAttribute('data-player-src');
    if (!src) return;

    var video = player.querySelector('video');
    if (!video) return;

    try { video.pause(); } catch(_) {}
    try { video.removeAttribute('src'); video.load(); } catch(_) {}

    function setStatus(s) {
      if (player.getAttribute('data-player-status') !== s) {
        player.setAttribute('data-player-status', s);
      }
    }
    function setActivated(v) { player.setAttribute('data-player-activated', v ? 'true' : 'false'); }
    if (!player.hasAttribute('data-player-activated')) setActivated(false);

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

    // Prefer hls.js wherever it's supported; native HLS is the Safari-only fallback.
    // Chrome returns "maybe" for canPlayType('application/vnd.apple.mpegurl'), so gating
    // on canPlayType wrongly flagged Chrome as Safari-native and bypassed hls.js entirely —
    // taking our ABR config + error recovery offline with it.
    var canUseHlsJs    = !!(window.Hls && Hls.isSupported());
    var isSafariNative = !canUseHlsJs && !!video.canPlayType('application/vnd.apple.mpegurl');
    if (!window.Hls && !isSafariNative) { console.warn('[OA] HLS.js not loaded — falling back to direct video.src. Adaptive streaming unavailable.'); }

    var isAttached = false;
    var userInteracted = false;
    var lastPauseBy = '';

    function attachMediaOnce() {
      if (isAttached) return;
      isAttached = true;

      if (player._hls) { try { player._hls.destroy(); } catch(_) {} player._hls = null; }

      if (isSafariNative) {
        video.preload = isLazyTrue ? 'none' : 'auto';
        video.src = src;
        video.addEventListener('loadedmetadata', function() {
          readyIfIdle(player, pendingPlay);
        }, { once: true });
      } else if (canUseHlsJs) {
        var hls = new Hls({
          maxBufferLength: 10,
          abrEwmaDefaultEstimate: 3000000, // seed ~3Mbps so ABR cold-starts on a sharp rung, not the lowest (kills the blurry first 1-2s)
          capLevelToPlayerSize: true        // backdrop never needs 1080p — caps wasted bytes
        });
        hls.attachMedia(video);
        hls.on(Hls.Events.MEDIA_ATTACHED, function() { hls.loadSource(src); });
        hls.on(Hls.Events.MANIFEST_PARSED, function() {
          readyIfIdle(player, pendingPlay);
        });
        // hls.js self-heal: without an ERROR handler a fatal network/media error
        // (e.g. a connection drop mid-playback) halts fragment loading for good and
        // the video never resumes. Recover per hls.js's documented pattern.
        hls.on(Hls.Events.ERROR, function(_, data) {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
          else if (data.type === Hls.ErrorTypes.NETWORK_ERROR) { if (navigator.onLine) hls.startLoad(); }
          else { try { hls.destroy(); } catch(_) {} }
        });
        // Connection restored after a full drop: restart loading and resume — but
        // only if it was still mid-playback (not manually paused / scrolled away).
        window.addEventListener('online', function() {
          if (player._hls && !video.paused) { player._hls.startLoad(); safePlay(video); }
        });
        player._hls = hls;
      } else {
        video.src = src;
      }
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

    player.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-player-control]');
      if (!btn || !player.contains(btn)) return;
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
  }); // loadHls().then — per-player setup waits for the on-demand hls.js inject

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
