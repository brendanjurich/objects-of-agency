# Testing Patterns

**Analysis Date:** 2026-05-27

## Test Framework

**Automated tests:** None. There is no test framework, no test runner, no test
files, and no test scripts in `package.json`. The `devDependencies` contain only
Rollup and its plugins.

**Manual testing is the only testing method for this project.**

## Manual Testing Process

### Primary Method: Browser DevTools + Live Preview

1. Make changes to source files in `src/`
2. For `oa-homepage.js` only: run `npm run build` to regenerate `dist/oa-homepage.js`
3. Commit to `dev` branch and tag: `git tag v1.0.X && git push origin v1.0.X`
4. Update CDN URLs in Webflow → Site Settings → Custom Code
5. Force jsDelivr cache purge:
   `https://purge.jsdelivr.net/gh/brendanjurich/objects-of-agency@v1.0.X/[path]`
6. Publish the Webflow site
7. Open the live URL in browser and test interactions

### Secondary Method: Playwright MCP

Playwright is available as an MCP server for browser automation during development.
Used for:
- Verifying carousel transitions and animation timing
- Checking FOUC behavior (page load before/after Swiper init)
- Validating filter state on `/all-products` with `?filter=` URL params
- Cross-browser checks (Safari, Chrome, Firefox)

Playwright is not run via `npm test` — it is invoked interactively through the
MCP tool during a coding session.

## What to Test When Changing Each File

### `src/js/oa-homepage.js` (requires `npm run build`)

- **Hero feed top carousel** (`.hero_feed_top`):
  - Slides auto-advance every 5 seconds
  - No FOUC on page load — slides hidden until `.swiper-initialized` appears
  - Creative effect plays (prev/next translate + opacity + scale)
  - No flash of slides before Swiper initializes
  - `visibility: hidden` on wrapper before init, `visibility: visible` after

- **Hero feed right carousel** (`.hero_feed_right`):
  - Same autoplay and creative effect verification
  - `cursor: default` — no pointer cursor anywhere on the component
  - Glass background darkens on hover

- **Bunny background video player** (`[data-bunny-background-init]`):
  - `data-player-status` transitions: `idle` → `loading` → `playing` → `paused`
  - Intersection Observer pauses/resumes on scroll
  - Safari HLS native vs. hls.js path — test in Safari separately
  - Play/pause/mute button controls via `[data-player-control]`

### `src/js/oa-global.js` (raw file — no build step)

- **Loader animation** (`[data-load-wrap]`):
  - Logo wipe and progress bar entrance (~1.5s)
  - Loader exits after `window.load` + 1.5s minimum delay
  - `.loader-complete` added to `<html>` — nav becomes visible
  - Pages without `[data-load-progress]` reveal immediately
  - `html.wf-design-mode .loader` is `display: none` (check in Designer)

- **Slideshow** (`[data-slideshow="wrap"]`):
  - Thumb click navigates to correct slide
  - `is--current` class updates on both slides and thumbs
  - `animating` lock prevents mid-animation clicks
  - Parallax inner elements move opposite to slide direction

- **Nav Safari fix** (`.nav_component`):
  - Menu opens/closes — `.is-open` class toggles on `.nav_component`
  - `body.menu-open` added/removed
  - 400ms debounce on remove prevents flicker on fast open/close

- **Static slider speed patch** (`.static_slider-wrap .slider_element`):
  - Open browser DevTools, inspect `.swiper` instance after `window.load`
  - `swiper.params.speed` should be 800ms desktop, 700ms touch

- **Home products slider transitioning flag** (`.section_menu_wrap .slider_element`):
  - Swipe a card — `body.is-slider-transitioning` present during animation
  - After animation settles: `body.is-slider-transitioning` removed
  - Active card raises (scale + box-shadow) only after class is gone

### `src/js/oa-configurator.js` (raw file — no build step)

- **Cascading slider** (`[data-cascading-slider-wrap]`):
  - Prev/next buttons move active slide
  - Clicking an inactive slide activates it
  - Arrow keys work while mouse is over the slider
  - `data-status="active"` set on center slide, `inactive` on others
  - Slide width recalculates on viewport resize (ResizeObserver)
  - Fewer than 9 slides: clones are added, slider still works

