# Objects of Agency — Architecture & Decisions Log

## Project Overview

Premium furniture e-commerce site. Designer-led build with a non-developer owner.
Engineering lead: Claude Code.

---

## Tech Stack

| Layer | Tool | Role |
|---|---|---|
| CMS & Layout | Webflow | Page structure, CMS, hosting |
| Animations | GSAP + CustomEase | Slideshow, loader, cascading slider |
| Components | Osmo.supply | Selected UI components |
| CSS Authoring | VS Code | Master stylesheet |
| JS Authoring | VS Code | Global and page-level scripts |
| Version Control | GitHub | Source of truth for all code |
| CDN Delivery | jsDelivr | Serves CSS/JS to Webflow from GitHub |
| IDE | VS Code + Claude Code | Authoring and engineering lead |

**Slater: removed from stack.** Originally used for CSS/JS delivery. Replaced by
jsDelivr to eliminate vendor dependency and subscription risk on a live production site.

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
│   └── architecture.md          ← this file
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

URLs use a git version tag (e.g. `v1.0.32`). Update the tag in Webflow on each release.

**Head tag:**
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/brendanjurich/objects-of-agency@v1.0.32/src/css/oa-styles.css">
```

**Before </body>:**
```html
<script src="https://cdn.jsdelivr.net/gh/brendanjurich/objects-of-agency@v1.0.32/src/js/oa-global.js"></script>
<script src="https://cdn.jsdelivr.net/gh/brendanjurich/objects-of-agency@v1.0.18/src/js/oa-configurator.js"></script>
```

No other custom code embeds — everything lives in the CDN files.

**Why tags, not `@main`:** jsDelivr caches branch URLs aggressively and purging is
unreliable. Tagged URLs are immutable and served immediately with no caching issues.

### jsDelivr Cache Purge

After tagging, purge to force CDN refresh:
```
https://purge.jsdelivr.net/gh/brendanjurich/objects-of-agency@vX.X.X/src/css/oa-styles.css
https://purge.jsdelivr.net/gh/brendanjurich/objects-of-agency@vX.X.X/src/js/oa-global.js
```

**Known gotcha:** jsDelivr rate-limits repos that push many tags quickly. New tags may
return 404 for several hours. Purge helps but is not always instant.

---

## Branching Strategy

| Branch | Purpose |
|---|---|
| `main` | Production — stable, source for all releases |
| `dev` | Active development — all changes made here first |

Rule: never commit experimental work directly to `main`. Work on `dev`, confirm
it works, then merge to `main` and cut a release tag.

---

## Release Workflow

1. Make changes in VS Code on `dev`
2. `git add src/css/oa-styles.css` (or relevant file)
3. `git commit -m "type: description"`
4. `git tag vX.X.X && git push origin dev && git push origin vX.X.X`
5. Purge jsDelivr cache URLs (above)
6. Update version tag in Webflow Site Settings → Custom Code
7. Republish Webflow
8. Check browser console — confirm clean

### Commit Message Conventions

- `feat:` — new functionality
- `fix:` — bug fix
- `style:` — CSS-only changes
- `refactor:` — restructuring existing code without behaviour change
- `wip:` — work in progress, not finished

---

## Key Decisions

### jsDelivr over Slater for CDN
**Decision:** Use jsDelivr (free, GitHub-backed CDN) instead of Slater's paid GitHub
integration for code delivery.
**Reason:** Eliminates vendor dependency. Slater subscription ending would break CDN
links on a live production site. jsDelivr serves directly from the GitHub repo with
no ongoing cost or vendor risk.

### GitHub repo is public
**Decision:** `objects-of-agency` repo is public.
**Reason:** Required for jsDelivr to serve files. No security risk — repo contains
only frontend CSS and JS which is already visible in browser DevTools on the live site.
**Rule:** Never commit API keys, credentials, or `.env` files to this repo.

### Configurator JS is page-level only
**Decision:** `oa-configurator.js` loads only on product pages via Webflow page-level
custom code, not sitewide.
**Reason:** Performance. Configurator logic is heavy and irrelevant on non-product pages.

### Static SVG size drawings
**Decision:** Size drawings for the ViewFinder Series are hardcoded via the SVG Import
app in Webflow Designer rather than driven through CMS fields.
**Reason:** CMS-driven SVGs add complexity without benefit — these drawings are fixed
per variant and do not change dynamically.

### Custom CSS lives in oa-styles.css, not Lumos embeds
**Decision:** All custom CSS (tap highlight removal, unchecked swatch states, etc.)
lives in `oa-styles.css` under clearly marked sections.
**Reason:** Lumos embed content is wiped on Lumos updates. Anything written there
is unrecoverable. The CSS master file is the single source of truth.

---

## Nav Visibility — Architecture

### Approach: CSS class toggle, no GSAP on nav

The nav is hidden on page load and revealed after the loader completes via a CSS class
toggle on `<html>`. No GSAP inline styles are ever applied to the nav.

**Why no GSAP:** GSAP `autoAlpha` sets `opacity` and `visibility` as inline styles,
which creates a stacking context. This breaks `mix-blend-mode: difference` on the
logo and hamburger icon.

**Why no Webflow IX2 interaction on nav:** A page-load interaction previously animated
the nav in but conflicted with loader timing and broke mix-blend-mode. Removed entirely.

### CSS (in oa-styles.css)

```css
/* Hidden until loader completes */
html.w-mod-js:not(.wf-design-mode):not(.loader-complete) .nav_component {
  opacity: 0;
}
/* Revealed after loader */
html.w-mod-js:not(.wf-design-mode).loader-complete .nav_component {
  opacity: 1;
  visibility: visible;  /* overrides any GSAP inline visibility:hidden */
}
html.w-mod-js:not(.wf-design-mode) .nav_component {
  transition: opacity 0.25s;
}
```

### JS trigger (in oa-global.js)

```javascript
function revealAfterLoader() {
  document.documentElement.classList.add('w-mod-ix3');     // satisfies IX2 guard
  document.documentElement.classList.add('loader-complete'); // triggers CSS reveal
}
```

`revealAfterLoader()` is called:
- At the end of the loader exit animation (pages with full loader)
- Immediately on pages with `[data-load-wrap]` but no `[data-load-progress]`
- Immediately on pages with no `[data-load-wrap]` at all (e.g. product pages)

---

## Loader — Architecture

### Approach: entrance + exit split with Promise.all gate

The loader animation is split into two phases:

**Entrance** — plays immediately on `DOMContentLoaded` (1.5s):
- Progress bar fills (scaleX 0 → 1)
- Logo reveals (clipPath)

**Exit** — gated on `Promise.all([minDelay, pageReady])`:
- `minDelay`: 1.5s minimum branding moment
- `pageReady`: resolves when `document.readyState === 'complete'` or `window.load` fires
- Whichever takes longer wins — fast connections exit at 1.5s, slow connections wait
  until assets are genuinely ready

**Why:** The old loader was a fixed ~3.7s timer with no connection to actual asset
readiness. Fast connections waited unnecessarily; slow connections got no real benefit.
The Promise.all approach makes the loader functional while preserving the branding moment.

### The loader is decorative on fast connections, functional on slow ones.

---

## Hero — Architecture

### height: 100svh (not dvh)

`.crisp-header` uses `height: 100svh`.

**Why svh not dvh:** `dvh` (dynamic viewport height) changes as browser chrome
(address bar, tab bar) shows and hides on scroll, causing the entire page layout
to shift. `svh` (small viewport height) is static — it never changes, so there
is no layout shift on scroll.

### min-height: 100% override on __content

`.crisp-header__content` is set to `min-height: 100%` in oa-styles.css.

**Why:** Webflow's generated CSS sets `min-height: 100svh` on `__content`. On
Chrome iOS, `svh` is calculated without subtracting the bottom tab bar, so
`100svh` on `__content` exceeds the parent's `height: 100svh`, and content
overflows the parent's `overflow: hidden` boundary — clipping the bottom of the
hero (e.g. swatch strip). Overriding to `min-height: 100%` constrains content
to the parent.

---

## Configurator Scope (ViewFinder Series)

Products: coffee table, side table, console table, meeting table.
Flow: quote-based (not add-to-cart).
Image strategy: DOM swap of pre-rendered KeyShot images per material variant.
Material variants include: top material, timber, anodised finish, size.

---

## Configurator DOM Contract (Product Pages)

### Pricing

| Class | Role |
|---|---|
| `config_base_price` | Hidden element — holds the raw base price number (e.g. `1999`) |
| `config_from_price` | Visible display — shows the static base price |
| `configure_price` | Visible display — shows the calculated price (base + option modifiers) |

Option price modifiers are read from the nearest ancestor with a `data-price` attribute on each checked radio input.

### Summary Card — DOM IDs

| ID | Updated on |
|---|---|
| `summary-size` | Size selection |
| `summary-top-material` | Top material selection |
| `summary-timber` | Timber selection |
| `summary-anodising` | Anodised finish selection |

Default value in each span: `—` (em dash). JS replaces text content on every radio change.

---

## Security Rules

Never commit to this repo:
- API keys or tokens
- Webflow API credentials
- `.env` files of any kind
- Payment or CRM integration secrets

`.gitignore` includes: `.DS_Store`, `node_modules/`, `.env`, `*.env`, `.env.local`

---

*Last updated: nav/loader architecture session — CSS class toggle nav reveal, Promise.all loader, svh hero fix, Chrome iOS clipping fix.*
