<!-- refreshed: 2026-05-27 -->
# Architecture

**Analysis Date:** 2026-05-27

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    Webflow CMS (oa-v5.webflow.io)                   │
│             HTML structure, CMS collections, Lumos sliders          │
└──────┬──────────────────┬─────────────────────┬────────────────────┘
       │                  │                     │
       ▼                  ▼                     ▼
┌─────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ oa-global   │  │  oa-homepage     │  │ oa-configurator  │
│ .js (raw)   │  │  .js (bundled)   │  │ .js (raw)        │
│`src/js/`    │  │ `dist/` via CDN  │  │ `src/js/`        │
└─────────────┘  └──────────────────┘  └──────────────────┘
       │                  │                     │
       ▼                  ▼                     ▼
  GSAP + Custom     Swiper v12 npm        GSAP (global)
  Ease globals       (bundled IIFE)      Radio sync engine
  Loader/nav                             Pricing engine

┌──────────────────────────────────────────────────────────────────┐
│                     oa-all-products.js (raw)                     │
│                        `src/js/`                                 │
│            Osmo multi-match filter, URL ?filter= param           │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                       CSS Layer (raw → CDN)                      │
│   `src/css/oa-styles.css`   `src/css/oa-all-products.css`        │
│   Global styles, FOUC prevention, carousel, nav, configurator    │
└──────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| `oa-global.js` | GSAP plugin registration, custom eases, page loader animation, GSAP slideshow (data-slideshow), nav Safari fix, Lumos Swiper patches | `src/js/oa-global.js` |
| `oa-homepage.js` | Swiper v12 carousels for `hero_feed_top` and `hero_feed_right`, Bunny background video player | `src/js/oa-homepage.js` |
| `oa-configurator.js` | Cascading product swatch slider (GSAP), pricing engine, summary updater, radio ID deduplication | `src/js/oa-configurator.js` |
| `oa-all-products.js` | Osmo multi-match filter system, URL `?filter=` param pre-activation via `paint()` | `src/js/oa-all-products.js` |
| `oa-styles.css` | Global base styles, FOUC prevention, hero carousels, nav animations, cascading slider CSS, product card styles | `src/css/oa-styles.css` |
| `oa-all-products.css` | /all-products page filter button states, list item show/hide transitions, Finsweet swatch layout fix | `src/css/oa-all-products.css` |
| `oa-australia-map.svg` | Static SVG map asset for hero feed map section | `src/svg/oa-australia-map.svg` |
| Rollup bundle output | Minified IIFE for CDN delivery of oa-homepage.js | `dist/oa-homepage.js` |

## Pattern Overview

**Overall:** Multi-file script injection pattern. Each JS file is a self-contained IIFE-style module that reads from the DOM and applies behaviour. No shared module system between files at runtime — they communicate through the DOM (CSS classes, data attributes) and rely on globals (`gsap`, `Hls`) loaded before them by Webflow/CDN.

**Key Characteristics:**
- Files are loaded independently via jsDelivr CDN — no runtime import between them
- `oa-global.js` runs first and registers GSAP plugins; all other files depend on `gsap` being a global
- `oa-homepage.js` is the only file built through Rollup (Swiper is an npm dependency); all others are raw files served as-is
- State is stored on DOM elements via `data-*` attributes (`data-player-status`, `data-filter-status`, `data-status`) — not in JS module scope shared across files
- Webflow Designer compatibility is preserved via guards like `.wf-design-mode` CSS overrides

## Layers

**Global Foundation (`oa-global.js`):**
- Purpose: Register GSAP plugins before page scripts run; define custom eases used across all animated pages; run the page loader and nav animations
- Location: `src/js/oa-global.js`
- Contains: `initSlideShow()`, `initLogoRevealLoader()`, `initNavSafariFix()`, Lumos Swiper speed patches
- Depends on: `gsap` and `CustomEase` as browser globals (loaded by Webflow head code)
- Used by: All animated pages

**Homepage Carousel Layer (`oa-homepage.js`):**
- Purpose: Swiper v12 vertical creative-effect carousels for the hero section; Bunny HLS background video controller
- Location: `src/js/oa-homepage.js` → bundled to `dist/oa-homepage.js`
- Contains: `initHeroFeedTopSwiper()`, `initHeroFeedRightSwiper()`, `initBunnyPlayerBackground()`
- Depends on: Swiper v12 npm package (bundled); `Hls` global (optional, loaded separately for HLS video)
- Used by: Homepage only

**Configurator Layer (`oa-configurator.js`):**
- Purpose: Product configurator page interactions — cascading swatch carousel, pricing, order summary, radio deduplication
- Location: `src/js/oa-configurator.js`
- Contains: `initCascadingSlider()`, `fixRadioIds()`, `initPricingEngine()`, `initSummaryUpdater()`
- Depends on: `gsap` global from `oa-global.js`
- Used by: Product configurator page only