- **Radio ID fix** (`fixRadioIds`):
  - No duplicate `id` attributes on radio inputs after page load
  - Label `for` attributes match the corrected IDs

- **Pricing engine** (`.config_base_price`):
  - Selecting a size/material radio updates `.configure_price`
  - Price resets correctly if another option is chosen

- **Summary updater**:
  - Active slide text appears in summary IDs: `summary-size`,
    `summary-top-material`, `summary-timber`, `summary-anodising`

### `src/js/oa-all-products.js` (raw file — no build step)

- **Filter buttons** (`[data-filter-target]`):
  - Clicking a button sets its `data-filter-status="active"`
  - Matching items show (`data-filter-status="active"`)
  - Non-matching items hide with transition-out animation then `not-active`
  - "All" button shows all items

- **URL param pre-filter**:
  - Navigate to `/all-products?filter=timber` — correct filter active on load
  - `?filter=all` → all items shown, no pre-filter applied
  - No `?filter` param → all items shown (default state)

- **`paint(target)` function** (`src/js/oa-all-products.js` line 62):
  - Core activation function. All filter changes — click or URL — route through
    `paint()`. Test this path when debugging filter issues.

### `src/css/oa-styles.css` / `src/css/oa-all-products.css` (raw files)

- **FOUC prevention:**
  - Hero feeds hidden before Swiper init (check in DevTools network throttling)
  - Nav hidden until `.loader-complete` on `<html>` — no flash on slow connections

- **`mix-blend-mode: difference`** on nav:
  - Open on a light background — nav appears dark
  - Open on a dark background — nav appears light
  - Ensure no GSAP inline `visibility` is interfering (GSAP sets `visibility:hidden`
    which breaks blend mode)

- **Cascading slider in Designer:**
  - `.wf-design-mode [data-cascading-viewport]` shows slides in a horizontal row
  - Slides visible and readable in the Webflow Designer canvas

- **`prefers-reduced-motion`:**
  - Greeting animation stops; only first greeting (`nth-child(1)`) visible

## Regression Checklist (Before Tagging a Release)

When any JS or CSS file changes, run through these manually before tagging:

- [ ] Homepage loads without console errors
- [ ] Hero feed carousels autoplay without visible FOUC
- [ ] Nav shows after loader animation completes
- [ ] `/all-products?filter=timber` pre-filters correctly on load
- [ ] Configurator page: selecting options updates price and summary
- [ ] Safari: loader, nav blend mode, hero carousels all work
- [ ] Mobile: product card raises after slider settles (no jitter)
- [ ] Webflow Designer: loader hidden, cascading slider visible in canvas

## Build Verification

After `npm run build`:

```bash
# Verify dist/oa-homepage.js was generated and is non-empty
ls -lh /Users/brendanjurich/Documents/objects-of-agency/dist/oa-homepage.js

# Verify it's a valid IIFE (starts with var OAHomepage or similar)
head -c 100 /Users/brendanjurich/Documents/objects-of-agency/dist/oa-homepage.js
```

The bundled file must be present at `dist/oa-homepage.js` before tagging —
jsDelivr serves this path for the homepage carousels.

## CDN Cache Verification

After tagging and purging jsDelivr:

1. Request the CDN URL directly in a browser tab — check the response is the
   new version (look for known code change)
2. Open the published Webflow site in a **private/incognito** window — no cache
3. Check browser DevTools Network tab: CDN files return 200 (not 304) after purge

## Known Manual Test Gaps

- **Cross-browser automated coverage:** No CI — Safari/Firefox tested manually only
- **Touch events:** No automated touch simulation — tested on physical device or
  Chrome DevTools touch emulation
- **Loader timing on slow connections:** No automated network throttle testing —
  manual only via DevTools Network → Slow 3G
- **Playwright scope:** Currently ad-hoc during development sessions; no saved
  Playwright scripts that can be re-run for regression

---

*Testing analysis: 2026-05-27*
