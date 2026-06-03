# Session Findings

Append-only. One entry per session that touched production code or surfaced a non-obvious behaviour, corrected assumption, or deliberate decision worth preserving. Not every session — only when a gotcha would bite again.

---

## 2026-05-27 — Defensive improvements, dependency lock, v1.0.78

### HLS.js warn requires `!isSafariNative` guard

In `oa-homepage.js`, the warn for missing HLS.js must be:

```js
if (!window.Hls && !isSafariNative) { console.warn(...) }
```

`!window.Hls` alone fires on Safari, where `isSafariNative = true` and HLS.js is intentionally absent. `isSafariNative` is declared one line above the warn — it's in scope.

### Array `.length`, not `.size` for filter token check

In `oa-all-products.js`, `tokens` from `.split().filter()` is an **Array**, not a Set. Use `tokens.length === 0`, not `tokens.size === 0`. Sets have `.size`; Arrays do not.

### Lumos null guard already existed — enhance, don't duplicate

The Lumos Swiper patch forEach in `oa-global.js` already had a silent `if (!sw) return`. The fix was to **replace** it with a warned version — not to add a new guard before it. Adding both would produce redundant guards.

### Slideshow thumb document-scope is intentional

In `initSlideShow()`, thumb elements are queried at document scope as a fallback:

```js
thumbs: Array.from(thumbsInEl.length ? thumbsInEl : document.querySelectorAll('[data-slideshow="thumb"]'))
```

This is correct. Thumbs live in `.hero_feed_nav_wrap` as siblings of the slideshow container, not children — added intentionally in v1.0.64. The comment `// Intentional: thumbs are siblings...` documents this.

### FOUC prevention CSS is a separate concern from the flex layout issue

The `.hero_feed_top` flex issue was resolved in Webflow Designer (layout settings). The `opacity:0; visibility:hidden` pattern restored by `.swiper-initialized` is a separate FOUC guard — it prevents a flash of unstyled slides before Swiper initialises. Keep both; they solve different problems.

### Configurator hardcoding is intentional — refactor not worth it

`fixRadioIds()` and `initSummaryUpdater()` hardcode radio `name` attributes (`Sizes`, `Top-Material`, `Timber`, `Anodised-Finish`). A data-driven refactor was evaluated and rejected:

- The option list is stable — it's set in Webflow Designer and rarely changes.
- Any configurator change already requires a code release; the hardcoding adds no extra friction.
- A data-driven version would add an invisible Webflow attribute dependency with no grep trail.

Decision: keep hardcoded. Comment above `fixRadioIds()` documents the coupling and lists current options.

### Always rebuild dist before tagging when oa-homepage.js changes

`dist/oa-homepage.js` is the CDN-served bundle. Tagging without rebuilding serves stale code. Run `npm run build` and verify the bundle before `git tag`. Now documented in CLAUDE.md under Dependency Versions and Constraints.

### Orientation re-layout: use matchMedia, not orientationchange

Two failed attempts before the working fix, worth recording so we don't loop back:

1. **150ms debounce after `orientationchange`** (v1.0.84–85, original) — too short; `getBoundingClientRect()` returns pre-rotation dimensions on iOS Safari, leaving transforms stale.
2. **Wait for the `resize` event after `orientationchange`** (the obvious "fix") — works on iOS Safari and iOS Chrome, but **`orientationchange` fires unreliably on Firefox and Arc mobile**, so the handler never runs there at all.

The reliable cross-browser pattern (v1.0.86) is to listen for `matchMedia('(orientation: portrait)')` `change`, which fires consistently across browsers *after* the viewport dimensions have flipped, then re-measure inside a `requestAnimationFrame`:

```js
var portraitMQ = window.matchMedia('(orientation: portrait)');
function onOrientationFlip() {
  requestAnimationFrame(function () { /* measure / swiper.update() here */ });
}
if (portraitMQ.addEventListener) portraitMQ.addEventListener('change', onOrientationFlip);
else portraitMQ.addListener(onOrientationFlip); // legacy iOS Safari <14
```

Applied in `oa-configurator.js` (cascading slider re-measure) and `oa-homepage.js` (`swiper.update()` on both hero feed carousels).

### Configurator summary is coupled to slider animation state — guard against dropped clicks

The swatch radio labels contain only an `<img>` (no text), so `initSummaryUpdater()` sources the material name from the slider's active slide (`[data-cascading-slide][data-status="active"]`), not from the radio itself. Two consequences bit us:

- `goTo()` had `if (isAnimating) return;` — a swatch click landing during the 650ms animation was silently dropped. The browser still natively checks the clicked radio, but the slider never moved and `syncRadio()` never reconciled, so radio + slider + summary diverged (summary stuck on the previous/default material). Fix: queue the last requested index (`pendingTarget`) and run it when the animation completes, instead of dropping.
- `syncRadio()` (which dispatches the `change` that drives the summary) must run **after** `layout()` (which sets `data-status="active"`), or the summary reads the previous active slide. Single clicks self-corrected via the original event's bubble-phase re-read, masking the bug; rapid/queued clicks did not.
- **Multiple slides could be marked `active` at once.** `layout()`'s off-screen branch (`|offset| > 3`) returned early *without* touching `data-status`. A slide jumping straight from active (offset 0) to off-screen — which happens on big jumps between distant swatches, but never on single-step moves — kept a stale `data-status="active"`. The summary's `querySelector('[data-status="active"]')` then returned whichever stale-or-current active slide came first in DOM order. Fix: off-screen slides are explicitly set `inactive`, guaranteeing exactly one active slide. This was why sequential clicks tested fine but real users (clicking distant swatches) saw wrong/default summaries.

