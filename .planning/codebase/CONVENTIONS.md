# Coding Conventions

**Analysis Date:** 2026-05-27

## Language & Delivery Model

All source files are **vanilla ES5/ES6 JavaScript** — no TypeScript, no JSX. Two
delivery modes exist:

- **Bundled (ES6 modules):** `src/js/oa-homepage.js` — uses `import` statements,
  compiled by Rollup to `dist/oa-homepage.js` (IIFE, minified).
- **Raw files (no build):** `src/js/oa-global.js`, `src/js/oa-configurator.js`,
  `src/js/oa-all-products.js` — served directly from GitHub via jsDelivr CDN.
  These files must not use bare ES module `import` syntax.

## Naming Patterns

**Files:**
- Kebab-case with `oa-` prefix: `oa-global.js`, `oa-homepage.js`, `oa-all-products.js`
- CSS files mirror JS naming: `oa-styles.css`, `oa-all-products.css`

**Functions:**
- camelCase, verb-noun: `initSlideShow`, `initCascadingSlider`, `initPricingEngine`,
  `initNavSafariFix`, `revealAfterLoader`, `calculatePrice`, `updateSummary`
- Init functions always named `init<Feature>()` — they are the top-level entry
  point for each feature

**Variables:**
- camelCase: `activeIndex`, `isAnimating`, `slideWidth`, `transitionDelay`
- Boolean flags prefixed with `is`: `isAnimating`, `isAttached`, `isSyncing`
- Closures use `const` for collections, `let` for mutable state

**CSS Classes (Webflow):**
- BEM-style with underscores: `hero_feed_top`, `nav_component`, `card_product_wrap`
- State classes use `is-` prefix: `is--current`, `is-open`, `is-slider-transitioning`,
  `is-active`
- Webflow-generated classes are not modified; custom state classes are added on top

**Data Attributes:**
- `data-[feature]-[role]` for JS hooks: `data-slideshow="wrap"`, `data-cascading-slide`,
  `data-filter-target`, `data-filter-name`, `data-load-wrap`, `data-player-control`
- `data-[role]` for state: `data-filter-status="active"`, `data-player-status="playing"`,
  `data-clone`
- Never use class names as JS selectors — always use `data-` attributes

## Code Style

**Formatting:**
- Prettier config (`.prettierrc`): `singleQuote: true`, `semi: true`, `tabWidth: 2`,
  `printWidth: 80`
- Single quotes throughout all JS files

**Var declarations:**
- `oa-global.js` and `oa-configurator.js` use `var` inside some closures and
  `const`/`let` at function scope — mixed but consistent within each file
- `oa-homepage.js` uses `var` for local variables (pre-bundle style for Rollup IIFE
  compatibility)
- `oa-all-products.js` uses `const`/`let` exclusively (most modern)

**Section Comments:**
- Every logical section is headed by a banner comment:
  ```js
  // ============================================================
  // 1. SECTION NAME
  // ============================================================
  ```
- CSS mirrors this pattern with `/* ============================================================ */`
- Sections are numbered sequentially within each file

## Module Design

**Pattern:** Each file exports nothing. All init functions are locally scoped and
called from a single `DOMContentLoaded` listener at the bottom of the file.

**Init pattern (all files):**
```js
document.addEventListener('DOMContentLoaded', function () {
  initFeatureA();
  initFeatureB();
  initFeatureC();
});
```

**`oa-global.js`** additionally uses `window.addEventListener('load', ...)` for
patches that require third-party Swiper instances (initialized by Lumos/Webflow)
to already exist on the page.

**No exports, no module system** (except `oa-homepage.js` which uses `import`).

## GSAP Usage

**Registration:** `gsap.registerPlugin(CustomEase)` is always the first line of
`oa-global.js`. Custom eases are registered immediately after, before any other
code runs:
```js
gsap.registerPlugin(CustomEase);
CustomEase.create("slideshow-wipe", "0.625, 0.05, 0, 1");
CustomEase.create("loader", "0.65, 0.01, 0.05, 0.99");
```

**`oa-configurator.js`** assumes `gsap` is a global already on the page — it does
not import GSAP. `oa-global.js` must load first on every page that uses the
configurator.

**GSAP timeline pattern:**
```js
gsap.timeline({ defaults: { duration: animationDuration, ease: 'slideshow-wipe' } })
  .to(currentSlide, { xPercent: -direction * 100 }, 0)
  .fromTo(upcomingSlide, { xPercent: direction * 100 }, { xPercent: 0 }, 0);
```

**`gsap.set` before animate:** Use `gsap.set` to position off-screen slides
before calling `gsap.to` so entering slides appear from the correct side.

## Swiper Usage

**Always use custom `wrapperClass` and `slideClass`** — never default `.swiper-wrapper`
/ `.swiper-slide`. This prevents conflicts with Webflow's own Swiper instance loaded
by Lumos:

