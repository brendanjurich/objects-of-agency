# External Integrations

**Analysis Date:** 2026-05-27

## Hosting & CMS Platform

**Webflow:**
- Platform: Webflow CMS (oa-v5.webflow.io)
- Purpose: Site structure, CMS collections (Products, Sizes, Materials & Finishes), page rendering, IX2 interactions, nav component
- Custom code injected via: Webflow Site Settings → Custom Code (sitewide head/body) and page-level embeds
- No Webflow Ecommerce — quote flow routes to Stripe payment links

## CDN — Script & Style Delivery

**jsDelivr (GitHub-backed):**
- Purpose: Serves all custom JS and CSS files from tagged git commits
- Base URL pattern: `https://cdn.jsdelivr.net/gh/brendanjurich/objects-of-agency@{tag}/{path}`
- Cache purge: `https://purge.jsdelivr.net/gh/brendanjurich/objects-of-agency@{tag}/{path}`
- Files delivered:
  - `dist/oa-homepage.js` — Rollup bundle (Swiper carousels + Bunny video player)
  - `src/js/oa-global.js` — GSAP loader, slideshow, nav animations
  - `src/js/oa-configurator.js` — product page cascading slider and pricing
  - `src/js/oa-all-products.js` — Osmo multi-match filter
  - `src/css/oa-styles.css` — global styles
  - `src/css/oa-all-products.css` — /all-products page styles
- Deployment: tag commit → `git push origin {tag}` → update URL in Webflow → republish
- Caveat: jsDelivr rate-limits rapid tags — new tags may 404 for several hours

**Finsweet Attributes CDN (npm-backed jsDelivr):**
- URL: `https://cdn.jsdelivr.net/npm/@finsweet/attributes-listnest@1/listnest.js`
- Purpose: Enables nested CMS collection lists beyond Webflow's 2-per-page limit
- Applied to: product swatch dots on `/all-products` (Materials & Finishes multi-ref)
- Loaded via `<script defer>` in Webflow `<head>` custom code

## Animation Libraries (Webflow/Lumos-loaded)

**GSAP (GreenSock):**
- Loaded by: Webflow platform / Lumos v2.2.1 as a global dependency
- Version: managed by Lumos (not pinned in this repo)
- Consumed as: global `gsap` object (no import)
- Plugins used: `CustomEase` — registered in `src/js/oa-global.js` line 4
- Custom eases defined: `slideshow-wipe` (0.625, 0.05, 0, 1), `loader` (0.65, 0.01, 0.05, 0.99)
- Used in: `src/js/oa-global.js`, `src/js/oa-configurator.js`

**Lumos v2.2.1:**
- Purpose: Webflow CMS grid layout layer; also initializes Swiper instances on product/home pages
- Swiper instances initialized by Lumos are patched post-`window.load` in `src/js/oa-global.js` lines 170–211 to adjust animation speed and transition flags

## Video Streaming

**Bunny.net (video CDN):**
- Purpose: Background video playback on homepage hero
- Integration: custom `initBunnyPlayerBackground()` in `src/js/oa-homepage.js` lines 78–223
- Mechanism: reads `data-player-src` attribute from DOM elements marked `[data-bunny-background-init]`; loads HLS stream URL directly
- No SDK — pure DOM + HTMLVideoElement API

**hls.js:**
- Purpose: HLS stream parsing on non-Safari browsers
- Loaded as: global `window.Hls` (external script, not bundled)
- Fallback: Safari uses native HLS via `video.canPlayType('application/vnd.apple.mpegurl')`
- Used in: `src/js/oa-homepage.js` lines 115–143

## Payment

**Stripe:**
- Purpose: Deposit payment for product quotes
- Integration: link-only — configurator routes to a Stripe payment link (no SDK, no API calls in this repo)
- No Stripe keys or SDK present in codebase

## Source Control & CI

**GitHub:**
- Repo: `https://github.com/brendanjurich/objects-of-agency` (public)
- Branch strategy: `dev` (active work) → `main` (stable/production after merge)
- No CI pipeline configured (no GitHub Actions workflows detected)
- jsDelivr reads directly from GitHub tags — no build step in CI

## Data Storage

**Databases:** None — all data managed by Webflow CMS collections
- Products, Sizes, Materials & Finishes stored as Webflow CMS items
- No external database, no ORM

**File Storage:** None — images served via Webflow's built-in asset CDN; video via Bunny.net

**Caching:** jsDelivr CDN caches by git tag; manual purge required after re-tagging

## Authentication & Identity

**Auth Provider:** None — no user authentication in this repo
- Webflow Editor access managed by Webflow platform

## Monitoring & Observability

**Error Tracking:** None detected
**Logs:** Browser console only (`console.error`/`console.warn` not used in source; errors swallowed with empty `catch` blocks in `src/js/oa-homepage.js` lines 86–87)

## Environment Configuration

**Required env vars:** None — no environment variables required
**Secrets location:** No secrets in repo; `.gitignore` excludes `.env`, `*.env`, `.env.local`

## Webhooks & Callbacks

**Incoming:** None
**Outgoing:** None

---

*Integration audit: 2026-05-27*