If summary behaviour regresses, check: (1) `goTo()` ordering (`layout` before `syncRadio`), (2) clicks aren't dropped mid-animation, (3) exactly one slide has `data-status="active"` after a transition.

---

### Exact GSAP and Lumos versions still need recording

CLAUDE.md has placeholders for the GSAP CDN URL and Lumos version — both loaded by Webflow, not npm. Record the exact URLs from Webflow → Site Settings → Custom Code before any library-touching changes.

---

## 2026-06-03 — Page transition (content fade-through), v1.0.90 / v1.0.91

### Page transitions: Barba was rejected — this site can't be an SPA

The osmo "cross-fade page transition" resource ships a Barba.js SPA integration. It is the wrong tool here and should not be revisited. **Every interactive module inits on `DOMContentLoaded`/`window.load`** — events that fire once and never re-fire after a Barba container swap: `oa-homepage.js` (Swipers + bunny video), `oa-all-products.js` (Finsweet filter), `oa-configurator.js` (cascading slider), `oa-global.js` (slideshow + Lumos patch). Two of those are **page-level embeds Barba won't even execute on nav**, and Webflow IX2 / Lumos / Finsweet would each need bespoke re-init per swap. Barba's bundle also re-loads `gsap@3.15` + `lenis@1.3.17` (we already get GSAP from Webflow and ship `lenis@1.3.23`) and calls `gsap.defaults({ease:"osmo"})`, which would silently rewrite tween defaults site-wide. Chosen instead: a no-Barba **content fade-through** on normal full page loads (`initPageTransition()` in oa-global.js §4) — zero re-init risk.

### `data-page-transition` is an invisible attribute dependency (fail-blank risk)

The fade-through fades any element carrying `data-page-transition` (in Webflow, the main content wrapper(s) — `.section_main_wrap` + `footer.footer_main_wrap`; nav is a sibling *outside* so it persists). oa-styles.css pre-hides those elements (`html.w-mod-js:not(.wf-design-mode) [data-page-transition] { opacity:0 }`) and `initPageTransition()` fades them in. **If `oa-global.js` fails to load, tagged content stays `opacity:0` → blank page.** This is the same risk class the nav already carries (same guard pattern), not a new failure mode — but any change to the loader-complete flow or the attribute must keep the reveal path intact. Feature is a silent no-op if nothing is tagged.

### Leave-fade stops Lenis → must restart it on bfcache restore

The leave handler calls `window.lenis.stop()` before navigating. Back/forward from **bfcache reuses the same JS heap**, so Lenis returns *stopped* and the restored page won't scroll. Fix: the `pageshow` handler restarts Lenis (and restores `autoAlpha:1`) when `e.persisted`. Any future leave logic that touches Lenis/scroll-lock must mirror a restore in `pageshow.persisted`.

### Reference: aker.companies is a heavy branded-loader cover, not a fade-through

Audited live (akercompanies.com). aker is **not** Barba and **not** a fade-through: a custom script intercepts every `<a>` click → fires a Webflow IX2 animation playing a full-screen `.page-loader` (z999) with a logo Lottie (`akersymbol3_white.json`) → hard `setTimeout(1200ms)` before navigating. So every internal click costs ~1.2s + a Lottie render — the "heavy logo on every click" feel. Their Lenis (`lerp:0.2`) and ScrollTrigger+SplitText reveals match our stack. Our fade-through is deliberately lighter and keeps the branded loader to first-visit/home only.

---

## 2026-06-03 — Page transition pivot to overlay cover + load-gate

### The pop-in bug was a reveal-timing bug, not an easing one

The content fade-through felt smooth on cached pages but "lost the timing" on uncached ones — images popped in *behind* the fade. Root cause: on internal (no-loader) pages, `initLogoRevealLoader()` calls `revealAfterLoader()` synchronously during `DOMContentLoaded`, firing `oa:loader-complete` → the enter fade ran **before images decoded**. Cached pages painted instantly at that moment (looked fine); uncached pages didn't (pop-in). The fix is to gate the reveal on `window.load` (images decoded), capped by `setTimeout(go, 1200)` so a slow asset never hangs it. Loader pages were always correct because the loader already waits for `window.load`. **If a future change reintroduces a `DOMContentLoaded`-timed reveal on no-loader pages, the pop-in returns.**

### Overlay cover replaces content-fade as the reveal mechanism (when present)

`initPageTransition()` now drives an optional `[data-page-cover]` div (Webflow: fixed, inset 0, pointer-events none, z **above** nav, bg colour, default `opacity:0`). oa-styles.css makes it opaque from first paint on published JS pages (`html.w-mod-js:not(.wf-design-mode) [data-page-cover]{opacity:1;visibility:visible}`); JS lifts it once painted. The cover lifting *is* the reveal ("fade in from colour"); leave fades it back in then navigates. The old `[data-page-transition]` content guard stays as the **fallback** when no cover div exists (gated content fade) — so JS can ship before the Webflow div is added without breaking anything.

### Cover fail-blank risk is bigger than the content guard's

Same risk *class* as the nav/content guards (opaque-by-CSS, lifted-by-JS → blank if `oa-global.js` fails), but a full-screen cover fails *bigger* than content-only. A pure-CSS deadman fade-out was considered and rejected (a CSS animation fights GSAP's inline opacity control). Accepted as-is given jsDelivr reliability. On loader pages the cover is snapped hidden at init so it never sits on top of the branded loader. bfcache `pageshow.persisted` must reset the cover to `autoAlpha:0` (the leave-fade left it opaque) alongside the existing content + Lenis restart, or the back button lands on a covered/blank page.
