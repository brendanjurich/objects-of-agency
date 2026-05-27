# Objects of Agency — Claude Context

## Project

Webflow site (oa-v5.webflow.io) with custom JavaScript injected via jsDelivr CDN. The JS/CSS source lives in this repo; Webflow loads it from tagged releases.

---

## Source Files

| File | Purpose | Delivery |
|------|---------|----------|
| `src/js/oa-homepage.js` | Swiper v12 carousels for homepage hero (hero_feed_top, hero_feed_right). ES6 imports — must be bundled. | Rollup → `dist/oa-homepage.js` → CDN |
| `src/js/oa-global.js` | GSAP loader, slideshow (data-slideshow), nav animations, custom eases. | Raw file → CDN |
| `src/js/oa-configurator.js` | Cascading slider (product carousels with GSAP, touch/click). | Raw file → CDN |
| `src/js/oa-all-products.js` | Osmo multi-match filter for /all-products. Reads `?filter=` URL param via `paint()` on init. | Raw file → CDN |
| `src/css/oa-styles.css` | Global styles, FOUC prevention, nav, hero carousel. | Raw file → CDN |
| `src/css/oa-all-products.css` | /all-products page styles. | Raw file → CDN |

Only `oa-homepage.js` goes through the build step. The other files are served as-is.

---

## Build

```bash
npm run build
# Rollup bundles src/js/oa-homepage.js → dist/oa-homepage.js (IIFE, minified)
```

---

## CDN Deployment Workflow

1. Make changes and commit to `dev`
2. `npm run build` (if touching oa-homepage.js)
3. Tag the commit: `git tag v1.0.X && git push origin v1.0.X`
4. jsDelivr URL format:
   ```
   https://cdn.jsdelivr.net/gh/brendanjurich/objects-of-agency@v1.0.X/dist/oa-homepage.js
   https://cdn.jsdelivr.net/gh/brendanjurich/objects-of-agency@v1.0.X/src/css/oa-styles.css
   ```
5. Update the URL(s) in Webflow → Site Settings → Custom Code (or page-level settings)
6. Force jsDelivr cache purge: `https://purge.jsdelivr.net/gh/brendanjurich/objects-of-agency@v1.0.X/[path]`

When presenting CDN updates after a tag, always show: **from `@v1.0.X` → to `@v1.0.Y`** for each changed file.

---

## Branch Strategy

- `dev` — all active work
- `main` — release branch; merge dev → main after tagging

---

## Webflow Rules

- **Component link props** require a **Link** field type in the CMS, not Plain Text. Plain Text cannot be bound to a link prop.
- **Grid row height** when an element spans multiple rows is controlled by that element's **aspect ratio**, not by padding on siblings. Change the spanning element's aspect ratio first.
- **FOUC prevention** pattern: hide elements with `opacity:0; visibility:hidden` before init, restore when `.swiper-initialized` (or equivalent initialized class) is added to the container.
- Webflow Designer vs. published site: CSS class changes in Designer apply immediately; script changes require a CDN re-tag + URL update + publish.

---

## Key Patterns

- `paint(target)` in `oa-all-products.js` — the filter activation function; also pre-fires on page load from `URLSearchParams('filter')`
- Swiper carousels use custom `wrapperClass` and `slideClass` (not default `.swiper-wrapper` / `.swiper-slide`) to avoid conflicts with Webflow's own Swiper instance
- GSAP `CustomEase` is registered globally in `oa-global.js` before any page scripts run
