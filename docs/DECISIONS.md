# Decisions & Findings

Append-only. One entry per session that touched production code or surfaced a non-obvious behaviour, corrected assumption, or deliberate decision worth preserving. Not every session — only when a gotcha would bite again. Durable rules distilled from older per-feature notes now live in [REFERENCE.md](REFERENCE.md).

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

## 2026-06-03 — Page transition: load-gate fixes the pop-in (v1.0.93)

### The pop-in bug was a reveal-timing bug, not an easing one

The content fade-through felt smooth on cached pages but "lost the timing" on uncached ones — images popped in *behind* the fade. Root cause: on internal (no-loader) pages, `initLogoRevealLoader()` calls `revealAfterLoader()` synchronously during `DOMContentLoaded`, firing `oa:loader-complete` → the enter fade ran **before images decoded**. Cached pages painted instantly at that moment (looked fine); uncached pages didn't (pop-in). The fix: gate the reveal on `window.load` (images decoded), capped by `setTimeout(go, 1200)` so a slow asset never hangs it. Loader pages were always correct because the loader already waits for `window.load`. **If a future change reintroduces a `DOMContentLoaded`-timed reveal on no-loader pages, the pop-in returns.** This (plus the existing leave fade / bfcache reset) is the whole feature — verified good on staging and kept.

### Overlay cover was prototyped, then removed — don't resurrect it

A full-screen `[data-page-cover]` wipe was built on top of the load-gate to also mask the inter-page gap, but it was removed once the gate alone delivered the wanted feel. It added a *bigger* fail-blank surface (a full-screen opaque-by-CSS div → total blank if `oa-global.js` fails, vs content-only before) for a marginal gain. `initPageTransition()` no longer references `data-page-cover`, and there is no cover CSS guard. If you reach for a cover again, weigh that fail-blank cost first — the gate is what actually fixed the complaint.

---

## 2026-06-08 — Glass CTA button (Osmo 097→046 + Glass Effect), v1.0.101–105

Hero CTA in `.hero_feed_cta-wrap`: a frosted-glass pill that began as Osmo "Button 097" (CSS clip-path dot→fill hover) and was re-fused with Osmo "Button 046" (GSAP magnetic radial wipe). All styling is in the `GLASS-046 CTA` block of `oa-styles.css`; the wipe JS (`initButton046`) is in `oa-global.js`.

### Osmo "Copy to Webflow" splits a component's CSS — the pasted snippet alone won't style it

The CSS Osmo gives you to paste into custom code is **only the half Webflow can't represent** (custom properties, `::after`, `clip-path`, `mix-blend-mode`, `@media (hover)`). The structural/background half (display, backgrounds, padding, layout) rides on the **classes** that "Copy to Webflow" recreates. Symptom when this bites: paste the snippet, the button renders **completely unstyled** — looks like a class mismatch but isn't. Fix: use Copy-to-Webflow for the structure (carries the styled classes), or paste the component's *full* CSS. We put the entire CSS in `oa-styles.css` so the button is self-contained and version-controlled.

### backdrop-filter flattens if ANY ancestor has transform / filter / opacity<1 / will-change

`.glass-effect` (`backdrop-filter: blur`) samples its backdrop from the nearest ancestor that forms a new backdrop root. A `transform`, `filter`, `opacity:<1`, `will-change`, or `contain:paint` on **any** ancestor between the glass and the slider makes it blur *that ancestor* (transparent) instead of the photos — the frost goes flat. Two design consequences:

- `.hero_feed_cta-wrap` / `hero_feed_grid` must stay transparent with no transform/filter (verified in Webflow).
- The press-shrink scales the **glass + label** (`.button-046:active .glass-effect, .button-046__inner`), **never `.button-046` itself** — a transform on the glass's ancestor would flatten the blur on every click.

### Press-shrink must not scale the orange wipe — it exposes the glass on springback

First attempt scaled `__bg-circle` (the orange clip layer) on `:active`; on springback the orange pulled in from the edges and flashed the glass (z0) underneath. Fix: leave the orange full-size (it always covers the glass on hover) and put the press on the glass + label only. Uniform `0.98`, not the stock `0.955/0.925` squash.

### 046 wipe is GSAP-driven, fine-pointer only, and keyed off a data attribute

`initButton046()` (`oa-global.js`) registers `CustomEase "button-046-ease"` and tracks the cursor via `gsap.quickSetter` on `[data-button-046-circle]`, gated behind `gsap.matchMedia('(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)')`. Touch / reduced-motion get the static glass button (no wipe) plus the CSS press feedback — deliberate progressive enhancement. **If the wipe silently doesn't fire, the `data-button-046-circle` attribute was dropped in the Webflow paste** — that's the element GSAP scales.

### No-hover-grow is a single variable

`--button-046-hover-scale: 1 1` neutralises both the `__bg-circle` hover scale **and** the focus-ring `::after` scale (both read that var) — no rule edits needed. The button text also needs a Lumos type utility (`u-text-style-main`) once rebuilt natively: the Osmo text inherited its typography, but a raw Webflow text element has no `line-height` and mis-centres in the flex `__inner`. It's typographic only (no `color`), so it doesn't pre-empt the deferred per-slide light/dark label switching.
