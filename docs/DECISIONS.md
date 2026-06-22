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

The IX2 `scroll.webflow` strip (`oa-global.js` §9, v1.0.107) fixed Chrome but not desktop Safari. Diagnosis (Safari Web Inspector → Timelines → Frames): long frames were dominated by **purple "Styles Recalculated"**, `jQuery._data(window,'events')` showed **no `scroll` handler at all** (strip confirmed working / nothing to strip), and the jank vanished when the cursor was parked **off** the grid. Root cause: scrolling with the cursor over the grid sweeps `:hover` across card after card. The grid image hover is only a tiny `transform: scale(calc(1 + 0.025 * var(--_trigger---off)))` with a **300ms transform transition** (no box-shadow, no layout — confirmed in Webflow). The cost is NOT paint: each `:hover` toggle forces a style recalc, and the 300ms transition means several cards are mid-transition at once as the cursor crosses them, each forcing a recalc **every frame** → Safari floods the main thread (Chrome absorbs it). The amount of recalc scales with the number of toggles/transitions, not the size of the effect — a trivial scale is enough.

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
