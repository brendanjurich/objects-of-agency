/* ============================================================
   OA — About page intro
   ------------------------------------------------------------
   Video beat → background blur → ABOUT scrambles into place.
   Blur and title start on the same frame and resolve together,
   so the sequence lands in one moment rather than two.

   Started life as an adaptation of osmo.supply's "Welcoming
   Words Loader" (v1.0.160). Nothing of that resource survives:
   the word list, the roll, the dot and the two wrapper divs
   they needed were all removed at v1.0.162, leaving a single
   text element.

   Notes:
     • No CDN GSAP. Uses Webflow-native window.gsap, and fails
       open (end state, no animation) when it is absent.
     • ScrambleTextPlugin is enabled site-wide in Webflow's GSAP
       integration, so nothing is loaded here. A missing plugin
       degrades to a plain fade rather than failing.
     • Gated on real readiness — the page's own reveal raced
       against a cap, plus the hero video's `canplay` raced
       against a cap — so the opening beat is real moving
       picture, not an empty box.
     • Beat timings are Designer knobs (data-oa_about_intro-*),
       following the data-draw-duration precedent, so retuning
       never needs a redeploy.
     • Reduced motion lands the end state with zero tweens and
       pauses the video.
   Page-level embed (/about). Raw-served (no build).
   ============================================================ */

function initAboutIntro() {
  const mount = document.querySelector('[data-oa_about_intro-container]');
  if (!mount) return; // not the About page — no-op

  const title = mount.querySelector('[data-oa_about_word-target]');
  const blur = document.querySelector('[data-oa_about_video-blur]');
  const vidWrap = document.querySelector('[data-oa_about_vid-wrap]');
  const video = vidWrap ? vidWrap.querySelector('video') : null;

  if (!title || !blur) {
    console.warn('[oa-about] intro markup incomplete — skipping init.');
    return;
  }

  // Whatever the Designer holds is the word — never hardcode it here.
  const finalText = title.textContent.trim();

  // The finished frame, used by the reduced-motion branch and the no-GSAP
  // fallback so both land somewhere deliberate rather than mid-sequence.
  const endState = () => {
    blur.style.opacity = '1';
    title.style.opacity = '1';
    title.textContent = finalText;
  };

  if (!window.gsap) {
    console.warn('[oa-about] gsap unavailable — skipping intro animation.');
    endState();
    return;
  }

  const Scramble = window.ScrambleTextPlugin;
  if (Scramble) {
    gsap.registerPlugin(Scramble); // no-op if Webflow already registered it
  } else {
    console.warn('[oa-about] ScrambleTextPlugin unavailable — title will fade instead.');
  }

  // Designer-owned beats. Read live so retuning is a publish, not a redeploy.
  const knob = (name, fallback) => {
    const raw = parseFloat(mount.getAttribute('data-oa_about_intro-' + name));
    return isNaN(raw) ? fallback : raw;
  };
  const HOLD = knob('hold', 2.3); // clean video before anything moves
  const BLUR = knob('blur', 1); // blur crossfade
  const SCRAMBLE = knob('scramble', 1); // how long the title takes to resolve

  // Starting frame. Safe to set here without a CSS pre-hide: /about carries
  // [data-page-transition], so oa-styles.css is still holding the whole page
  // at opacity 0 and oa-global.js does not reveal it until window.load.
  gsap.set(blur, {opacity: 0});
  gsap.set(title, {opacity: 0});

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // Branch, not kill: keep the end state, create zero tweens, and stop the
    // looping video — it is auto-playing motion with no pause control.
    gsap.set(blur, {opacity: 1});
    gsap.set(title, {opacity: 1});
    title.textContent = finalText;
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

    tl.to(blur, {
      opacity: 1,
      duration: BLUR,
      ease: 'power4.out',
      // Hint only for the duration of the tween — a permanent will-change on
      // a backdrop-filter layer is an expensive thing to leave lying around.
      onStart: () => { blur.style.willChange = 'opacity'; },
      onComplete: () => { blur.style.willChange = ''; },
    }, 0);

    // Fades quickly and then keeps resolving, so the scramble — not the
    // fade — is what reads as the entrance.
    tl.to(title, {opacity: 1, duration: 0.3, ease: 'power2.out'}, 0);

    if (Scramble) {
      tl.to(title, {
        duration: SCRAMBLE,
        scrambleText: {text: finalText, chars: 'upperCase', speed: 0.5},
      }, 0);
    }
  });
}

// Initialize About page intro
document.addEventListener('DOMContentLoaded', () => {
  initAboutIntro();
});
