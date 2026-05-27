# Technology Stack

**Analysis Date:** 2026-05-27

## Languages

**Primary:**
- JavaScript (ES6+) - All source files in `src/js/`; `oa-homepage.js` uses ES6 module imports, others use plain ES5-compatible globals
- CSS - Styles in `src/css/`

**Secondary:**
- None — no TypeScript, no preprocessors (Sass/Less)

## Runtime

**Environment:**
- Node.js v25.8.1 (build tooling only; no server runtime)

**Package Manager:**
- npm
- Lockfile: present (`package-lock.json`, lockfileVersion 3)

## Frameworks

**Core:**
- None — vanilla JavaScript; no application framework (React, Vue, etc.)

**Animation:**
- GSAP (GreenSock) — loaded globally by Webflow/Lumos as a site-level dependency; consumed by `src/js/oa-global.js` and `src/js/oa-configurator.js` via the global `gsap` object (not imported, not bundled)
- GSAP CustomEase plugin — registered in `src/js/oa-global.js` line 4 before any page scripts run

**Carousel:**
- Swiper v12.1.4 — npm dependency; imported as ES6 module in `src/js/oa-homepage.js`; bundled into `dist/oa-homepage.js` via Rollup. Used for `hero_feed_top` and `hero_feed_right` carousels.

**Build/Dev:**
- Rollup v4.60.4 — bundles only `src/js/oa-homepage.js`; all other JS/CSS files served raw
- @rollup/plugin-node-resolve v16.0.3 — resolves npm dependencies (Swiper) into the bundle
- @rollup/plugin-terser v1.0.0 — minifies the IIFE output

## Key Dependencies

**Critical:**
- `swiper` v12.1.4 — Swiper carousel library; bundled into `dist/oa-homepage.js`. Custom `wrapperClass`/`slideClass` attributes used to avoid conflicts with Webflow's own Swiper instance. See `src/js/oa-homepage.js` lines 8–76.

**Build-time only:**
- `rollup` v4.60.4 — build runner (`npm run build`)
- `@rollup/plugin-node-resolve` v16.0.3 — tree-shaking Swiper modules into the bundle
- `@rollup/plugin-terser` v1.0.0 — minification via Terser v5.48.0

**Runtime (CDN-loaded, not in package.json):**
- GSAP + CustomEase — loaded by Webflow/Lumos platform before custom scripts run; consumed as global `gsap` object
- hls.js — expected as `window.Hls` for HLS video playback on non-Safari browsers (`src/js/oa-homepage.js` lines 115–143); loaded externally, not bundled
- Finsweet Attributes listnest v1 — `https://cdn.jsdelivr.net/npm/@finsweet/attributes-listnest@1/listnest.js`; handles nested CMS collection lists on `/all-products`
- Lumos v2.2.1 — Webflow CMS grid/layout layer; initializes Swiper instances on product/home pages patched in `src/js/oa-global.js` lines 170–211

## Configuration

**Build:**
- `rollup.config.mjs` — single entry point `src/js/oa-homepage.js`, output `dist/oa-homepage.js`, format IIFE, global name `OAHomepage`

**Environment:**
- No `.env` file present; no environment-specific configuration required for the build
- No API keys or secrets in source — see `.gitignore` which excludes `.env`, `*.env`, `.env.local`

## Platform Requirements

**Development:**
- Node.js (v25.8.1 used; no `.nvmrc` or `.node-version` file present)
- `npm install` to install Rollup + Swiper
- `npm run build` to produce `dist/oa-homepage.js`

**Production:**
- Static file delivery only via jsDelivr CDN from GitHub releases
- No server, no build pipeline in production — files are served directly from tagged git commits
- Webflow CMS platform handles HTML rendering; custom JS/CSS injected via Webflow's "Custom Code" settings

---

*Stack analysis: 2026-05-27*