**Filter Layer (`oa-all-products.js`):**
- Purpose: Client-side multi-match filtering of product list items; URL param pre-filtering on page load
- Location: `src/js/oa-all-products.js`
- Contains: `initBasicFilterSetupMultiMatch()`, `paint()` (inner function — the filter activation entry point)
- Depends on: No external libraries; pure DOM manipulation
- Used by: /all-products page only

**CSS Layer:**
- Purpose: Global styles, FOUC prevention, animation states driven by JS class toggles, Webflow Designer compatibility overrides
- Location: `src/css/oa-styles.css`, `src/css/oa-all-products.css`
- Contains: Loader state classes (`.loader-complete`), carousel GPU compositing, cascading slider layout, nav states, filter transition states
- Depends on: Webflow CSS variables (`--_theme---text`, `--swatch--box-shadow-2`), JS class application

## Data Flow

### Homepage Hero Carousel Init

1. `DOMContentLoaded` fires → `oa-homepage.js` entry (`src/js/oa-homepage.js:225`)
2. `initBunnyPlayerBackground()` — finds `[data-bunny-background-init]` elements, attaches HLS/native video lifecycle (`src/js/oa-homepage.js:78`)
3. `initHeroFeedTopSwiper()` — queries `.hero_feed_top`, instantiates Swiper with custom `wrapperClass`/`slideClass` to avoid Webflow Swiper conflicts (`src/js/oa-homepage.js:4`)
4. Swiper adds `.swiper-initialized` to container → CSS reveals slides (removes FOUC hidden state) (`src/css/oa-styles.css:504`)

### Page Loader Sequence

1. `oa-global.js` runs immediately (not gated on DOMContentLoaded) — registers `CustomEase`, defines eases (`src/js/oa-global.js:4`)
2. `DOMContentLoaded` → `initLogoRevealLoader()` — finds `[data-load-wrap]`, animates progress bar and logo clip-path over 1.5s (`src/js/oa-global.js:89`)
3. `Promise.all([minDelay, pageReady])` — waits for both 1.5s minimum and `window.load` (`src/js/oa-global.js:119`)
4. Exit animation runs → `revealAfterLoader()` adds `.loader-complete` to `<html>` (`src/js/oa-global.js:84`)
5. CSS transitions nav opacity from 0 to 1 via `.loader-complete` class (`src/css/oa-styles.css:19`)

### Filter Activation (/all-products)

1. `DOMContentLoaded` → `initBasicFilterSetupMultiMatch()` (`src/js/oa-all-products.js:104`)
2. Reads `[data-filter-name-collect]` inner text → hoists values onto `data-filter-name` of parent items
3. Checks `URLSearchParams('filter')` — if non-default value, calls `paint(urlFilter)` immediately (`src/js/oa-all-products.js:93`)
4. `paint(target)` sets `data-filter-status="active"|"not-active"|"transition-out"` on each item with `setTimeout` delay
5. CSS transitions in `oa-all-products.css` drive the show/hide animations based on `data-filter-status`

### Configurator Cascade

1. `DOMContentLoaded` → `fixRadioIds()` deduplicates radio input IDs (`src/js/oa-configurator.js:374`)
2. `initCascadingSlider()` — finds `[data-cascading-slider-wrap]`, measures viewport, positions slides via GSAP (`src/js/oa-configurator.js:4`)
3. Radio `change` events or prev/next clicks call `goTo(index)` → `layout(true)` animates all slides to new positions
4. `syncRadio()` fires `change` event on newly active radio → triggers `initPricingEngine()` and `initSummaryUpdater()` recalculations

**State Management:**
- JS state is local to each `init*` function closure (no global JS state objects)
- UI state is written to DOM via `data-*` attributes and CSS classes
- Cross-script communication uses DOM observation (MutationObserver in `initNavSafariFix`) or shared CSS class application

## Key Abstractions

**`paint(target)` — Filter Activation:**
- Purpose: The single entry point for activating a filter state on the /all-products page
- Examples: `src/js/oa-all-products.js:62`
- Pattern: Inner function closure with `activeTarget` state; called both on user click and on URL param pre-filter at init

**`initBunnyPlayerBackground()` — Video Lifecycle:**
- Purpose: HLS/native video controller with lazy loading, autoplay-on-viewport, and play/pause/mute controls
- Examples: `src/js/oa-homepage.js:78`
- Pattern: Per-element closure with `isAttached`, `pendingPlay`, `lastPauseBy` flags; IntersectionObserver for autoplay gating

**Custom Ease Registration:**
- Purpose: Site-wide named eases available to all GSAP calls
- Examples: `src/js/oa-global.js:9-10`
- Pattern: `CustomEase.create("slideshow-wipe", ...)`, `CustomEase.create("loader", ...)` — registered once in `oa-global.js` before any page scripts

