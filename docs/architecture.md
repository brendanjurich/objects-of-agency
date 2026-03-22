# Objects of Agency — Architecture & Decisions Log

## Project Overview

Premium furniture e-commerce site. Designer-led build with a non-developer owner.
Engineering lead: Claude Code.
Staging: oa-v5.webflow.io

---

## Tech Stack

| Layer | Tool | Role |
|---|---|---|
| CMS & Layout | Webflow | Page structure, CMS, hosting |
| Animations | GSAP + CustomEase | Slideshow, loader, cascading slider |
| UI Components | Lumos v2.2.1 | Component library, utility classes |
| CSS Authoring | VS Code | Master stylesheet |
| JS Authoring | VS Code | Global and page-level scripts |
| Version Control | GitHub | Source of truth for all code |
| CDN Delivery | jsDelivr | Serves CSS/JS to Webflow from GitHub |
| IDE | VS Code + Claude Code | Authoring and engineering lead |

**Slater: removed from stack.** Replaced by jsDelivr to eliminate vendor dependency
and subscription risk on a live production site.

---

## File Structure

```
objects-of-agency/
├── src/
│   ├── css/
│   │   └── oa-styles.css        ← sitewide CSS, loaded in <head> on all pages
│   └── js/
│       ├── oa-global.js         ← sitewide JS, loaded before </body> on all pages
│       └── oa-configurator.js   ← configurator JS, page-level embed on product pages only
├── docs/
│   └── architecture.md          ← this file — read at the start of every Claude Code session
├── .gitignore
├── .prettierrc
└── README.md
```

---

## Delivery Chain

```
VS Code (author) → GitHub (version + host) → jsDelivr (CDN) → Webflow (custom code)
```

### Webflow Custom Code — Sitewide (Site Settings only, no per-page embeds)

**Head tag:**
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/brendanjurich/objects-of-agency@v1.0.32/src/css/oa-styles.css">
```

**Before </body>:**
```html
<script src="https://cdn.jsdelivr.net/gh/brendanjurich/objects-of-agency@v1.0.32/src/js/oa-global.js"></script>
<script src="https://cdn.jsdelivr.net/gh/brendanjurich/objects-of-agency@v1.0.18/src/js/oa-configurator.js"></script>
```

`oa-configurator.js` is pinned separately at v1.0.18 for stability while `oa-global.js`
continues to iterate. Future: move to page-level embed on product pages only for performance.

**Current live tags:**
- `oa-styles.css` + `oa-global.js`: `v1.0.32`
- `oa-configurator.js`: `v1.0.18`

**Why tags, not `@main`:** jsDelivr caches branch URLs aggressively and purging is
unreliable. Tagged URLs are immutable and served immediately with no caching issues.

### jsDelivr Cache Purge

After tagging, purge to force CDN refresh:
```
https://purge.jsdelivr.net/gh/brendanjurich/objects-of-agency@vX.X.X/src/css/oa-styles.css
https://purge.jsdelivr.net/gh/brendanjurich/objects-of-agency@vX.X.X/src/js/oa-global.js
https://purge.jsdelivr.net/gh/brendanjurich/objects-of-agency@vX.X.X/src/js/oa-configurator.js
```

---

## Branching Strategy

| Branch | Purpose |
|---|---|
| `main` | Production — stable, what jsDelivr serves |
| `dev` | Active development — all changes made here first |
| `feature/configurator` | Isolated configurator work |

Rule: never commit directly to `main`. Work on `dev`, confirm working, merge to `main`.

---

## Deployment Workflow

```bash
# 1. Edit files in src/
# 2. Commit and tag
git add src/css/oa-styles.css  # (or relevant file — avoid git add . to prevent accidental commits)
git commit -m "type: description"
git tag v1.x.x
git push origin dev && git push origin v1.x.x

