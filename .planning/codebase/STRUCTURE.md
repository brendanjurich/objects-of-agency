# Codebase Structure

**Analysis Date:** 2026-05-27

## Directory Layout

```
objects-of-agency/
├── src/                    # All source files authored in this repo
│   ├── js/                 # JavaScript source files
│   │   ├── oa-global.js    # GSAP loader, slideshow, nav — raw → CDN
│   │   ├── oa-homepage.js  # Swiper carousels, Bunny video — Rollup entry point
│   │   ├── oa-configurator.js  # Product configurator — raw → CDN
│   │   └── oa-all-products.js  # Filter system — raw → CDN
│   ├── css/                # CSS source files
│   │   ├── oa-styles.css   # Global styles, FOUC prevention — raw → CDN
│   │   └── oa-all-products.css  # /all-products page styles — raw → CDN
│   └── svg/                # Static SVG assets
│       └── oa-australia-map.svg  # Hero feed map SVG
├── dist/                   # Rollup build output (committed — served via CDN)
│   └── oa-homepage.js      # Minified IIFE bundle (do not edit manually)
├── docs/                   # Reference documentation (not served)
│   ├── architecture.md
│   ├── all-products-filter-sort.md
│   ├── home_hero_swiper-fix.md
│   ├── swiper-home-hero-feed-fix.md
│   ├── cubic-bezier-rules.md
│   ├── gsd-skill-reference.md
│   └── [other reference docs]
├── .planning/              # GSD planning artifacts (not served)
│   └── codebase/           # Auto-generated codebase maps
├── .claude/                # Claude project memory
├── .vscode/                # Editor settings
├── rollup.config.mjs       # Rollup build config (oa-homepage.js only)
├── package.json            # npm manifest — swiper dep + rollup devDeps
├── package-lock.json       # Lockfile (committed)
├── CLAUDE.md               # Project context for Claude
├── .prettierrc             # Prettier formatting config
└── .gitignore              # Excludes node_modules, .env, screenshots
```

## Directory Purposes

**`src/js/`:**
- Purpose: All JavaScript source files for the site
- Contains: One file per page scope or global concern
- Key files: `oa-global.js` (runs on every page), `oa-homepage.js` (homepage only), `oa-configurator.js` (configurator page), `oa-all-products.js` (/all-products page)
- Delivery: Raw files served directly via jsDelivr CDN — except `oa-homepage.js` which is the Rollup entry point

**`src/css/`:**
- Purpose: All CSS source files for the site
- Contains: `oa-styles.css` (global), `oa-all-products.css` (page-specific)
- Delivery: Raw files served directly via jsDelivr CDN (no build step)

**`src/svg/`:**
- Purpose: SVG assets referenced by Webflow pages
- Contains: `oa-australia-map.svg` — the animated Perth-marker map in the hero feed
- Delivery: Raw file via jsDelivr CDN

**`dist/`:**
- Purpose: Rollup build output for `oa-homepage.js`
- Generated: Yes — via `npm run build`
- Committed: Yes — the CDN serves this file directly from the git tag
- Do not edit `dist/oa-homepage.js` manually; always rebuild from `src/js/oa-homepage.js`

**`docs/`:**
- Purpose: Reference documentation, architectural notes, and implementation guides for developers
- Generated: No — manually authored
- Committed: Yes
- Not served to users

**`.planning/codebase/`:**
- Purpose: GSD codebase map documents (ARCHITECTURE.md, STRUCTURE.md, etc.)
- Generated: Yes — by `/gsd-map-codebase`
- Committed: Yes

**`node_modules/`:**
- Purpose: npm dependencies (Swiper, Rollup, plugins)
- Generated: Yes
- Committed: No (in `.gitignore`)

## Key File Locations

**Entry Points:**
- `src/js/oa-global.js`: Runs on every page — GSAP registration, loader, nav, slideshow
- `src/js/oa-homepage.js`: Homepage only — Swiper carousels and Bunny video
- `src/js/oa-configurator.js`: Configurator page only — cascading slider, pricing
- `src/js/oa-all-products.js`: /all-products page only — filter system

