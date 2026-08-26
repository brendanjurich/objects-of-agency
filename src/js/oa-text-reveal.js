/* ============================================================
   OA — Text reveal
   ------------------------------------------------------------
   Section headings and lead paragraphs blur in line by line as
   they scroll into view, with a short character scramble riding
   the front of each line. The scramble is over well before the
   blur resolves, so the two read as one gesture rather than two
   effects.

   Audited from oimachi.co on 26-08-2026 and rebuilt, not ported.
   Their version hand-rolls the whole thing: a TreeWalker splitter
   and one gsap.delayedCall per character per step (~150 tweens a
   heading), with lines measured once at DOMReady and frozen into
   `inline-block; white-space:pre` boxes that can never re-wrap —
   resize the window and the text overflows. SplitText's autoSplit
   and ScrambleTextPlugin replace both, and bring the aria handling
   their per-character spans lacked.

   Notes:
     • No CDN GSAP. Uses Webflow-native window.gsap and fails open
       (text visible, static) when GSAP, ScrollTrigger or SplitText
       is absent.
     • ScrambleTextPlugin is enabled site-wide in Webflow's GSAP
       integration, so nothing is loaded here. A missing plugin
       degrades to a plain blur-in rather than failing.
     • Opt in per element with data-oa-reveal in the Designer.
       Behavioural hook, so an attribute — same as every other hook
       in oa-global.js. Never a blanket h1/h2 selector: that would
       catch the nav, buttons, and the intro hero's own scramble.
     • Timings are Designer knobs (data-oa_reveal_*) on the element,
       following the data-oa_intro_* precedent, so retuning is a
       publish, not a redeploy. Defaults are Oimachi's numbers.
     • The pre-hide lives in oa-styles.css under Webflow's own
       .w-mod-js, so a dead script leaves every block visible.
     • Gated on oa:loader-complete — an above-the-fold heading would
       otherwise burn its reveal behind the loader — and on fonts
       being ready, since line breaks measured in a fallback face
       are the wrong line breaks.
     • Reduced motion lands the end state with zero tweens and no
       split at all.
   Sitewide footer embed, after oa-global.js. Raw-served (no build).
   ============================================================ */

// Defaults are Oimachi's, measured off their live page: 10px blur, 1s
// power2.out, 0.15s between lines, and a 0.4s scramble — deliberately much
// shorter than the blur, which is what stops it reading as a separate effect.
var OA_REVEAL_DEFAULTS = {
  blur: 10,
  duration: 1,
  stagger: 0.15,
  scramble: 0.4,
  start: 'top 90%',
};

// Releases the CSS pre-hide. Every exit path calls this — including the
// fail-open ones — or the blocks stay invisible for the life of the page.
function releaseTextReveal() {
  document.documentElement.classList.add('oa-reveal-ready');
}