# 3. Purge jsDelivr cache (URLs above)
# 4. Update CDN URLs in Webflow Site Settings if tag changed
# 5. Publish Webflow site
```

### Commit Message Conventions

- `feat:` — new functionality
- `fix:` — bug fix
- `style:` — CSS-only changes
- `refactor:` — restructuring without behaviour change
- `docs:` — documentation only
- `wip:` — work in progress, not finished

### Known jsDelivr Gotcha
Rate-limits repos that push many tags quickly — new tags may 404 for hours.
Purge endpoint helps but isn't always instant.

---

## CMS Architecture

### Products Collection
| Field | Type | Notes |
|---|---|---|
| Name | Text | Product name |
| Base Price | Number | Starting price at smallest size |
| Has Size Config | Toggle | Conditional visibility — size card |
| Has Top Material | Toggle | Conditional visibility — top material card |
| Has Timber | Toggle | Conditional visibility — timber card |
| Has Anodised Finish | Toggle | Conditional visibility — anodised card |
| Has Static Info | Toggle | Conditional visibility — static info block (non-configured pieces) |

### Sizes Collection
| Field | Type | Notes |
|---|---|---|
| Name | Text | e.g. 600, 700, 800 |
| Price Modifier | Number | Upcharge added to base price |
| SVG Drawing | Image | Plan drawing for cascading slider |

### Materials & Finishes Collection
One collection handles all material types: top materials, timber legs, anodised finishes.
| Field | Type | Notes |
|---|---|---|
| Name | Text | Material name |
| Price Modifier | Number | Upcharge added to base price |
| Swatch Image | Image | Small swatch for radio selector |
| Slider Image | Image | Larger image for cascading slider |

---

## Configurator Architecture

### Product Page Template
One template handles all product types via conditional visibility on CMS toggle fields.
Cards in `config_wrap_right` show/hide based on their corresponding toggle.

### Page Structure (right column)
```
config_wrap_right
├── config_wrap_main
│   ├── config_wrap_title
│   ├── config_wrap_price
│   │   ├── config_price_prefix    ← static "From $" prefix, never touched by JS
│   │   ├── config_from_price      ← JS-controlled price display
│   │   └── config_base_price      ← hidden, CMS-bound number field (display:none)
│   └── config_wrap_description
├── config_size_wrap               ← conditional: Has Size Config
├── config_top_wrap                ← conditional: Has Top Material
├── config_timber_wrap             ← conditional: Has Timber
├── config_anodised_wrap           ← conditional: Has Anodised Finish
├── config_summary_wrap            ← always visible, shows current selections
└── config_static_wrap             ← conditional: Has Static Info (non-configured pieces)
```

### Pricing Model — Additive
```
Total Price = Base Price + Size Modifier + Material Modifier + Timber Modifier + Finish Modifier
```

**DOM elements for pricing JS:**
- `.config_base_price` — hidden text element, contains raw base price number from CMS
- `.config_from_price` — visible price display, updated by JS with formatted total
- `.config_price_prefix` — static "From $" prefix, never touched by JS
- `[data-price]` on each collection item — CMS-bound price modifier value

**Price formatting:** JS uses `Intl.NumberFormat` for comma separators, no currency symbol.
Display updates on every radio selection change across all four configurator cards.

### Summary Card
Sits below the last configurator card, above the price. Shows current selections.
Updates live on every radio change.

**DOM IDs on `config_summary_value` spans:**
- `#summary-size` — updated on Sizes change
- `#summary-top-material` — updated on Top-Material change
- `#summary-timber` — updated on Timber change
- `#summary-anodising` — updated on Anodised-Finish change

Default value in each span: `—` (em dash). JS replaces text content on every radio change.

### Radio Selectors
Each configurator card uses a Lumos `form_ui` radio component inside a CMS collection list.
The collection item wrapper carries `data-price` bound to the Price Modifier CMS field.

**Radio input names:**
- Size: `name="Sizes"`
- Top Material: `name="Top-Material"`
- Timber: `name="Timber"`
- Anodised Finish: `name="Anodised-Finish"`

### Size Card — Cascading Slider
The size card includes a cascading slider showing SVG plan drawings per size.
Slider and radio buttons are synced — selecting either updates the other.
JS function: `initCascadingSlider()` in `oa-configurator.js`
Slider targets: `[data-cascading-slider-wrap]`, `[data-cascading-viewport]`, `[data-cascading-slide]`

### Image DOM Swap (pending implementation)
Strategy: pre-rendered KeyShot images swapped on material selection change.
Implementation: to be designed — see `feature/configurator` branch.

---

## oa-global.js — Sitewide Only

Loads on every page. Must contain ONLY what every page needs.
No configurator logic, no product-page-specific code.

```
1. REGISTER GSAP PLUGINS
2. CUSTOM EASES
3. SLIDESHOW          — initSlideShow()
4. LOADER             — initLogoRevealLoader(), revealAfterLoader()
5. SAFARI NAV FIX     — initNavSafariFix()
6. INIT ON DOM READY  — initLogoRevealLoader, initSlideShow, initNavSafariFix only
```

### Loader Logic — Entrance + Exit Split

**Entrance** — plays immediately on `DOMContentLoaded` (1.5s):
- Progress bar fills (scaleX 0 → 1)
- Logo reveals (clipPath)

**Exit** — gated on `Promise.all([minDelay, pageReady])`:
- `minDelay`: 1.5s minimum branding moment
- `pageReady`: resolves on `document.readyState === 'complete'` or `window.load`
- Fast connections exit at 1.5s; slow connections hold until assets are genuinely ready

Pages without `[data-load-wrap]` call `revealAfterLoader()` immediately.
Pages with `[data-load-wrap]` but no `[data-load-progress]` also call it immediately.

### revealAfterLoader()
```javascript
function revealAfterLoader() {
  document.documentElement.classList.add('w-mod-ix3');      // satisfies IX2 guard
  document.documentElement.classList.add('loader-complete'); // triggers CSS nav reveal
}
```