**`--ease-osmo` CSS Custom Property:**
- Purpose: Shared easing token for Swiper `transition-timing-function` overrides
- Examples: `src/css/oa-styles.css:598`
- Pattern: Defined on `:root`, applied via `!important` to override Swiper's inline `transition-timing-function`

## Entry Points

**`oa-global.js` — Immediate + DOMContentLoaded:**
- Location: `src/js/oa-global.js:4` (immediate) and `src/js/oa-global.js:160` (DOMContentLoaded)
- Triggers: Script tag execution in Webflow `<head>` or `</body>` custom code
- Responsibilities: GSAP plugin registration (immediate), then loader + slideshow + nav init on DOM ready; Lumos Swiper patches on `window.load`

**`oa-homepage.js` — DOMContentLoaded:**
- Location: `src/js/oa-homepage.js:225`
- Triggers: Script tag on homepage only
- Responsibilities: Swiper carousel init, Bunny video player init

**`oa-configurator.js` — DOMContentLoaded:**
- Location: `src/js/oa-configurator.js:374`
- Triggers: Script tag on configurator page only
- Responsibilities: All configurator UI behaviour

**`oa-all-products.js` — DOMContentLoaded:**
- Location: `src/js/oa-all-products.js:104`
- Triggers: Script tag on /all-products page only
- Responsibilities: Filter system init, URL param pre-filter

## Architectural Constraints

- **No shared runtime module system:** Files cannot import from each other at runtime. `oa-global.js` must load first because `gsap` must be a global before `oa-configurator.js` or the slideshow runs.
- **Global state:** `gsap` and `CustomEase` are browser globals. `Hls` (hls.js) is an optional global checked at runtime (`window.Hls`).
- **Webflow Swiper conflict:** Webflow ships its own Swiper instance. `oa-homepage.js` uses custom `wrapperClass`/`slideClass` on all carousels to avoid selector collisions.
- **CDN delivery — no hot reload:** All changes require a git tag, jsDelivr URL update in Webflow, and a cache purge. Only `oa-homepage.js` requires a Rollup build step before tagging.
- **Webflow Designer compatibility:** CSS uses `.wf-design-mode` guards so cascading slider and loader do not break the designer preview.

## Anti-Patterns

### Using default Swiper wrapper/slide class names

**What happens:** Using `.swiper-wrapper` / `.swiper-slide` as wrapper/slide class in new Swiper instances on Webflow pages.
**Why it's wrong:** Webflow injects its own Swiper instance; both instances target the same elements, causing double-init and layout corruption.
**Do this instead:** Always set `wrapperClass` and `slideClass` to element-specific names (e.g. `hero_feed_top-wrap`, `hero_feed_top-slide`) as done in `src/js/oa-homepage.js:9-10`.

### Applying `transition` to Swiper slide inner elements

**What happens:** Webflow sets `transition: all` on inner link blocks inside slides.
**Why it's wrong:** `transition: all` causes the slide title/content to animate independently from Swiper's 3D creative-effect transform, producing a visible "pop".
**Do this instead:** Override with `transition: none !important` scoped to the inner element (e.g. `.hero_feed_top_slide-inner { transition: none !important; }` in `src/css/oa-styles.css:491`).

### Using GSAP inline styles for nav visibility (FOUC prevention)

**What happens:** Using `gsap.to(navComponent, { autoAlpha: 1 })` to reveal the nav after loader exit.
**Why it's wrong:** GSAP inline styles override `mix-blend-mode` on the nav, breaking the blend mode effect.
**Do this instead:** Add `.loader-complete` to `<html>` and use CSS class-based transitions, as done in `src/js/oa-global.js:84` + `src/css/oa-styles.css:16-25`.

## Error Handling

**Strategy:** Silent guard returns. Each `init*` function checks for required DOM elements at the top and returns early if not found. No error logging.

**Patterns:**
- `if (!el) return;` — guard at top of every init function before any DOM queries
- `try { video.pause(); } catch(_) {}` — swallowed exceptions for video API calls that may fail on some browsers (`src/js/oa-homepage.js:86`)
- `var p = video.play(); if (p && typeof p.then === 'function') p.catch(function(){});` — Promise-based play() rejection handled silently (`src/js/oa-homepage.js:220`)

## Cross-Cutting Concerns

**Loader state:** The `.loader-complete` class on `<html>` is the global "page ready" signal. CSS throughout `oa-styles.css` gates visibility on this class.
**Webflow Designer:** `.wf-design-mode` guards in CSS prevent animations and layout engines from running in Webflow Designer preview.
**Mobile touch gating:** `body.is-slider-transitioning` class (toggled in `oa-global.js` window.load patch) prevents CSS from applying the "raise active card" effect during Swiper transitions.

---

*Architecture analysis: 2026-05-27*
