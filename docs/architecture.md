# Objects of Agency — Architecture

Webflow site. Staging: oa-v5.webflow.io. Repo: brendanjurich/objects-of-agency (public).

## Stack
Webflow CMS + Lumos v2.2.1 + GSAP + jsDelivr CDN + Finsweet Attributes. No Slater. No Webflow Ecommerce.

## Files
```
src/css/oa-styles.css       → sitewide, <head>
src/js/oa-global.js         → sitewide, before </body>
src/js/oa-configurator.js   → product pages only, page-level embed
docs/architecture.md        → read this before every session
```

## CDN (current tags)
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/brendanjurich/objects-of-agency@v1.0.32/src/css/oa-styles.css">
<script src="https://cdn.jsdelivr.net/gh/brendanjurich/objects-of-agency@v1.0.32/src/js/oa-global.js"></script>
<script src="https://cdn.jsdelivr.net/gh/brendanjurich/objects-of-agency@v1.0.18/src/js/oa-configurator.js"></script>
```
oa-configurator.js pinned at v1.0.18 independently for stability.

## Deployment
```bash
git add . && git commit -m "type: description"
git tag v1.x.x && git push origin dev && git push origin v1.x.x
# Update tag in Webflow custom code URLs → republish
```
Branches: `main` (stable/production), `dev` (active work). Never commit directly to main.

## Rules — never break these
- NEVER use GSAP autoAlpha on .nav_component — breaks mix-blend-mode
- NEVER write CSS inside Lumos embeds — wiped on Lumos updates. oa-styles.css only
- NEVER use dvh for hero height — use svh
- NEVER commit API keys, credentials, .env files
- jsDelivr rate-limits rapid tags — new tags may 404 for hours

## oa-global.js — sitewide only
Functions: initLogoRevealLoader, initSlideShow, initNavSafariFix. GSAP + CustomEase registration.
Nav visibility: CSS class toggle only via `loader-complete` on `<html>`. revealAfterLoader() also adds `w-mod-ix3` for Webflow IX2 guard.
Loader: entrance (1.5s) + exit gated on Promise.all([1.5s min, window.load]).

## oa-configurator.js — product pages only
Own DOMContentLoaded listener. Never share with oa-global.js.
Functions: initCascadingSlider, fixRadioIds, initPricingEngine(todo), initSummaryUpdater(todo), initImageSwap(todo), initQuoteForm(todo).

### fixRadioIds targets
```
input[name="Sizes"]           → id: size-{n}
input[name="Top-Material"]    → id: top-material-{n}
input[name="Timber"]          → id: timber-{n}
input[name="Anodised-Finish"] → id: anodised-{n}
```

## CMS Collections
**Products:** Name, Base Price (number), Has Size Config, Has Top Material, Has Timber, Has Anodised Finish, Has Static Info (all toggles), Label (text), Show Label (toggle), Has More Variants (toggle).
**Sizes:** Name, Price Modifier (number), SVG Drawing (image).
**Materials & Finishes:** Name, Price Modifier (number), Swatch Image (avif ~2kb), Slider Image (avif).

## Configurator — product page right column
```
config_wrap_right
├── config_wrap_main
│   ├── config_wrap_price
│   │   ├── config_price_prefix   → static "From $", never touched by JS
│   │   ├── config_from_price     → JS-controlled display
│   │   └── config_base_price     → hidden, CMS number (display:none)
├── config_size_wrap              → toggle: Has Size Config
├── config_top_wrap               → toggle: Has Top Material
├── config_timber_wrap            → toggle: Has Timber
├── config_anodised_wrap          → toggle: Has Anodised Finish
├── config_summary_wrap           → always visible
└── config_static_wrap            → toggle: Has Static Info
```

### Pricing — additive
`Total = Base Price + sum of [data-price] on checked collection items`
[data-price] on each w-dyn-item, CMS-bound to Price Modifier. Format with Intl.NumberFormat, no currency symbol. Update on every radio change.

### Summary card DOM IDs
`#summary-size`, `#summary-top-material`, `#summary-timber`, `#summary-anodising`
Default content: em dash. JS replaces on radio change.

### Radio names
Sizes, Top-Material, Timber, Anodised-Finish

### Cascading slider
initCascadingSlider() in oa-configurator.js.
Targets: [data-cascading-slider-wrap], [data-cascading-viewport], [data-cascading-slide]
Synced to radio buttons. Slider selects radio; radio selects slider.

### Image DOM swap — pending
KeyShot pre-rendered images swapped on material selection. Architecture TBD.

### Quote flow
No cart. Configurator → quote form → Stripe payment link for deposit.

## CMS grid fix (all collection lists in grids)
```css
.{section}_collection { display: contents; } /* w-dyn-list */
.{section}_list { display: contents; }        /* w-dyn-items */
```
Makes w-dyn-item a direct grid child. Lumos grid props work correctly. Name per section.

## Finsweet Attributes
Used for nested collection lists beyond Webflow's 2-per-page limit.
Script in <head>:
```html
<script defer src="https://cdn.jsdelivr.net/npm/@finsweet/attributes-listnest@1/listnest.js"></script>
```
Applied to: product cards on All Products page (swatch dots via Materials & Finishes multi-ref).

## All Products page — static, NOT Categories template
One section per category. Anchor link routing from hero slider.
Tables: Osmo filter (initBasicFilterSetupMultiMatch) scoped to Tables section only via [data-filter-group].
All other sections: unfiltered grids.

### Tables filter data attributes
- [data-filter-group] — Tables section wrapper only
- [data-filter-target] — filter buttons
- [data-filter-name] + .filter-list__item — w-dyn-item

### CSS override — prevents grid escape
```css
.filter-list__item[data-filter-status="not-active"] { display: none; position: static; }
.filter-list__item[data-filter-status="active"] { display: block; }
```

### Routing
Tables, Sideboards, Shelving, Seating, Office, Outdoor, Accessories → /all-products#{section}
Bedroom, Edition Pieces, Homewares → direct to product page (1 product each)

### Parked
Section height animation on filter reflow. JS needed to animate height:auto. Implement post-launch.
