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

### Transition: lightweight fade-through, branded loader first-visit/home only

We deliberately rejected the "heavy logo on every click" pattern (a full-screen branded loader cover with a hard ~1.2s delay gating every internal navigation). Our fade-through is lighter; the branded loader is reserved for first-visit/home only.

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

---

## 2026-06-09 — Hero slider nav centring + slider-image load decision (Webflow Designer, no repo tag)

### Viewport-centring with the columns fixed is a geometry problem, not a CSS trick

`.crisp-header__slider-nav` sat off-centre because it was an in-flow flex middle-child of a `space-between` row between two **unequal** columns (`hero_main_bottom` ~422px, `hero_feed_grid` ~480px) — so it centred on the *gap*, not the viewport (−44px@1200, −70px@992). The binding constraint: `hero_feed_grid` is bottom-aligned and its left edge reaches the viewport centreline at ≤~1290px (at 992 grid-left=493 vs centre=496). So **any** viewport-centred element overlaps the grid's map card below ~1290 — regardless of the nav's width or how its thumbnails wrap. Centred + columns-unmoved + no-overlap is geometrically impossible in 992–1290px; you must drop one.

### Fix: overlay-centre out of flow, show ≥1280 — do NOT revive the vertical-stack rebuild

`.crisp-header__slider-nav` → position **Absolute** in `.hero_main_layout` (relative, full-bleed): **Left 50%**, **Right/Top Auto**, **Transform Move X −50%**, Bottom 0, **z-index 2** (above the map card's `backdrop-filter`), wrapper padding **0**. Shown **≥1280 only** — base `display:none`, then the **1280 "Large" breakpoint added** → `display:flex`. Pulling the nav out of flow leaves `space-between` pinning the two columns to the same edges, so **nothing else moves**. The old REMAINING.md plan (rebuild `.hero_main_layout` vertical + new `hero_main_row` wrapper, nav as static last child) was **rejected — it lifts the headline+grid ~80px**. Gate is 1280 (not 992) because that's where a centred nav clears the grid; below it the nav is hidden, not overlapping. **Geometry, not z-index — raising z-index only draws the nav over the map.**

### Webflow: set ONE horizontal inset on an absolute element, or it stretches

Hit live — the wrapper wouldn't hug its buttons despite `Width: Auto`. Cause: **both** Left (50%) and Right (0%) insets were set, so the element anchors to both edges and stretches between them, ignoring `Width:Auto`. Set **only Left** (Right Auto) + `translateX(-50%)` to keep a content-width box centred. `left:0; right:0` only centres a *stretched* box's content via internal `justify-content` — here that'd be a full-width transparent strip at z-index 2 eating hero clicks.

### The hero "slider" is `data-slideshow` in oa-global.js, has no autoplay, and slide 0 is the bunny video

`.hero_slider_wrap` (`data-slideshow="wrap"`) → four `[data-slideshow="slide"]`; logic is `initSlideShow()` in `oa-global.js`, which **only navigates on thumb click** (no autoplay/interval). **Slide 0 = the bunny background video** (the visible hero on every viewport); slides 1–3 = large product jpgs (`viewfinder-xen`, `interior-credenza`, `viewfinder-side-oval`), reachable **only via the nav**. So below 1280 (nav hidden, no autoplay) slides 1–3 are unreachable. The nav-thumb hover in `oa-styles.css` only ever scales imgs **≤1** (0.825 down / 1 up), never above — so the wrapper needs no padding to avoid clipping (osmo's 0.6rem was redundant).

### Decided NOT to gate slider-image loading — AVIF instead

Slides 1–3 download even when unreachable, but they already carry Webflow `srcset` (500–3200w, `sizes:100vw`) so phones right-size them; the real residual waste is high-DPR tablets/laptops in 992–1279 pulling large variants. A `data-src` gate would **discard that srcset on three hero images** for a small, device-narrow win. Chosen instead: swap the 3 jpgs → **AVIF** (~½ size everywhere, incl. ≥1280 where they're actually shown, keeps srcset) + set **slide 2 `loading` eager→lazy** (it isn't the LCP — slide 0/video is — so it shouldn't sit in the critical initial load). Tracked in `REMAINING.md`.

---

## 2026-06-16 — Hero slider breakpoint image swap, v1.0.108

### Duplicating a Webflow element copies its custom attributes — `data-slideshow="parallax"` silently breaks the slide index

`initSlideShow()` builds `ui.inner` as a flat `querySelectorAll('[data-slideshow="parallax"]')` and indexes it 1:1 with slides. When a second image (`.is-tablet`) was added to each slide by duplicating the desktop image in Webflow Designer, the `data-slideshow="parallax"` custom attribute was copied onto the duplicate too. `ui.inner` then contained 7 elements instead of 4, and `ui.inner[current]` resolved to the wrong element from the first image-to-image transition onward. No console errors — the animation just targeted the wrong parallax element silently.

**Rule:** any element added inside a `[data-slideshow="slide"]` that should NOT participate in the parallax animation must NOT carry `data-slideshow="parallax"`. Always check custom attributes when duplicating elements in Webflow Designer. The correct structure is one `[data-slideshow="parallax"]` wrapper per slide; content images live inside it.

### `display:none` collapses layout and breaks GSAP `xPercent` — use `opacity:0` instead

GSAP computes `xPercent` as a percentage of the element's **own rendered width**. `display:none` removes the element from layout entirely (width = 0), so `xPercent: 100` produces 0px movement — the animation silently does nothing. For any element that GSAP must be able to animate, hide it with `opacity:0` (preserves layout dimensions) rather than `display:none`. This applies to the desktop `.crisp-header__slider-slide-inner` on tablet — it stays in layout so GSAP can drive it; only `opacity:0` hides it visually.

### iPad Pro portrait (1024 × 1366) sits above Webflow's 991px tablet breakpoint

Webflow's built-in "Tablet" breakpoint fires at ≤991px. iPad Pro portrait is 1024px wide (CSS pixels) — above that threshold — so it inherits desktop styles. For the hero image swap we set our media query at `max-width: 1024px` to capture it. iPad landscape (≥1180px) stays on desktop images intentionally. Any future breakpoint-sensitive CSS that should cover iPad Pro portrait must use `1024px`, not `991px`.

---

## 2026-06-17 — Safari /all-products scroll jank: card :hover recalc, v1.0.109

### Desktop Safari scroll jank on /all-products was `:hover` recalc, not the orphaned IX2 handler

The IX2 `scroll.webflow` strip (`oa-global.js` §10, v1.0.107) fixed Chrome but not desktop Safari. Diagnosis (Safari Web Inspector → Timelines → Frames): long frames were dominated by **purple "Styles Recalculated"**, `jQuery._data(window,'events')` showed **no `scroll` handler at all** (strip confirmed working / nothing to strip), and the jank vanished when the cursor was parked **off** the grid. Root cause: scrolling with the cursor over the grid sweeps `:hover` across card after card. The grid image hover is only a tiny `transform: scale(calc(1 + 0.025 * var(--_trigger---off)))` with a **300ms transform transition** (no box-shadow, no layout — confirmed in Webflow). The cost is NOT paint: each `:hover` toggle forces a style recalc, and the 300ms transition means several cards are mid-transition at once as the cursor crosses them, each forcing a recalc **every frame** → Safari floods the main thread (Chrome absorbs it). The amount of recalc scales with the number of toggles/transitions, not the size of the effect — a trivial scale is enough.

> Correction note: an earlier draft of this entry (and the v1.0.109 commit) wrongly attributed the cost to an animated `box-shadow`. There is no box-shadow on the grid hover — that detail was mis-read from the *homepage slider* card's mobile rule comment (`oa-styles.css:276-291`, a different component). The actual driver is recalc churn from the hover toggle + overlapping 300ms scale transitions.

### Fix: scroll-gated hover suppression (`oa-all-products.js` + `oa-all-products.css`)

`initScrollHoverSuppression()` toggles `html.oa-scrolling` on a **passive, class-only** scroll listener (no layout reads — does NOT reintroduce the reflow the IX2 strip removed), removed 100ms after scroll stops. **Gated to `(hover: hover) and (pointer: fine)` — desktop pointers only**: touch has no `:hover` to suppress, and running there would let `pointer-events:none` swallow a tap landing in the 100ms post-scroll window. CSS during scroll: `pointer-events: none` on `.all_tables_item`. Set on the item, it covers the hovered image (a descendant), so no card hover fires as the cursor sweeps the grid → no recalc churn. That single rule is the whole fix; an earlier draft also carried a `.card_product_group { transform/box-shadow/transition: none }` rule, but it was dead code (wrong element, non-existent box-shadow) and was removed.

**Known residual (expected, not a bug):** hover can still leak visually during slow/stepped scroll or a mid-scroll mouse nudge — sub-100ms gaps where no `scroll` event fires drop the class. A leaked hover is one card's tiny compositor scale, so it's cheap; perf holds.

---

## 2026-06-17 — Configurator cascading slider: perimeter hairline + radius, v1.0.111 (pending)

### The faint edge line on mobile was the far-slide (`farSlideWidth`) leak, not a centering bug

Reported as a "faint painted line on the left of the thin swatch" on mobile (Pixel 7 / ~425px), "edges of the outer slideshow" on larger mobiles, and a slider that wasn't "precisely centered." Diagnosed live on `/product/viewfinder-cr` (chrome-devtools, device-metrics 425×900): the active slide's visible-band centre = **212.50 = viewport centre 212.50** — centering math is exact, no translate bug. The artefact was the **±2 far slides**: `farSlideWidth` (`oa-configurator.js`, `measure()`) is `(vw − active − 2·sibling − 4·gap)/2`, which at narrow widths evaluates to a small **non-zero** value (~0.77px @425, growing as the viewport narrows). Each ±2 slide then parks a sub-pixel sliver **exactly on the viewport edge** (x≈26.2 left, x≈398.8 right at 425), just outside the ±1 "thin swatch" (x≈35) — that is the hairline. At the ~500px two-column tablet width `farSlideWidth` resolved to 0, which is why it only showed on real mobile. The "off-centre" complaint was perceptual: asymmetric edge hairlines, not translation.

### Fix: `farSlideWidth = 0` — far slides are invisible staging slots, not visible peeks

Set `farSlideWidth = 0`. Offsets ±2/±3 collapse to zero visible width (`slotWidth 0` → `clip = slideWidth/2` → band 0) while their slot **centres stay parked at the viewport edge**, so they remain valid off-edge staging positions for the enter/exit animation — slides emerge from the edge as before, but never paint a sliver. Visible model is now exactly **centre + incoming + outgoing (offsets −1/0/+1)** on every breakpoint. Verified by collapsing the live leakers to band 0 and re-screenshotting: orange Cuprum hairline gone, two clean ±1 slivers remain, centre unchanged. The `breakpoints[].siblingWidth`/`activeWidth` and `--gap` still fully drive the visible 3-slot geometry; only the far-width term changed. Surgical one-liner chosen over a 3-slot rewrite — lower regression risk on the animation, and the ±2/±3 machinery is still needed as staging.

### Slide corner radius: `--radius` is `em` on a fluid font — switched to `rem`

The slide corner radius is **not** a Webflow border-radius; it's the `round` argument of the Webflow clip-path `.config_slider_layout { clip-path: inset(0px calc(var(--clip)*1px) round var(--radius)) }`, and `--radius` is set in **this repo** at `oa-styles.css` (`[data-cascading-slide]`). It was `0.3em` — but the slide's font-size is a **fluid 16.19px**, so the radius drifted with the type scale (computed ~4.86px). The remembered "0.75em" was stale; live was already 0.3em. Changed to **`0.3rem`** (locked to the 16px root = 4.8px) for consistency with the site's cards. `config_variant_slider` itself is a pure Webflow class (container, `overflow:hidden`, `height:13rem`); the size slider is its `.slider-size` modifier + `.config_size_wrap` (inactive slides `opacity:0`), so the `farSlideWidth` change is a no-op there.

> No build step: `oa-configurator.js` and `oa-styles.css` are served raw from the CDN (only `oa-homepage.js` is bundled). Ship = tag + bump both URLs in Webflow.

---

## 2026-06-19 — Hero sits behind Arc iOS's floating pill: svh → JS-measured height, v1.0.112 (pending)

### Why no CSS viewport unit can fix Arc (reverses the deliberate `svh` choice)

The hero (`.crisp-header`) was `height: 100svh`, chosen deliberately because svh is static (no scroll-driven layout shift). That works on Safari/Chrome iOS but **fails on Arc iOS**: the hero renders too tall and sits behind Arc's floating bottom pill. Root cause — Arc's pill is **custom browser UI that iOS WebKit does not report as chrome**, so *every* CSS viewport unit (`svh`/`dvh`/`lvh`) thinks it has the full height and the pill overlaps the bottom. No CSS-only fix exists. Confirmed with an on-device probe (overlay logging `innerHeight`/`visualViewport.height`/`100svh`):

| | Arc iOS | Firefox Android |
|---|---|---|
| `innerHeight` | **717** | 651 |
| `100svh` | **793** | 651 |
| `resizes` after scroll | 0 | 0 |

On Arc, `window.innerHeight` (717) is **76px smaller** than `100svh` (793) — that 76px is the pill, and innerHeight is the only metric that sees it. `resizes 0` confirms Arc's pill is stable (never fires resize on scroll), so a single measurement on load suffices.

### Fix: `--hero-h` from `window.innerHeight`, svh as fallback

`oa-styles.css`: `.crisp-header { height: var(--hero-h, 100svh) }`. `oa-homepage.js` `setHeroHeight()` sets `--hero-h` to `window.innerHeight` on load + on orientation/width change only — **never on height-only resize** (toolbar show/hide), so it does not re-introduce scroll-driven shift. svh stays as the pre-JS / no-JS fallback. Matches the Aker benchmark: cold cache may briefly paint long, then a reflow corrects it; reload paints correct (the pill is already settled). This was deemed acceptable up front — beating the cold-paint frame would need a render-blocking `<head>` script.

### Firefox jitter: width-gated the resize handler, but it is a defensive cleanup, not a confirmed cure

The `window.resize` → `swiper.update()` handler (the v1.0.106 shudder fix) now **width-gates**: `if (innerWidth === lastVW) return`. Mobile fires `resize` on every toolbar show/hide while scrolling; gating drops that wasted synchronous `update()` churn. **Width** resizes (desktop drag) still fire `update()`, so the v1.0.106 shudder fix is preserved. Caveat: the diagnostic did **not** reproduce a resize storm on Firefox (`resizes 0`, `innerHeight == svh == 651`), so the hero-height change is a no-op there and the gate is not a proven Firefox fix — the residual Firefox jitter is the sticky-hero reflowing as the toolbar collapses (Aker has it too) and was explicitly accepted at Aker-parity rather than reworking the sticky-hero mechanism.

> Build step applies: `oa-homepage.js` is bundled → `npm run build` before tag. Two URLs bump this ship — `dist/oa-homepage.js` and `src/css/oa-styles.css`.

---

## 2026-06-21 — Statement scroll-blur: `.oa_statement_blur` mask is load-bearing, v1.0.114 (removed) → v1.0.115 (restored)

### Corrected assumption: the mask is NOT redundant

The `.oa_statement_blur` mask (`linear-gradient(to bottom, transparent 0%, black 15%)` in `oa-styles.css`) was removed in v1.0.114 on the theory it was redundant — reasoning that since the panel background colour equals the section bg at `opacity: 0.8`, the blurred edge cancels (`0.8·bg + 0.2·bg = bg`). The line came straight back: a visible edge sweeping down over the statement on scroll. Restored in v1.0.115.

**The flaw:** the cancellation logic only holds for the panel edge over the **bare background**. It ignores the wipe edge over the **text**, which is exactly what the mask feathers. The 40px blur alone leaves a defined moving boundary where the dark text fades; the mask widens that feather so it doesn't read as a line. It's **theme-sensitive** — a light theme (dark text on light bg) exposes the moving edge that FlowGuide's white-on-black hides, which is why FlowGuide runs the identical recipe (`filter: blur(40px)`, opacity 0.8, panel == section bg) mask-free and we can't.

**Process miss:** the "no line" call came from two *static* screenshots; the artefact only shows in *motion*. Verify the actual failure mode (scroll through), not a convenient static proxy. The retiming that shipped alongside (IX2 End offset 50→12) sped the sweep up, making the bare edge more conspicuous still.

Full recipe, colour-lock rule, and component/light-dark-variant flags now live in [REFERENCE.md](REFERENCE.md) → *Statement scroll-blur*. CSS-only change, no build step.

---

## 2026-06-22 — Osmo Infinite Draggable Grid on the product page (embedded variant), v1.0.117

### Osmo components reuse Webflow-native GSAP — never add their CDN gsap

Osmo's resource ships with `<script src="…gsap@3.15…">` + `Observer.min.js`. **Do not add them.** Every page already has GSAP via Webflow's native integration. Verified live on `/product/interior-credenza`: `window.gsap` = **3.15.0** (the exact version Osmo targets) and `window.Observer` is a registered function with `.create()` — Webflow bundles Observer in via ScrollTrigger (it sits in `gsap.core.globals()`). Adding the CDN gsap creates a second `window.gsap` that can clobber the top-level `CustomEase` registration in `oa-global.js` (loader, nav, slideshow, configurator). The fix is subtractive: delete both CDN tags; the script uses the page's globals unmodified (its `gsap.registerPlugin(Observer)` is then a harmless no-op). Bonus: reading `window.gsap` keeps the grid on whatever GSAP version the rest of the site rides (Webflow auto-bumps on publish) instead of pinning a diverging 3.15.

**General rule:** any Osmo/third-party GSAP component must reuse `window.gsap` / `window.Observer` — never load a CDN GSAP. Now in CLAUDE.md under the GSAP section.

### Reworked from full-viewport takeover to embedded block

Osmo sizes itself `100svh` and captures `wheel,touch,pointer` with `preventDefault: true` — a scroll-jacking takeover. As a child of `.press_process-layout` (mid-page) that traps page scroll on every device. Changes in `oa-infinite-grid.js`:

- Observer `type` `wheel,touch,pointer` → `touch,pointer`: wheel/trackpad now scrolls the **page**, not the grid.
- `handleMovement` wheel branch removed. The parallax the look depends on (column-speed pattern + `xToYInfluence` + scale-on-drag) is **preserved** — it's a function of `pos.x/pos.y`, which drag already writes; only the wheel *route* into it was removed.
- New idle auto-drift (20px/s, mostly horizontal + faint vertical) written straight to `pos.target` so it stays full-size; pauses on hover, on drag, and off-screen (an IntersectionObserver flips `inViewport`, and `updateGrid` early-returns when false — frames saved mid-page).
- Touch axis-lock via CSS `touch-action: pan-y`, not a JS heuristic: vertical swipe scrolls the page, horizontal pans the grid. Accepted trade-off: vertical grid panning is sacrificed to page scroll on touch.

### CSS split: behaviour in the repo, sizing in the Designer

Per CSS-ARCHITECTURE.md the repo layer loads after Webflow and wins at equal specificity, so `oa-infinite-grid.css` deliberately **omits** the Designer knobs — section height (70svh), item width / padding / aspect-ratio, card `border-radius` — leaving them to the Webflow classes (owned and tweaked in rem, e.g. a global card-radius var). The repo file carries only what the panel can't express (`touch-action`, the `[data-infinite-grid-status]` opacity/cursor states, the `wf-design-mode` preview) plus the absolute positioning the JS depends on. The em→rem conversion therefore happens on the Designer classes, not in code — no JS impact (the script measures whatever size results).

### Visibility is build-time CMS conditional

The whole section ships or not per product via a CMS on/off boolean (same pattern as the configurator). Absent ⇒ `querySelectorAll('[data-infinite-grid-init]')` no-ops; present ⇒ builds. Zero JS. Cards are CMS-bound — Webflow SSRs collection items, so they're in the DOM when the script clones `originalItems` at `DOMContentLoaded`; zero/few items don't error.

> Both files raw-served (no Rollup). Page-level embed on the product template after tag.

---

## 2026-06-23 — Infinite grid tuning: image ratio, touch drag, drift, v1.0.118

### Symmetric padding can't preserve an image ratio — use `aspect-ratio` on the card

4:5 source images rendered distorted (and "way off" on mobile) because the card filled `(square item − symmetric padding)`, and equal padding on a square yields a square content box — `object-fit: cover` then crops 4:5 → square. **No padding value fixes this:** symmetric padding can't define a ratio, and on a non-square cell it distorts the inner ratio — worst on mobile, where the padding clamp's floor is a larger fraction of the smaller cell. Fix: set `aspect-ratio: 4/5` on `.infinite-grid__card` in the Designer (item stays `4/5` so portrait cards tile without vertical overlap; padding is now purely the gutter, ratio-irrelevant). The repo CSS had `height: 100%` on the card which — loading after Webflow — overrode the Designer's aspect-ratio; **removed it** so the Designer owns card height/ratio. General rule: don't hardcode a dimension in the repo layer that you want the Designer to control.

### Touch: vertical reserved for page scroll, horizontal pans; faster touch drag

`handleMovement` now zeroes `moveY` on touch (vertical = page scroll via `touch-action: pan-y`; horizontal still pans, plus the `xToYInfluence` bleed for a little vertical life). Earlier the JS read vertical touch deltas too, so a vertical swipe moved the grid *and* scrolled the page — now it only scrolls. Touch drag sped up (`touchDragSpeed 2.0`, clamp 120); mouse drag unchanged. Hover-pause on drift removed — drift now pauses only on active drag + off-screen.

---

## 2026-06-27 — Repo-driven Lumos slider init on Swiper 12 + Material-You parallax

### The paid "Material You" plugin is not needed — it's native Swiper parallax

The UI Initiative "Material You" slider is a **paid** plugin (self-hosted, not on npm/CDN) — a non-starter for a public repo. Inspecting the live demo's DOM at `slidesPerView:1` showed the effect is just **translate + scale parallax inside a rounded `overflow:hidden` frame**: the image sits at `scale(1.125)` and counter-translates as the slide moves. That is exactly Swiper's **built-in free `parallax` module**. Reproduced with `parallax:true` + `data-swiper-parallax` / `data-swiper-parallax-scale` on the product image — no plugin, no custom effect engine. The card is the clip frame (`overflow:hidden`, Designer radius); the image overfills via `scale(>1)` so the translate never reveals an edge. Tuning dials: parallax distance (−15%…−25%) and scale (1.08…1.15).

### Stayed on Swiper 12.2.0, not v14

**Swiper v14.0.0 released 2026-06-26** (one day before this work) — a TypeScript rewrite that raises the browser baseline (Chrome/Safari 16.4+). Deliberately pinned **12.2.0** (latest v12) for wider support and to avoid a day-old major on a live site. v8 → v12 is still a big jump (loop rewritten in v9, `loopedSlides` removed in v11/v12) — but `new Swiper()` + the data-driven config survive.

### Lumos slider init moved from Webflow embeds into the repo (`oa-slider.js`)

Both Lumos sliders (product `.static_slider_contain`, homepage `.slider_wrap` / "Menu Categories") shared the same `[data-slider='component']` contract, with the Swiper load + init **baked into Webflow embeds** + two `oa-global.js` `window.load` patches. Consolidated into one sitewide-footer, guarded **`src/js/oa-slider.js`**: dynamically injects the Swiper 12.2.0 bundle only when a slider exists, runs the faithful Lumos DOM surgery (`flattenDisplayContents`, `removeCMSList`, add `.swiper-slide`), and reads per-slider config from data-attributes. New attrs over the original init: `data-loop`, `data-parallax`, `data-slides-per-view`, `data-speed-touch` (folds in the product 800/700 patch), `data-raise-on-transition` (folds in the homepage `is-slider-transitioning` patch). Both embeds deleted in the Designer; both `oa-global.js` patches removed. Safe because there is **no Lumos runtime** — the init was frozen inline code, now just version-controlled. Product slider opts into `spv:1` + loop + parallax; homepage runs defaults (`spv:auto`, no loop/parallax), behaviour unchanged. FOUC guard added (Swiper is now async-loaded) with a `.wf-design-mode` override so slides stay visible in the Designer canvas where the init JS doesn't run.

### Creative-effect "morph" tried, then reverted to single-card + native parallax (v1.0.122 → v1.0.123)

Briefly chased the demo's attached-neighbour morph with Swiper's free **Creative effect** (`effect:'creative'`, `creativeEffect` translate ±100% + scale, plus mobile touch params `slidesPerGroup`/`shortSwipes`/`longSwipesRatio`/`touchReleaseOnEdges`). Reverted: the look added bloat without feeling premium, and the design call landed on **one rounded card, no peek** — the original Lumos feel. Final product config is just the original data-attr-driven init + `loop` + native `parallax`. If anyone reaches for an "effect" here again: the `effect:'creative'` path was removed on purpose — tune the **native parallax** dials (distance/scale on `.static_design_images`) instead.

### CRITICAL — `loopAdditionalSlides` + `loop:true` with few slides corrupts the loop (v1.0.124)

`loopAdditionalSlides: 10` came verbatim from the original Lumos init, where it was **inert because that init had no `loop`**. Enabling `loop:true` activated it — and with only **7 product slides**, asking Swiper to render 10 extra looped slides per side corrupts the loop bookkeeping. The symptom was bizarre and total: **`slidePrev()` moved *forward*** (verified at the transform level — `translate` went more-negative on prev), so **both arrows advanced the same way and touch-swipe went erratic**. Easy to misread as button-wiring or RTL — it was neither (buttons correctly bound, `rtl:false`). **Fix: delete `loopAdditionalSlides`** and let Swiper's default loop management handle it. Rule: never set `loopAdditionalSlides` ≥ the slide count, and treat it as loop-coupled — if you toggle `loop`, re-check it. The `loop` guard in `oa-slider.js` (requires `slides ≥ 2`) is necessary but not sufficient on its own.

> Live state after this work: **v1.0.124**, product slider = single rounded card, no peek, `loop`, native parallax, `data-speed="700"` (dropped from 800 — Swiper ignores a 2nd click landing mid-transition, so a slower speed feels less responsive on rapid clicks). Diagnosed entirely via chrome-devtools: read `realIndex`/`translate` on the live instance and re-initialised with corrected params to confirm the fix before editing source.

---

## 2026-06-28 — Osmo Multilevel Nav: evaluated, shipped as v1.0.125, then rolled back

Built and shipped a full swap of the Webflow-native nav (`.nav_component` + `.w-nav-button`, `initNavSafariFix`, mobile `mix-blend-mode`) for Osmo Supply's **Multilevel Navigation** (`.nav`, data-attr driven) — tagged **v1.0.125** and briefly published live. **Rolled back**: determined the cost/benefit didn't justify replacing the working, minimal blend-mode nav (the new component's marquee feature — image-card dropdowns — needed content/IA we didn't want). Repo reverted via `git revert` of the swap commit. **v1.0.125 is kept** (it was deployed — immutable record), not deleted.

- **Live restore was clean.** Webflow custom code restored from backup to pre-swap tags. Verified the restored URLs are functionally correct: `oa-styles.css@122` ≡ `@124` (diff is a *comment only* — the slider revert at v1.0.123 only reworded a comment, the rule is byte-identical), `oa-global.js@121` is **byte-identical** to `@124` (the slider-patch removal landed at v1.0.121). No CSS/JS mismatch, no nav swap live. Files sit on uneven tags (122/121) but content matches latest; optional tidy-up is to bump both to `@124`/next.
- **Kept the `--ease-osmo` → `--ease-oa` rename** as a standalone (it was an independent ownership decision, not part of the nav). Pure rename, slider behaves identically. Goes live whenever `oa-styles.css` is next deployed — no urgency.
- **Lesson for next time:** a content-heavy component swap is only worth it if the new content/IA is actually wanted. The minimal nav was fit-for-purpose; the swap added surface area (more CSS/JS, dropdown content to maintain) for little gain. Evaluate the *content* cost, not just the visual upgrade, before swapping.

---

## 2026-07-07 — Repo audit batch: fail-open GSAP, single Swiper source (build step removed), on-demand hls.js, v1.0.131

Full static + live audit of `src/` and the staging DOM; ~19 findings fixed in one tag. The non-obvious ones:

### Designer class renames silently break JS guards — verify hooks against the live DOM

The statement block was renamed `.oa_statement_layout` → `.oa_statement-home` in the Designer, which flipped `stripOrphanScrollHandler` into stripping the **homepage too**. It happened to be harmless because the current Webflow runtime **no longer binds `scroll.webflow` at all** (verified live: zero jQuery scroll handlers anywhere; no forced reflow in a scroll trace of /all-products; the statement wipe runs through another IX2 driver). The strip is now **dormant insurance** — kept with the corrected selector in case a runtime publish reverts to jQuery binding. Rule: any JS/CSS that keys off a Designer class must be re-checked after Designer refactors; the repo can't see those renames.

### GSAP is now fail-open, never fail-closed

`oa-global.js` used to call `gsap.registerPlugin(CustomEase)` bare at the top — if Webflow's auto-updating GSAP integration ever failed, the throw killed the whole file and the page stayed hidden behind the loader/FOUC guards forever. Now guarded by `oaGsapOk`: without GSAP the loader overlay is hidden immediately, `[data-page-transition]` content is unhidden manually, and the GSAP-free features (nav fix, dropdown hover, Perth time) still run. Verified both paths in a local harness.

### One Swiper source sitewide — Rollup build step deleted

The homepage hero bundled its own Swiper (npm 12.1.4 → Rollup → `dist/oa-homepage.js`) while `oa-slider.js` injected `swiper-bundle@12.2.0` on the same page: two copies, two versions, ~82KB duplicate, plus the standing stale-dist-artifact risk. `oa-slider.js` now exposes its loader as **`window.oaLoadSwiper`** (it loads in the sitewide footer, before page embeds) and `oa-homepage.js` is **raw-served** like every other file — no imports, no `modules:` arrays (the bundle registers all modules). `dist/`, `rollup.config.mjs`, npm deps and `npm run build` are gone. **The hero now runs Swiper 12.2.0 (was 12.1.4) — re-verify hero behaviour on staging after any Swiper version bump.** Webflow homepage embed URL changed path: `dist/oa-homepage.js` → `src/js/oa-homepage.js`.

### hls.js is injected on demand, not shipped sitewide

The parser-blocking 157KB `hls.js@1.6.11` footer `<script>` (which every page paid for, and which held DOMContentLoaded back ~17s on Slow 4G) is replaced by `loadHls()` in `oa-homepage.js`, injected only when a `[data-bunny-background-init]` player exists. The pinned version now lives in the `HLS_VERSION` constant. The whole "oa-global.js must load before hls.js" footer-order constraint dissolves with it. **The hls.js `<script>` tag must be deleted from Webflow site-wide footer code.**

### Loader exit now gates on real video readiness

The old exit raced `window.load` against a 1200ms cap under a 1500ms floor — the race could never exceed the floor, so the loader always exited at exactly 1.5s and the "waits for window.load" comment was false. Deliberate behaviour now: exit waits for **max(1.5s brand minimum, `oa:hero-media-ready`)** — dispatched by `oa-homepage.js` on the hero video's first `canplay` — capped at 4s so a stalled CDN can't trap the page. Aesthetic call: the reveal must never land on frame-mush; the anticipation beat outranks TTI here.

### Smaller fixes worth remembering

- **Slideshow parallax**: layers were collected into a parallel document-order array; live DOM had 4 slides / 2 layers → misaligned targets. Parallax now resolves per-slide (`slide.querySelector`). CMS-count guard added.
- **Configurator clones** (pad-to-9) now strip `input`/`[for]`/`[id]` — cloned radios would duplicate ids fixRadioIds() just repaired and double-count `data-price` in the pricing engine.
- **Configurator resize**: ResizeObserver debounced 150ms (the gap probe forces a reflow per call); `syncRadio()` removed from resize paths (radio state can't change on resize).
- **Arrow keys** respond to focus only (wrapper `tabindex="0"`, clicks focus it explicitly for Safari) — hovering no longer hijacks page scroll keys.
- **Infinite grid**: null guard ran *after* dereferencing `sourceList` (reordered); settled-state `gsap.set(scale)` per frame on every clone now snaps + skips via a write cache.
- **all-products hoist**: the attribute-reading collect variant was dead — live markup carries the value as text content (all `data-filter-name-collect` attributes are empty). Deleted.
- **button-046 / glass-effect** JS + CSS deleted (~170 lines): the Glass CTA was removed in the Designer; a new CTA button will replace it. Restore, if ever needed, is a `git revert` away.
- **`w-mod-ix3`** in `revealAfterLoader()` is load-bearing (IX2 guard, see REFERENCE.md) — now commented inline so it doesn't read as vestigial.

### Post-batch hotfix (v1.0.132): loader inside the transition wrapper + pointer-eating nav spacer

Tagging `data-page-transition` on `.page_wrap` (the only wrapper the Designer offers) put the **loader inside the pre-hidden element** — the CSS guard hid the loader for its entire run (blank page, then pop; reported as "loader not showing"). Fix: the pre-hide is now scoped `[data-page-transition]:not(:has([data-load-wrap]))` — loader pages skip the pre-hide (the loader overlay covers content anyway and owns the reveal). Structural alternative (optional, cleaner): move the Loader element out of `.page_wrap` to be a direct child of Body. Second fix: `.nav_spacer_bg` (product template) is an empty transparent sticky strip at z-index 2 that swallowed pointer events across the top ~160px (arrow cursor, unhoverable radios) — pre-existing, now `pointer-events: none` (the Designer has no pointer-events control).

### Touch-swipe fix (v1.0.133): backward swipe left the old card raised

Real-iPhone-only symptom: swiping the homepage menu slider backward left the previous card scaled up until the next touch (arrows fine both ways). Cause: `touchEnd` cleared `is-slider-transitioning` only `if (!swiper.animating)` — on a backward followFinger release the transition events can complete before the finger lifts, so the flag stuck with no `transitionEnd` left to clear it. Fix (`oa-slider.js` raise-on-transition block): when `touchEnd` sees `animating`, an unconditional fallback timeout (`speed + 100ms`) clears the flag; `transitionEnd`/new gestures cancel it. Verified in touch emulation: flag ends cleared after every gesture incl. mid-animation flicks.

### The real bug-#5 cause (v1.0.134): iOS sticky hover, not the flag

v1.0.133's flag fallback was a legitimate hardening but not the cause. The Designer's `.card_product_group:hover` (scale 1.02 + shadow, identical to the raise) is ungated in Webflow's stylesheet; on iOS a touch applies `:hover` and it sticks until the next touch. A swipe starts on the card → outgoing card stays raised; arrows touch only the button → clean. Chrome touch emulation doesn't reproduce iOS sticky hover, which is why it never showed. Fix: `oa-styles.css` neutralizes `.card_product_group:hover` inside `@media (hover: none)` (loads after Webflow's CSS; the more-specific `is-active` raise still wins).

### Menu slider: scale removed entirely (v1.0.135)

Final call on the homepage menu slider — the settled-card raise (scale 1.02 + shadow) was too much movement for a nav strip and the root of the v1.0.133/134 asymmetry chase. Removed the feature rather than tuning it: `oa-styles.css` drops the `is-active` raise + transition (kept only the `@media (hover:none)` hover-neutralize so iOS sticky-hover can't scale a touched card); `oa-slider.js` drops the now-orphaned `raiseOnTransition` block + `is-slider-transitioning` toggling (homepage was its only consumer). Speed is the Designer `data-speed` attribute (set 700 to match product); ease was always Swiper's built-in, shared with product. `data-raise-on-transition` on the component is now inert.

---

## 2026-07-26 — Nav mega-dropdown anchors, logo componentised, v1.0.139 + v1.0.140

### Three systems all branch on "does the href start with #"

The nav's section links are absolute (`/all-products#tables`) so they work from any page — the only correct authoring for a sitewide nav. But an absolute path fails three separate checks, and all three symptoms were reported as one bug:

1. **Webflow's navbar** closes the mobile overlay only when `href.indexOf('#') === 0` (`g.menu.on('click','a',L(g))`). Absolute hrefs leave the overlay stranded over the page while it scrolls underneath.
2. **Lenis's `anchors` handler** never intercepts them — verified live: zero calls reach `lenis.scrollTo` on a real link click. These links had no smooth scroll at all.
3. **Webflow's own delegated anchor-scroll** animates to the target's raw offset and ignores `scroll-margin-top`, landing the heading under the fixed nav. This is why the existing `scroll-margin-top: 130px` appeared to do nothing — Webflow, not the browser and not Lenis, was doing the scrolling.

Reproduces 100% on `/all-products` and never from another page (elsewhere it's a real document navigation), which is why it read as intermittent. Not fixable by changing the hrefs — `initNavAnchorLinks` owns the whole interaction instead.

### Ordering traps in that handler (both found by measurement, not reasoning)

- **Do not gate on `e.defaultPrevented`.** A smooth-scroll library may already have claimed the click; the first fix silently no-op'd because of this.
- **`preventDefault` does not stop Webflow's anchor scroll** — it's a bubble-phase document delegate. The handler runs in the **capture** phase and calls `stopPropagation`.
- **Webflow's menu toggle is debounced**, so the menu is still open on the next frame. `body.menu-open` sets `overflow:hidden` and `initNavSafariFix` stops Lenis, so a scroll issued then is dropped — Lenis's `force` option does *not* help, because the document itself cannot scroll. Wait for the `w--open` flip via MutationObserver rather than guessing a delay.
- Offset is read live from the target's own `scroll-margin-top`, so clearance stays one Designer-editable number and tracks the breakpoint.

### `stripOrphanScrollHandler` is load-bearing, not dormant (supersedes the 2026-07-06 note)

That note claimed the runtime no longer binds `scroll.webflow`. Wrong. Verified: the homepage (statement block present → strip returns early) keeps a `scroll.webflow` handler; `/all-products` has no scroll binding but still has `resize`/`orientationchange`/`load` from the same Webflow call — the fingerprint of this `.off()`. The orphan is still real: `/all-products` IX2 data carries 2 `SCROLLING_IN_VIEW` events with no statement block to drive (Webflow ticket still open, nudged 2026-07-26). Measured cost of removing the strip: p95 frame 17.4ms → 33.3ms (one dropped frame in ~20), mean +1.2ms, p50 unchanged — the old "~376ms per scroll" figure no longer reproduces. Mechanism holds, severity does not.

Side effect, accepted deliberately: this also disables Webflow's scroll-spy `w--current` on in-page anchor links. An `initNavActiveSection` was built and then **removed** — the mega menu is a dropdown, so the highlight is only visible on reopen, and nothing styles that state.

### Lumos nav: two Menu variants, not two components

`Nav` places the **same** `Menu` component twice, differing only by a `Variant` prop (`base` = Mobile, `23049969-…` = Desktop). Confirmed identical in the stock Lumos V2.2.1 template — this is Lumos's design, not local damage. Edits land in whichever variant is selected, which is why component edits appeared not to propagate. **Make structural/content edits on Base.**

### Logo is a component again; colour comes from context

Stock Lumos `Nav` holds two `Logo` component instances; this project had replaced them with two raw HTML embeds — one edit became two. Now `Logo Nav OA` (`1162c1d1-…`), placed in both nav slots and both loader layers. Inserted via `data_whtml_builder`, which converts inline SVG to **native Webflow DOM elements** (stylable) rather than a locked embed.

Rule that fell out of the loader work: **the component supplies geometry, the context supplies colour.** `.oa_logo_nav` had pinned its own `color`, so `fill="currentColor"` never inherited — and it was pinned to `variable-b6de3dc8`, the same variable `.loader__bg` uses, so the mark drew in the loader's own background colour. Colour now lives on `.nav_desktop_logo` / `.nav_mobile_logo`; the loader's `is--base` (0.2 opacity) / `is--top` (clip-wiped) layers supply theirs.

### Webflow `instanceCount` is not a usage count

It counts *rendered* instances, so it inherits the parent's placement count: `Logo Nav OA` reads 14 (7 Nav placements × 2 slots), while a component nested inside a definition that has no page placements reads 0 while still being in use. Six zero-instance logo components deleted cleanly; `Logo Monograph` reported 0 and was refused with *"Cannot unregister a component that is in use."* **Never treat a 0 as proof something is unused** — the API's own guard is the reliable check.

### Open

- `Logo Monograph` — in use somewhere not yet located (not in `Logo`, `OA Logo - Tag`, or either Footer). Left registered.
- Loader logo swap + colour-inheritance fix are **Designer-side, unpublished** as of this entry.
- Logo sizing in the loader (fills 80% of a 12em wrap) and the duplicated class token (`class="logo_svg logo_svg u-path"`, a WHTML-import artifact) are cosmetic tidy-ups, not verified visually.

---

## 2026-08-02 — Awards directional list, skip-link focus, About semantics, v1.0.141–143

### One directional-hover initialiser, two consumers

The Osmo directional list (`/about` awards) uses the same algorithm the nav dropdown tile had carried since `eb7d119`. Rather than ship a second copy, `initNavDropdownHover` became `initDirectionalHover`: the nav binds by class (`.nav_dropdown_link` / `.nav_dropdown_hover_tile`, all four directions), the list by attribute (`[data-directional-hover]` with `data-type` choosing the axis). CSS is one shared rule carrying only what the Designer can't express — resting transform, transition, `will-change`, `pointer-events`. Osmo's `data-status` writes were dropped: nothing in the project's CSS or IX2 consumes them (verified against every loaded stylesheet).

`data-type="y"` is deliberate over nearest-edge: a stacked list reads as one continuous vertical motion, where nearest-edge flips the fill sideways on a slow horizontal entry.

### Touch: branch on `pointerType`, never on a breakpoint — then remove it entirely

v1.0.141 handled touch as a press state (`pointerdown` fill, `pointerup`/`pointercancel` clear) rather than gating the feature off below a breakpoint. A breakpoint gets both edge cases wrong: an iPad Pro at 1024px reads as "desktop", a touchscreen laptop at 900px reads as "tablet". **Keep the `pointerType` branch as the house pattern** — it also fixed a latent iOS bug where `mouseenter` fires on tap and left the nav tile stuck filled.

v1.0.142 then deleted the touch branch, because the award rows had become plain divs with no destination. Press feedback on a non-interactive row advertises an affordance that doesn't exist — worse than no feedback. The rule is about affordance, not input.

### `href="#"` slips past both page-transition guards

A Webflow Link Block left on the placeholder `#` resolves to `/about#` with an **empty** hash. `initPageTransition`'s leave handler tests `url.pathname === location.pathname && url.hash` (falsy hash → no bail) and `url.href === location.href` (`…/about#` ≠ `…/about` → no bail), so it would `preventDefault`, fade the page out and reload. Currently latent only because `/about` carries no `[data-page-transition]` element, so the listener never attaches. Convert placeholder link blocks to divs rather than leaving `#`.

### `preventDefault` suppresses the focus move — the skip link never worked

`initNavAnchorLinks` owns the anchor scroll, so the native fragment navigation that *moves focus* never happens. Invisible on section links; fatal for "Skip to main content", which scrolled and then left focus on the skip link itself — the next Tab went back into the nav. Fixed v1.0.143: `tabindex="-1"` (keeps the target out of the tab order), then `focus({ preventScroll: true })` so the browser doesn't jump on top of the smooth scroll.

### `wf-force-outline-none` is Webflow's own hook for programmatic focus

Focusing the target tripped the project's `[tabindex]:focus-visible` rule (`outline-style: solid`, 2px) and drew a ring around an entire section. Webflow already ships `.wf-force-outline-none[tabindex="-1"]:focus { outline: none }`, which out-specifies it (0,3,0 vs 0,2,0). Adding that class is the fix — **no CSS of ours required.**

### Percentage `min-width` is a floor, not a width

`.directional-list__col-award` had `min-width: 30%` with default `flex: 0 1 auto`, so its width was content-driven and the floor only engaged when it exceeded the text. At 1440 the floor computes to 248px (binds on every row → aligned); at 390 it computes to 87px (below every label → content wins → columns jitter 97/108/117px, misaligning the neighbouring column per row). Fix is a **basis, not a floor**: `flex: 0 0 30%` + `min-width: 0`, bumped to `flex-basis: 40%` at ≤767 with side padding 2rem→1rem. Desktop geometry unchanged.

### Webflow Rich Text can never be a heading

`set_tag` on a Rich Text is rejected with the valid list: `div, header, footer, nav, main, section, article, aside, address, figure`. A Rich Text renders `div.w-richtext` whose **children** carry the real tags, taken from *content formatting* — the wrapper is always a container. This is why all Lumos typography components are Rich Text: it is the only element holding mixed inline formatting without extra nesting, it binds to CMS Rich Text fields, and Lumos styles all nested children through `u-rich-text`.

The escape hatch (format the content as Heading 2, as the CTA heading already does) is **unavailable when the Rich Text is bound to a component prop as plain `innerText`** — there is no per-instance formatting. A short label that is structurally a heading must therefore be a Heading element, keeping the eyebrow class for styling. Body copy stays Rich Text.

### Duplicate `id="search"` is structural, not an oversight

The search field is **one** `SearchInput` inside the nested `Menu` component, which `oa Nav` instances twice (desktop variant + mobile `base`). There is no separate mobile element to rename. Removing the ID entirely is the fix — Webflow's search runs on `name="query"` → `/search`, nothing links to `#search`, and no `<label for>` exists. Verified after publish: search still returns hits, page duplicate-id count 0. `aria-label="Search"` added on the same element fixes both renders at once (neither had any accessible name).

### The nav's second dropdown is the locale switcher, not a stub

`nav_dropdown_main_wrap` containing "This is some text inside of a div block." reads as debris, but it wraps a **`LocalesWrapper`** — the language switcher. Deleting it would have removed that from all eight nav instances. Its dangling `aria-labelledby="w-dropdown-toggle-2"` / `-6` is a consequence of being single-locale: Webflow emits the dropdown *list* but not its *toggle*, so the generated reference points at an id that never renders (emitted ids are 0,1,3,4,5,7).

**Never reference Webflow's auto-generated ids** (`w-dropdown-toggle-N`, `w-node-…`) in ARIA, CSS or JS — they renumber on publish. Give the element a stable ID first, as with `biography-label` / `awards-label`.

### MCP element filters do not traverse nested component instances

`query_elements` with `element_filter` returns 0 matches for anything inside a nested `ComponentInstance`, from both page scope and the parent component's scope — `oa Nav` → `Menu` → `SearchInput` was invisible to every filter. Only a **full-depth `get_all_elements` on the parent** reveals the nested component, after which the query must be re-scoped to that component's id. A 0-match result is not evidence of absence; it usually means the element is one component deeper. This produced one round of wrong instructions before the full read corrected it.

### Audit the post-JS DOM, not the served HTML (second occurrence)

Webflow adds dropdown ARIA at runtime, so a `fetch()` + `DOMParser` check reported the orphaned references as resolved when the live DOM still had two. Same trap as the favicon audit. For this site, any Webflow-generated attribute must be read from the running page.

### jsDelivr negative cache, again

v1.0.141 returned `404` as `text/plain` on first check for both files (the documented ORB-block failure). `purge.jsdelivr.net` cleared it immediately; the commit-SHA fallback was not needed. v1.0.142 and v1.0.143 were clean on first check.

### Open

- **Locale switcher** — single-locale site; decide whether a language dropdown belongs in the nav at all. Hiding it removes the dangling ARIA references and the leftover placeholder text with it. Not touched.
- **`<main>` landmark** — `/about` now has `main#main` wrapping its sections. `/` and `/all-products` still have none (`/all-products`'s `<main>` reverted to `section` when its ID was renamed `top` → `main`). Their skip targets are hero sections, not content wrappers, so each needs a wrapper before it can be tagged.
- **`/contact` returns 404** while nav and footer link to it sitewide.
- `Logo Monograph` (from 2026-07-26) still unlocated.

---

## 2026-08-02 — osmo-in skill, infinite-grid reduced motion, v1.0.144

### Idle auto-drift is parallax, and needed a reduced-motion opt-out

`oa-infinite-grid.js` drifted continuously from page load, gated only on `isDragging` and `inViewport`. No `prefers-reduced-motion` check existed in the JS or the CSS. That's auto-starting motion lasting well over 5s with no pause mechanism — WCAG 2.2.2.

The aggravating detail is `columnSpeedPattern = [1, 1, 0.9]`: neighbouring columns drift at *different* rates, so cards move relative to each other. Differential motion is a far stronger vestibular trigger than uniform translation — the drift is parallax, not a pan, and parallax is the canonical reduced-motion opt-out.

**Fixed as a branch, not a kill.** Only the automatic drift stops; drag, lerp smoothing and the scale squish are user-initiated and unchanged. Reduced motion means "don't move things at me", not "don't respond to my input". `reduceMQ.matches` is read inside the ticker rather than cached, so an OS toggle applies on the next frame with no reload — and it matches the existing `mobileMQ.matches` read in `handleMovement`.

**Durable rule:** any Osmo component with idle/ambient motion needs this branch before it ships. Now encoded in `.claude/skills/osmo-in/`.

### `osmo-in` skill added

The paste-and-adapt workflow (CLAUDE.md, Key Patterns) had no procedure attached — the rules governing it were spread across CLAUDE.md, CSS-ARCHITECTURE.md, REFERENCE.md and ~10 entries here. `.claude/skills/osmo-in/SKILL.md` collects them: audit-then-gate, no CDN GSAP, rem over em, no `clamp()`, the repo/Designer CSS split, and the accumulated Osmo traps.

Validated by retrodiction against the two already-adapted components. That caught one overstated rule: "always own the init flag" is `oa-slider.js`'s pattern, needed because Lumos ships a competing init — `oa-infinite-grid.js` has a single mount and correctly has none. Stated as conditional.

Also refined: "branch on capability, never on a breakpoint" is about detecting **input type**. A breakpoint is still right for a genuine layout-region decision, like the 767px 2D-drag region in `oa-infinite-grid.css`.

### Warn prefixes normalised

`[OA]` is the sitewide prefix (`oa-global.js`); page-level scripts use `[oa-<file>]`. Three warns in `oa-all-products.js` and `oa-homepage.js` still used `[OA]`. Log strings only.

### Doc-truth sweep — the v1.0.135 slider removal was never propagated

The infinite grid's header banner claimed hover pauses the drift (stopped being true at v1.0.13x). That was the second stale-comment find in two sessions, so the docs got a full sweep: every identifier, data-attribute, CSS class and version constant in `CLAUDE.md`, `REFERENCE.md` and `CSS-ARCHITECTURE.md` checked against `src/`.

Versions, data-attributes and identifiers were all clean. **Three stale claims, all from the same v1.0.135 slider consolidation:**

1. `CLAUDE.md` — "`oa-global.js` patches Lumos-initialized Swipers at `window.load`". It doesn't; `oa-slider.js` has owned the init since v1.0.135.
2. `CLAUDE.md` — "the slider init is an inline `<script>` frozen in the published file", used as the evidence for "there is no Lumos runtime". The embeds were deleted in the Designer at v1.0.135. The *conclusion* is still right, the example wasn't — replaced with the CSS/classes, which genuinely are frozen.
3. `REFERENCE.md` — documented the 800/700 `window.load` speed patch and the whole `is-slider-transitioning` "raise on settle" gate as live features. Both were removed at v1.0.135; `oa-styles.css` has no raise CSS and `oa-slider.js` has no transition toggling. Rewritten as past tense, noting **`data-raise-on-transition` is now inert**.

Also corrected the `oa-global.js:540` pointer comment, which still sent readers to `data-raise-on-transition` as if it did something.

**The pattern worth remembering:** a consolidation that *removes* code is the case most likely to leave stale docs. Adding a feature forces you to document it; deleting one leaves the old description sitting there, still readable and now false. When a release removes a feature, grep the docs for its identifiers before tagging.

False positives the sweep correctly cleared, so they don't get "fixed" next time: `.filter-btn` / `.filter-list__item` (deliberate negative references to Osmo's demo classes), `.home-hero_video-gradient` (explicitly Webflow-side), `.all_tables_title-wrap` (a historical note about a selector that never existed).

### Open

- Nothing outstanding from this entry.

## 2026-08-05 — Loader: clip-path wipe replaced by a drawn OA outline (pending tag)

The loader's 1.5s `clip-path` inset wipe and its parallel `scaleX` progress bar are
replaced by the mark drawing its own outline, counter-clockwise, over 2.0s. Lottie was
considered and rejected (mobile bugs) — same conclusion as the CTA slice reached on
03-08-2026, so this stays on GSAP + inline SVG and adds no dependency.

### The dash period must equal the path length

`DrawSVGPlugin` is **not** in Webflow's GSAP integration, so the draw is hand-rolled on
`stroke-dasharray` / `stroke-dashoffset` — a first for this codebase. The mark is one
**closed** path authored **clockwise**, and the draw has to start partway along it, at
the corner where the ring meets the A downstroke.

The technique: `dasharray = ` `` `${d} ${L-d}` ``, `dashoffset = d - s`, tweening `d: 0 → L`.
The drawn set is `[s-d, s] mod L`, which grows *backward* from the start node — and
backward along a clockwise path is the counter-clockwise sweep.

**The period must be exactly `L`.** That is the whole trick: it makes the dash phase
identical on both sides of the path's own seam (arc-length 0), so the arc wraps past
that point instead of being clipped there. `` `${d} ${L}` `` looks equivalent, has period
`d+L`, and silently truncates the wrap — a chunk of the mark simply never draws. Verified
in a harness: dash period held at 3792.645 across every frame, and the sweep passes the
seam between 50% and 60% with no dropped segment.

The start node is carried by the **embed** as `data-draw-start="0.54484"` (arc-length
fraction 2066.38 / 3792.64), not hardcoded in JS — geometry and its start point travel
together in the same paste. Length is read from `getTotalLength()` at runtime, so only
the *fraction* is a constant; the browser agreed with the offline flattening to 2dp.

### `[data-load-progress]` was the sentinel, not just a bar

Dropping the progress bar was not cosmetic. `[data-load-progress]` also decided whether
the animated loader ran at all (`initLogoRevealLoader`) and whether the page transition
snapped or faded (`initPageTransition`). Deleting the bar in the Designer without moving
both probes would have given a loader that silently never runs — no error, the page just
reveals instantly. The sentinel is now `[data-load-mark]`, which sits on the svg **inside
the embed**, so it cannot drift away from the geometry it guards.

### No `vector-effect: non-scaling-stroke`

Brendan's call was a px-pinned non-scaling stroke. Shipped instead as `stroke-width: 6.5`
in viewBox units (= 1.25px at the rendered 154px), because that vector-effect's
interaction with `stroke-dasharray` is not consistent across engines and the dash pattern
is what drives the entire animation. Chrome renders both identically; no WebKit build was
available to verify, and iOS Safari is precisely where the Lottie mobile bugs that
prompted this work were felt. The mark renders at a fixed size (Lumos pins root
font-size at 16px), so the vector-effect bought nothing, and the actual goal — weight as a
one-number tweak — comes from the CSS living in this repo, not from the vector-effect.

### Colour and weight ship from the repo; geometry does not

Same trap as the CTA slice: the embed does not deploy. Colour and `stroke-width` are in
`oa-styles.css` so they reach the site on a CDN bump; only a geometry change needs a
re-paste. A first-paint guard (`stroke-dasharray: 0 99999`, scoped `html.w-mod-js:not(.wf-design-mode)`
like the nav/content pre-hides) stops the embed painting a fully-drawn mark in the frames
before the footer script runs.

**The loader geometry is optically corrected for light-on-dark and is NOT the nav mark.**
Brendan baked the correction in at export because the mark needs subtly different geometry
black-on-white vs white-on-black. Do not consolidate the two.

### Timing, and the settle that is already there

2.0s draw on `slideshow-wipe` (`0.625, 0.05, 0, 1`) — already registered in §2, so no
duplicate ease was created. Exit floor raised 1500 → 2000ms to match; total 3.0s nominal.

The curve reaches 97% at **73.3% of its duration**, so a 2.0s draw finishes *visually* at
~1.47s and the floor leaves ~530ms of settle on the finished mark. If that ever reads as a
stall, **lower the floor — do not shorten the draw**, which would change the line's speed
character rather than trim dead time. (Reading the nominal tween end instead of the
perceptual one shipped a stall twice on the CTA slice.)

### Reduced motion: the loader had none

Pre-existing a11y gap — reduced-motion users sat through the full wipe and a 1.0s
full-viewport curtain slide. Now a branch, not a kill: the mark snaps to fully drawn (0
tweens created, verified) and the curtain fades instead of sliding a viewport height.

### Open

- Designer work is unshipped: paste the embed into `[data-load-logo]`, remove that
  element's `clip-path` inset, delete the progress-bar element.
- `--swatch--brand-500` is a Webflow variable and cannot be verified from this repo. CSS
  falls back to `#d66740` / `#803e26` if the name is wrong — check the mark is brand
  orange, not the fallback, on staging.
- Ghost and draw are close in value at 154px. If the sweep reads as too subtle, the lever
  is the ghost, not the line.

### Amendment, same day — ghost fill moved to the Designer, v1.0.154

Shipped as `color-mix(in srgb, var(--swatch--brand-500), black 40%)` (#803e26), which read
far too bright against the near-black curtain and made the sweep a rim-light rather than a
reveal. Retuning it meant a CDN bump every time — wrong knob in the wrong place for a
value that wants eyeballing.

Ghost fill is now `currentColor`: it inherits the text colour of the Embed's parent, so it
is picked live from the Designer's brand swatches (brand-100…900) with no tag. Same
pattern as the CTA slice — the component supplies geometry, the context supplies colour.

**There is deliberately no default `fill` on `.oa_loader_mark-ghost`.** Any rule on that
element would beat the inherited value and take the knob away from the Designer. The
consequence is that the colour MUST be set explicitly on the parent, and must not be left
to inherit from further up: `.oa_logo_nav` once inherited the same variable `.loader__bg`
uses and the mark drew in its own background colour.

The draw line stays `var(--swatch--brand-500, #d66740)` in CSS — it is the brand colour,
not a tuning value.

## 2026-08-06 — The draw-on becomes the house gesture; one mark component, two mounts (v1.0.156)

**Decision (Brendan): the draw-on is the house gesture for the mark.** The CTA slice is
superseded by it and will be retired; `initCtaLogo()` and the slice rig stay in place
until that swap happens, so nothing is deleted here.

### One colour knob, two roles

The contact-page CTA spec is *white text colour as the stroke, 10–20% fill for the mark* —
which is the loader's model with a different colour. So both paths now take
`currentColor`, and the ghost is a dimmed version of the line via `fill-opacity: 0.15`
rather than a separately-chosen colour:

```css
.oa_mark-ghost { fill: currentColor; fill-opacity: 0.15; }
.oa_mark-draw  { fill: none; stroke: currentColor; stroke-width: 6.5; }
```

The Designer sets **one text colour** per mount — brand-500 in the loader, white on the
dark CTA card — and gets both roles from it. That is what makes the two instances read as
the same gesture rather than two animations that happen to share a path. It also finally
gives the stroke a Designer knob; it was previously pinned to `--swatch--brand-500` in CSS.

**This changed the loader's colour model and required a Designer change in the same
publish:** the loader wrap's text colour moved from the literal ghost colour
(`rgb(43,21,13)`) to **brand-500**. Without it the stroke would inherit the old dark brown
and vanish against the curtain. brand-500 at 15% over the near-black curtain composites to
`rgb(41,24,18)` — within a couple of values of the `rgb(43,21,13)` that was tuned by eye,
so the look is preserved.

Note that white at 15% reads stronger than brand-500 at 15% — equal opacity is not equal
presence. Both are inside the 10–20% spec; if they need to diverge, split the rule.

### `stroke-width` in viewBox units pays off here

Because the weight is in viewBox units rather than px, one value covers every mount size —
6.5 = 1.25px at 154px, and scales proportionally at the CTA's size with no second rule.
That was originally chosen to dodge the `non-scaling-stroke` / `stroke-dasharray`
inconsistency (2026-08-05); the size-independence is a second dividend.

### Scroll-triggered mount

`initMarkDraw()` finds `[data-mark-draw]` and arms the same two-observer pattern
`initCtaLogo()` uses — play at 20% into the viewport, rewind and rearm only once the mark
has left the viewport **entirely**, because rewinding on the play threshold blanks the mark
while it is still on screen. `drawMarkOutline()` (renamed from `drawLoaderMark`, it is no
longer loader-specific) gained a `paused` flag and now returns the tween so the observer
can replay it.

The two mounts are driven by **different hooks and cannot double-init**: the loader is
`[data-load-mark]` (also its sentinel), the CTA is `[data-mark-draw]`. Do not put the
loader's sentinel on a CTA embed.

### Known wart

`.oa_loader_mark*` survives as a legacy alias alongside the canonical `.oa_mark*`. The
loader embed was pasted before the rename and re-pasting a working loader purely to change
class names is not worth the risk. Fold it in next time that embed is re-pasted for a real
reason.

### Open — CLOSED 06-08-2026, see the entry below

- ~~The slice is superseded but still live on the /about CTA.~~ Retired at v1.0.157.
- ~~Ghost strength is one shared constant.~~ Ghost and line are now independent per mount.

## 2026-08-06 — Every mark knob moves to the Designer; slice retired (v1.0.157)

Supersedes the colour/weight model of the two entries above.

The mark's paint lived in `oa-styles.css`, which Webflow serves as custom code and the
**Designer canvas does not apply** — so the canvas showed a solid black mark (SVG default
fill) and every tweak cost a tag → CDN → purge → publish cycle. Presentation attributes
and embed CSS both lose to a CSS rule, so control could only be handed back by deleting
those rules.

Colour, opacity, stroke weight, sizing and the first-paint dash guard now live in each
Embed's own `<style>` block, in the labelled CONTROLS idiom of `src/svg/oa-australia-map.svg`.
Line and ghost are independent knobs. **Do not reintroduce a `.oa_mark*` rule in
`oa-styles.css`** — it beats the embed and silently takes the knob away again.

Sizing is width-driven (`width:100%; height:auto`); the parent div carries the width and
`aspect-ratio: 802/793`, and the Webflow `.w-embed` div is left unstyled so the parent's
box is the mark's box.

Motion gains `data-draw-duration` (seconds, both mounts) and `data-draw-trigger` (viewport
%, CTA only). The loader's curtain hold is **derived** from the duration, so a longer draw
can't be cut off mid-sweep. The ease stays in code — shared house curve.

Shipped weight is **4** viewBox units, not 6.5. That also closes the clipping question:
geometry starts 2.084 units inside the viewBox, so a half-stroke of 2.0 no longer
overflows. A heavier stroke than ~4.1 would clip and needs a padded re-export.

Slice retired — verified zero `data-cta-logo` sitewide. `initCtaLogo()`, its call site, the
`oa-slice-disc` / `oa-slice-cut` eases and `.oa_logo_slice` are deleted; the brand rig is
kept in the command centre. The `.oa_loader_mark*` alias died with the re-paste.

### Open

- CTA ghost is `var(--swatch--transparent)` → renders fully invisible, so its
  `fill-opacity: 0.1` does nothing. Intentional or not, unresolved.
- CTA line is `var(--swatch--brand-500, #fff)` — fallback no longer matches the variable.

## 2026-08-09 — Email Direct: address out of the served HTML, Osmo copy-button rejected

Audited Osmo Supply's "Copy Email to Clipboard" against the `• oa CTA` Email Direct
button on `/about`. **Rejected — it is a UX pattern, not an obfuscation one.** Osmo
keeps the address in plaintext inside a `<span>`, so a harvester reads it exactly as
it reads an `href`. Folding it in would have changed spam exposure by zero, cost the
`mailto:` affordance, and shipped four accessibility defects (`aria-label` swap
instead of a live region; `blur()` on `mouseleave` destroying keyboard focus; no
clipboard `.catch()`; copied-state that never resets on touch).

Shipped instead: `initEmailDirect()` in `oa-global.js` §8. The Designer holds
`data-oa-email="hello|objects.agency"` on the Button Main instance — no `@` in the
served HTML — and the `mailto:` href is written only on `pointerenter`/`focusin`/
`touchstart`. Rationale and rules in `docs/contact-strategy.md`.

**The trap:** the Email Direct link prop points at `/contact`, and that is its no-JS
fallback, NOT its destination. Setting that prop back to a `mailto:` in the Designer
silently reinstates the exposure and leaves no trace in this repo.

Latent, not yet cleared: the `• oa CTA` instance carries a second Text prop still set
to the plaintext address on a branch that currently renders nowhere.
