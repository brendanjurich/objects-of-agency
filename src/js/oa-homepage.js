import Swiper from 'swiper';
import { Autoplay, EffectCreative } from 'swiper/modules';

function initHeroFeedTopSwiper() {
  var el = document.querySelector('.hero_feed_top');
  if (!el) return;

  return new Swiper(el, {
    // EffectCreative MUST be in this array — omitting it silently falls back to default slide behaviour
    modules: [Autoplay, EffectCreative],
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
    // EffectCreative MUST be in this array — omitting it silently falls back to default slide behaviour
    modules: [Autoplay, EffectCreative],
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

function initBunnyPlayerBackground() {
  var loaderReady = document.documentElement.classList.contains('loader-complete')
    ? Promise.resolve()
    : new Promise(function(resolve) {
        document.addEventListener('oa:loader-complete', resolve, { once: true });
      });

  document.querySelectorAll('[data-bunny-background-init]').forEach(function(player) {
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

    var isSafariNative = !!video.canPlayType('application/vnd.apple.mpegurl');
    var canUseHlsJs    = !!(window.Hls && Hls.isSupported()) && !isSafariNative;
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
        var hls = new Hls({ maxBufferLength: 10 });
        hls.attachMedia(video);
        hls.on(Hls.Events.MEDIA_ATTACHED, function() { hls.loadSource(src); });
        hls.on(Hls.Events.MANIFEST_PARSED, function() {
          readyIfIdle(player, pendingPlay);
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

    video.addEventListener('play', function() { setActivated(true); setStatus('playing'); });
    video.addEventListener('playing', function() { pendingPlay = false; setStatus('playing'); });
    video.addEventListener('pause', function() { pendingPlay = false; setStatus('paused'); });
    video.addEventListener('waiting', function() { setStatus('loading'); });
    video.addEventListener('canplay', function() { readyIfIdle(player, pendingPlay); });
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

document.addEventListener('DOMContentLoaded', function() {
  initBunnyPlayerBackground();

  // Init Swipers immediately so elements are visible; hold autoplay until video plays
  var topSwiper   = initHeroFeedTopSwiper();
  var rightSwiper = initHeroFeedRightSwiper();
  if (topSwiper)   topSwiper.autoplay.stop();
  if (rightSwiper) rightSwiper.autoplay.stop();

  var portraitMQ = window.matchMedia('(orientation: portrait)');
  function onOrientationFlip() {
    requestAnimationFrame(function () {
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