### Nav Visibility — CSS Class Toggle Only

Nav visibility is controlled entirely by CSS class toggle on `<html>`. **Never use GSAP on the nav.**

**Why:** GSAP `autoAlpha` sets `opacity` and `visibility` as inline styles, creating a
stacking context that breaks `mix-blend-mode: difference` on the logo and hamburger.

No Webflow IX2 interaction on the nav — removed entirely due to conflict with loader
timing and mix-blend-mode.

```css
html.w-mod-js:not(.wf-design-mode):not(.loader-complete) .nav_component {
  opacity: 0;
}
html.w-mod-js:not(.wf-design-mode).loader-complete .nav_component {
  opacity: 1;
  visibility: visible; /* overrides any residual inline visibility:hidden */
}
html.w-mod-js:not(.wf-design-mode) .nav_component {
  transition: opacity 0.25s;
}
```

---

## oa-configurator.js — Product Pages Only

Loads only on product pages. Has its own `DOMContentLoaded` listener — does NOT share
the one in `oa-global.js`. Must never contain sitewide logic.

```
1. CASCADING SLIDER      — initCascadingSlider()
2. FIX DUPLICATE IDs     — fixRadioIds()
3. PRICING ENGINE        — initPricingEngine()
4. SUMMARY UPDATER       — initSummaryUpdater()
5. IMAGE DOM SWAP        — initImageSwap() (pending)
6. QUOTE FORM            — initQuoteForm() (pending)
7. INIT ON DOM READY     — all configurator functions
```

### fixRadioIds() — targets
```javascript
input[name="Sizes"]           → id: 'size-' + index
input[name="Top-Material"]    → id: 'top-material-' + index
input[name="Timber"]          → id: 'timber-' + index
input[name="Anodised-Finish"] → id: 'anodised-' + index
```

---

## Hero — Architecture

### height: 100svh (never dvh)

`.crisp-header` uses `height: 100svh`.

`dvh` changes as browser chrome shows/hides on scroll, causing the entire page layout
to shift. `svh` is static — never changes, no layout shift on scroll.

### min-height: 100% override on __content

`.crisp-header__content` overridden to `min-height: 100%` in `oa-styles.css`.

Webflow's generated CSS sets `min-height: 100svh` on `__content`. On Chrome iOS,
`svh` is calculated without subtracting the bottom tab bar, so content expands beyond
the parent's `overflow: hidden` boundary — clipping the bottom of the hero (e.g. swatch
strip). `min-height: 100%` constrains it to the parent.

---

## Key Decisions

### jsDelivr over Slater
Free, GitHub-backed CDN. No vendor dependency or subscription risk.
Repo must be public for jsDelivr to serve files.

### GitHub repo is public
No security risk — contains only frontend CSS/JS visible in DevTools anyway.
Rule: never commit API keys, credentials, or `.env` files.

### Custom CSS in oa-styles.css only
Never write custom CSS inside Lumos embeds — wiped on Lumos updates.
`oa-styles.css` is the single source of truth for all custom styles.

### Additive pricing model
Base Price (Products CMS) + Price Modifier per selection (Sizes + Materials & Finishes CMS).
JS reads raw numbers from DOM, formats with `Intl.NumberFormat`, updates display.

### Quote-based flow (no Webflow Ecommerce)
Configurator captures selections → quote request form → deposit payment via Stripe
payment link. No cart, no checkout.

### One product template with conditional visibility
All product types use one CMS template. Cards show/hide via CMS toggle fields.
Non-configured pieces use `config_static_wrap` instead of interactive cards.

---

## Known Gotchas

- **jsDelivr rate limiting** — pushing many tags quickly may cause 404s for hours. Purge helps but isn't always instant.
- **Webflow IX2 guard** — hides elements with `visibility: hidden !important` until `w-mod-ix3` is on `<html>`. `revealAfterLoader()` adds this.
- **GSAP autoAlpha on nav** — NEVER use. Leaves inline `visibility` that breaks `mix-blend-mode` and cannot be overridden by CSS without `!important`.
- **Lumos embed CSS** — any CSS written inside Lumos embeds is wiped on Lumos updates. All custom CSS lives in `oa-styles.css` only.
- **dvh on hero** — causes scroll layout shift on mobile. Always use `svh`.

---

## Security Rules

Never commit to this repo:
- API keys or tokens
- Webflow API credentials
- `.env` files of any kind
- Payment or CRM integration secrets

`.gitignore` includes: `.DS_Store`, `node_modules/`, `.env`, `*.env`, `.env.local`

---

*Last updated: merged Claude Code + Claude chat session context. Current tags:
`oa-global.js` + `oa-styles.css` @ `v1.0.32`, `oa-configurator.js` @ `v1.0.18`.*
