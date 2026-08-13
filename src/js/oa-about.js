/* ============================================================
   OSMO — Welcoming Words (About page intro)
   ------------------------------------------------------------
   Adapted for Objects of Agency from osmo.supply's "Welcoming
   Words Loader". Differences from the stock resource:
     • Not a loader. No fixed curtain, no page reveal, no scroll
       lock — this plays in place inside the About hero and the
       page stays scrollable throughout.
     • No CDN GSAP. Uses Webflow-native window.gsap, and fails
       open (end state, no animation) when it is absent.
     • Gated on real readiness — the page's own reveal raced
       against a cap, plus the hero video's `canplay` raced
       against a cap — so the opening beat is real moving
       picture, not an empty box.
     • Adds a background-blur crossfade the stock resource has
       no equivalent for: opacity on a backdrop-filter overlay,
       the same mechanism akercompanies.com/about uses.
     • Stock's exit (words fly out, whole container fades away)
       is replaced by a settle — the rolling text lifts out, a
       beat passes, then ABOUT rises into the same grid cell.
       The dot never moves; it anchors the lockup end to end.
     • Beat timings are Designer knobs (data-oa_about_intro-*),
       following the data-draw-duration precedent, so retuning
       the sequence never needs a redeploy.
     • Reduced motion lands the end state with zero tweens and
       pauses the video.
   Page-level embed (/about). Raw-served (no build).
   ============================================================ */

function initAboutIntro() {
  const mount = document.querySelector('[data-oa_about_intro-container]');
  if (!mount) return; // not the About page — no-op

  const words = mount.querySelector('[data-oa_about_loading-words]');
  const target = mount.querySelector('[data-oa_about_loading-words-target]');
  const title = mount.querySelector('[data-oa_about_word]');
  const blur = document.querySelector('[data-oa_about_video-blur]');
  const vidWrap = document.querySelector('[data-oa_about_vid-wrap]');
  const video = vidWrap ? vidWrap.querySelector('video') : null;

  if (!words || !target || !title || !blur) {
    console.warn('[oa-about] intro markup incomplete — skipping init.');
    return;
  }

  // The finished frame: blur up, rolling text gone, ABOUT settled.
  // Used by the reduced-motion branch and the no-GSAP fallback, so both
  // land somewhere deliberate rather than mid-sequence.
  const endState = () => {
    blur.style.opacity = '1';
    target.style.opacity = '0';
    title.style.opacity = '1';
    title.style.transform = 'none';
  };

  if (!window.gsap) {
    console.warn('[oa-about] gsap unavailable — skipping intro animation.');
    endState();
    return;
  }

  // Designer-owned beats. Read live so retuning is a publish, not a redeploy.
  const knob = (name, fallback) => {
    const raw = parseFloat(mount.getAttribute('data-oa_about_intro-' + name));
    return isNaN(raw) ? fallback : raw;
  };
  const HOLD = knob('hold', 2); // clean video before anything moves
  const BLUR = knob('blur', 0.8); // blur crossfade
  const STEP = knob('interval', 0.15); // per word
  const BEAT = knob('beat', 0.2); // the pause before ABOUT

  const list = (words.getAttribute('data-oa_about_loading-words') || '')
    .split(',')
    .map(w => w.trim())
    .filter(Boolean);

  // Starting frame. Safe to set here without a CSS pre-hide: /about carries
  // [data-page-transition], so oa-styles.css is still holding the whole page
  // at opacity 0 and oa-global.js does not reveal it until window.load.
  gsap.set(blur, {opacity: 0});
  gsap.set(words, {opacity: 0, yPercent: 50});
  gsap.set(title, {opacity: 0, yPercent: 40});

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // Branch, not kill: keep the end state, create zero tweens, and stop the
    // looping video — it is auto-playing motion with no pause control.
    gsap.set(blur, {opacity: 1});
    gsap.set(words, {opacity: 1, yPercent: 0});
    gsap.set(target, {opacity: 0});
    gsap.set(title, {opacity: 1, yPercent: 0});
    target.textContent = list[list.length - 1] || target.textContent;
    if (video) video.pause();
    return;
  }

  // --- Readiness gate -------------------------------------------------
  // The opening beat is only worth anything if there is a moving picture
  // under it, so wait for the video — but never let a slow asset hold the
  // sequence hostage. Same race-against-a-cap idiom as the loader.
  const pageReady = document.readyState === 'complete'
    ? Promise.resolve()
    : Promise.race([
        new Promise(resolve => window.addEventListener('load', resolve, {once: true})),
        new Promise(resolve => setTimeout(resolve, 1200)),
      ]);

  const videoReady = !video || video.readyState >= 3
    ? Promise.resolve()
    : Promise.race([
        new Promise(resolve => video.addEventListener('canplay', resolve, {once: true})),
        new Promise(resolve => setTimeout(resolve, 2000)),
      ]);

  Promise.all([pageReady, videoReady]).then(() => {
    const tl = gsap.timeline({delay: HOLD});

    // Blur rises on its own. Nothing else moves under it — sequential by
    // request; overlapping the entrance into this tail is what buys the
    // second back if the beat reads long.
    tl.to(blur, {
      opacity: 1,
      duration: BLUR,
      ease: 'power4.out',
      // Hint only for the duration of the tween — a permanent will-change on
      // a backdrop-filter layer is an expensive thing to leave lying around.
      onStart: () => { blur.style.willChange = 'opacity'; },
      onComplete: () => { blur.style.willChange = ''; },
    });

    // Lockup rises in whole — dot and word together.
    tl.to(words, {opacity: 1, yPercent: 0, duration: 0.45, ease: 'power4.out'});

    // The roll. Stock behaviour: a plain text swap, no per-word motion —
    // the rhythm is the effect.
    list.forEach(word => {
      tl.call(() => { target.textContent = word; }, null, '+=' + STEP);
    });

    // The settle. Text leaves fast and light, a beat of nothing, then ABOUT
    // arrives on the same curve as the blur so the two big moments rhyme.
    tl.to(target, {opacity: 0, yPercent: -40, duration: 0.3, ease: 'power2.in'}, '+=' + STEP);
    tl.to(title, {opacity: 1, yPercent: 0, duration: 0.5, ease: 'power4.out'}, '+=' + BEAT);
  });
}

// Initialize About page intro
document.addEventListener('DOMContentLoaded', () => {
  initAboutIntro();
});