```js
new Swiper(el, {
  wrapperClass: 'hero_feed_top-wrap',
  slideClass: 'hero_feed_top-slide',
  // ...
});
```

**Always include `observer: true, observeParents: true`** on carousels that may
be inside hidden containers (Webflow tabs, modals) so Swiper recalculates
dimensions when the container becomes visible.

**Speed patch pattern:** Lumos-initialized Swipers (not ours) are patched via
`window.load` since Lumos runs before `window.load`:
```js
window.addEventListener('load', function () {
  const el = document.querySelector('.static_slider-wrap .slider_element');
  if (el && el.swiper) el.swiper.params.speed = 800;
});
```

## FOUC Prevention Pattern

Hide elements before Swiper init; reveal on `.swiper-initialized` class (added by
Swiper automatically). Use `opacity: 0` not `display: none` — Swiper must be able
to measure element dimensions before init:

**CSS (in `oa-styles.css`):**
```css
/* Hide before init */
.hero_feed_top .hero_feed_top-wrap { visibility: hidden; }
.hero_feed_top .hero_feed_top-slide { opacity: 0; }

/* Reveal after init */
.hero_feed_top.swiper-initialized .hero_feed_top-wrap { visibility: visible; }
.hero_feed_top.swiper-initialized .hero_feed_top-slide { opacity: 1; }
```

No JS is required — the class transition is pure CSS. This same pattern applies
to `hero_feed_right`.

## Webflow Designer Compatibility

Add `.wf-design-mode` overrides for any CSS that hides or repositions elements,
so the Designer canvas remains usable:

```css
/* In oa-styles.css */
.wf-design-mode [data-cascading-viewport] {
  display: flex;
  flex-direction: row;
  gap: 1em;
  overflow: auto;
}
```

**Loader:** Hidden in Designer and no-JS fallback:
```css
html.wf-design-mode .loader,
.no-js .loader { display: none !important; }
```

## Nav Reveal Pattern

Nav visibility is controlled by CSS class, not GSAP inline styles. This preserves
`mix-blend-mode: difference` on the nav (GSAP `autoAlpha` would add inline
`visibility` which breaks mix-blend-mode):

```css
/* Hidden until loader complete */
html.w-mod-js:not(.wf-design-mode):not(.loader-complete) .nav_component { opacity: 0; }
/* Revealed when JS adds .loader-complete to <html> */
html.w-mod-js:not(.wf-design-mode).loader-complete .nav_component { opacity: 1; visibility: visible; }
```

JS adds `.loader-complete` to `document.documentElement` (not via GSAP):
```js
function revealAfterLoader() {
  document.documentElement.classList.add('w-mod-ix3');
  document.documentElement.classList.add('loader-complete');
}
```

## CSS Custom Properties

**`--ease-osmo`** is defined on `:root` in `oa-styles.css` and used with
`!important` to override Swiper's inline `transition-timing-function`:

```css
:root { --ease-osmo: cubic-bezier(0.22, 0.36, 0.1, 1); }
.slider_element .swiper-wrapper {
  transition-timing-function: var(--ease-osmo) !important;
}
```

**`--gap`** is read from `getComputedStyle` in `oa-configurator.js` via a
throwaway DOM element measurement, not parsed as a string.

## Data Attribute State Machine Pattern

Filter items in `oa-all-products.js` and configurator slides use `data-*`
attributes as state machines rather than class toggles:

```js
// In oa-all-products.js
el.setAttribute('data-filter-status', 'active');   // visible
el.setAttribute('data-filter-status', 'not-active'); // hidden
el.setAttribute('data-filter-status', 'transition-out'); // animating out
```

CSS reacts to attribute state — JS never directly sets `display`, `opacity`, or
`visibility` on filtered items.

## Event Delegation

Prefer delegated listeners on containers over per-element listeners:

```js
// oa-all-products.js — one listener on the group, not per button
group.addEventListener('click', e => {
  const btn = e.target.closest('[data-filter-target]');
  if (btn && group.contains(btn)) paint(btn.getAttribute('data-filter-target'));
});
```

## Error/Null Guards

Every init function exits early if its required DOM element is not present:

```js
function initHeroFeedTopSwiper() {
  var el = document.querySelector('.hero_feed_top');
  if (!el) return;
  // ...
}
```

GSAP `.play()` calls are always wrapped in a null-safe promise catch:
```js
function safePlay(video) {
  var p = video.play();
  if (p && typeof p.then === 'function') p.catch(function(){});
}
```

## CSS Comment Style

Inline explanatory comments explain **why** a rule exists, not what it does.
Especially required when using `!important`, vendor prefixes, or working around
Webflow/Swiper behavior:

```css
/* Webflow sets transition:all on inner — kills it to prevent title animating
   independently from the slide 3D transform/opacity */
.hero_feed_top_slide-inner { transition: none !important; }
```

---

*Convention analysis: 2026-05-27*