function initTextReveal() {
  var blocks = document.querySelectorAll('[data-oa-reveal]');
  if (!blocks.length) { releaseTextReveal(); return; } // page carries none — no-op

  var SplitTextPlugin = window.SplitText;
  if (!window.gsap || !window.ScrollTrigger || !SplitTextPlugin) {
    console.warn('[oa-text-reveal] GSAP, ScrollTrigger or SplitText unavailable — text left static.');
    releaseTextReveal();
    return;
  }
  gsap.registerPlugin(ScrollTrigger, SplitTextPlugin); // no-op if Webflow already registered them

  var Scramble = window.ScrambleTextPlugin;
  if (Scramble) {
    gsap.registerPlugin(Scramble);
  } else {
    console.warn('[oa-text-reveal] ScrambleTextPlugin unavailable — lines will blur in without the scramble.');
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // Branch, not kill: no split, no tweens, no per-line divs. The blur and the
    // character flicker are both squarely in what reduce asks us to drop.
    releaseTextReveal();
    return;
  }

  // --- Readiness gate -------------------------------------------------
  // Splitting before the webfont swaps in measures line breaks in the fallback
  // face, so autoSplit would immediately re-split and the first frame would be
  // wrong. Race against a cap so a font that never resolves can't hold the
  // text hostage — same idiom as the loader and oa-intro.
  var fontsReady = !document.fonts || document.fonts.status === 'loaded'
    ? Promise.resolve()
    : Promise.race([
        document.fonts.ready,
        new Promise(function (resolve) { setTimeout(resolve, 1500); }),
      ]);

  var loaderDone = document.documentElement.classList.contains('loader-complete')
    ? Promise.resolve()
    : new Promise(function (resolve) {
        document.addEventListener('oa:loader-complete', resolve, { once: true });
      });

  Promise.all([fontsReady, loaderDone]).then(function () {
    blocks.forEach(buildBlock);
    releaseTextReveal();
    // Masonry, lazy images and the page transition all settle around now; start
    // positions measured before that are stale.
    ScrollTrigger.refresh();
  });

  function buildBlock(block) {
    var knob = function (name, fallback) {
      var raw = parseFloat(block.getAttribute('data-oa_reveal_' + name));
      return isNaN(raw) ? fallback : raw;
    };
    var BLUR = knob('blur', OA_REVEAL_DEFAULTS.blur);
    var DURATION = knob('duration', OA_REVEAL_DEFAULTS.duration);
    var STAGGER = knob('stagger', OA_REVEAL_DEFAULTS.stagger);
    var SCRAMBLE = knob('scramble', OA_REVEAL_DEFAULTS.scramble);
    var START = block.getAttribute('data-oa_reveal_start') || OA_REVEAL_DEFAULTS.start;

    var played = false;

    // Split the text leaves, not the block. Handed a container, SplitText wraps
    // the whole subtree as a single "line": nothing staggers, and every line then
    // carries markup — which trips the scramble guard in play() and drops the
    // gesture outright. Splitting the leaves gives back plain-text lines the
    // scramble can rewrite. One instance over several targets keeps the lines in
    // document order, so heading and paragraph share one stagger and still read
    // as one gesture. A block that IS the text — the attribute straight on an h2,
    // as the Designer usage describes — has no leaves and splits itself.
    var leaves = block.querySelectorAll('h1, h2, h3, h4, h5, h6, p');
    var targets = leaves.length ? leaves : block;

    // aria:'auto' puts the full text on each target as an aria-label and marks
    // every line aria-hidden, so a screen reader still hears one sentence.
    // autoSplit re-measures on resize and font swap — the thing Oimachi's
    // frozen inline-block lines can't do.
    var split = SplitTextPlugin.create(targets, {
      type: 'lines',
      aria: 'auto',
      autoSplit: true,
      linesClass: 'oa-reveal_line',
      onSplit: function (self) {
        // A re-split hands back fresh line divs with no inline styles. Before
        // the reveal that means re-arming them; after it, the end state is
        // simply the browser default, so there is nothing to restore.
        if (played) return;
        gsap.set(self.lines, { opacity: 0, filter: 'blur(' + BLUR + 'px)' });
      },
    });

    ScrollTrigger.create({
      trigger: block,
      start: START,
      once: true,
      onEnter: function () {
        played = true;
        play(split.lines);
      },
    });

    function play(lines) {
      lines.forEach(function (line, i) {
        var delay = i * STAGGER;

        // Hint only for the duration of the tween — a permanent will-change on
        // a blurred layer is an expensive thing to leave lying around.
        line.style.willChange = 'opacity, filter';

        gsap.to(line, {
          opacity: 1,
          filter: 'blur(0px)',
          duration: DURATION,
          delay: delay,
          ease: 'power2.out',
          onComplete: function () {
            // Clear the property outright rather than resting at blur(0px):
            // an applied filter still costs a stacking context and a
            // rasterisation pass for the life of the page.
            line.style.filter = '';
            line.style.willChange = '';
          },
        });

        // ScrambleTextPlugin rewrites its target as plain text, which would
        // permanently flatten any inline markup in the line — a styled span,
        // an <em>, a link. Those lines blur in without the scramble; losing
        // the flicker on one line beats losing the author's formatting.
        if (!Scramble || line.querySelector('*')) return;

        gsap.to(line, {
          duration: SCRAMBLE,
          delay: delay + 0.05,
          // speed 0.5 ≈ 10 character changes a second, matching the coarse
          // 100ms step Oimachi gets from four hand-scheduled swaps.
          scrambleText: { text: line.textContent, chars: 'upperAndLowerCase', speed: 0.5 },
        });
      });
    }
  }
}

// Footer script, so the markup is already parsed and GSAP is already injected.
// DOMContentLoaded only to stay in step with oa-global.js's other inits — the
// real gate is the loader/fonts race above.
document.addEventListener('DOMContentLoaded', function () {
  initTextReveal();
});