**Build Configuration:**
- `rollup.config.mjs`: Rollup config — input `src/js/oa-homepage.js`, output `dist/oa-homepage.js` as IIFE named `OAHomepage`, minified via terser
- `package.json`: `"build": "rollup -c rollup.config.mjs"` — run with `npm run build`

**CSS:**
- `src/css/oa-styles.css`: Global styles and all component CSS used across pages
- `src/css/oa-all-products.css`: Styles scoped to the /all-products page

**Assets:**
- `src/svg/oa-australia-map.svg`: Hero feed map with Perth marker pulse animation

**Build Output:**
- `dist/oa-homepage.js`: The file tagged and served via jsDelivr for the homepage

## Naming Conventions

**Files:**
- All source files prefixed `oa-` followed by the page or scope name: `oa-global`, `oa-homepage`, `oa-configurator`, `oa-all-products`
- Kebab-case throughout: `oa-all-products.js`, not `oaAllProducts.js`
- CSS files mirror the JS file they support: `oa-styles.css` (global), `oa-all-products.css` (page-scoped)

**JavaScript functions:**
- Init functions: `init` + PascalCase descriptor — `initHeroFeedTopSwiper`, `initCascadingSlider`, `initPricingEngine`
- Helper functions: camelCase — `readGap`, `getOffset`, `measure`, `layout`, `goTo`, `paint`
- All functions declared with `function` keyword (not arrow functions at top level)

**CSS class names:**
- Component prefix + element: `.hero_feed_top`, `.hero_feed_top-wrap`, `.hero_feed_top-slide`
- Webflow-style underscores within component names, hyphens for modifiers
- State classes: `is-open`, `is-active`, `is-slider-transitioning`, `loader-complete`
- Data attribute selectors for JS-driven state: `[data-filter-status="active"]`, `[data-cascading-slide][data-status="active"]`, `.swiper-initialized`

**Data attributes:**
- Behaviour hooks: `data-slideshow`, `data-cascading-slider-wrap`, `data-filter-group`, `data-load-wrap`
- State attributes written by JS: `data-filter-status`, `data-player-status`, `data-player-activated`, `data-status`

## Where to Add New Code

**New page-specific JavaScript:**
- Create `src/js/oa-[page-name].js` following the existing pattern: named `init*` functions, single `DOMContentLoaded` listener at the bottom
- If it uses npm dependencies (like Swiper), add it as a Rollup entry point in `rollup.config.mjs` and output to `dist/`
- If it uses only browser globals (DOM, GSAP), serve it raw via CDN — no build step needed

**New global JavaScript behaviour:**
- Add a new `init*` function to `src/js/oa-global.js` and call it from the existing `DOMContentLoaded` block at line 160, or from the `window.load` block at line 170 if it requires Lumos/Swiper instances

**New global styles:**
- Add to `src/css/oa-styles.css` with a `/* === SECTION NAME === */` comment block header matching the existing style

**New page-specific styles:**
- Create `src/css/oa-[page-name].css` if a dedicated page CSS file does not already exist, or add to the existing page CSS file

**New SVG assets:**
- Place in `src/svg/`

**After any change:**
1. If `oa-homepage.js` was modified: run `npm run build`
2. Commit to `dev`
3. Tag: `git tag v1.0.X && git push origin v1.0.X`
4. Update jsDelivr URLs in Webflow Site Settings → Custom Code
5. Purge jsDelivr cache

## Special Directories

**`dist/`:**
- Purpose: Rollup output — the minified IIFE bundle for `oa-homepage.js`
- Generated: Yes (via `npm run build`)
- Committed: Yes — jsDelivr serves directly from the git tag; the built file must be in the repo

**`docs/`:**
- Purpose: Developer reference guides and architectural decision records
- Generated: No
- Committed: Yes

**`.planning/`:**
- Purpose: GSD workflow planning artifacts
- Generated: Yes (by GSD commands)
- Committed: Yes (planning docs are committed alongside code)

---

*Structure analysis: 2026-05-27*
