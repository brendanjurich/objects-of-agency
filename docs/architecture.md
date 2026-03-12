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

### Webflow Custom Code — Sitewide

**Head tag:**
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/brendanjurich/objects-of-agency@main/src/css/oa-styles.css">
```

**Before </body>:**
```html
<script src="https://cdn.jsdelivr.net/gh/brendanjurich/objects-of-agency@main/src/js/oa-global.js"></script>
```

### Webflow Custom Code — Product Pages Only

`oa-configurator.js` is added at page level on product pages, not sitewide.
URL pattern when ready:
```html
<script src="https://cdn.jsdelivr.net/gh/brendanjurich/objects-of-agency@main/src/js/oa-configurator.js"></script>
```

---

## Branching Strategy

| Branch | Purpose |
|---|---|
| `main` | Production — stable, what jsDelivr serves |
| `dev` | Active development — all changes made here first |
| `feature/configurator` | Isolated configurator work |

Rule: never commit experimental work directly to `main`. Work on `dev`, confirm
it works on the live site, then merge to `main`.

---

## Daily Workflow

1. Make changes in VS Code
2. `git add .`
3. `git commit -m "type: description"`
4. `git push`
5. Purge jsDelivr cache (CSS and/or JS as needed)
6. Republish Webflow
7. Check browser console — confirm clean

### jsDelivr Cache Purge URLs

```
https://purge.jsdelivr.net/gh/brendanjurich/objects-of-agency@main/src/css/oa-styles.css
https://purge.jsdelivr.net/gh/brendanjurich/objects-of-agency@main/src/js/oa-global.js
```

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

## Configurator Scope (ViewFinder Series)

Products: coffee table, side table, console table, meeting table.
Flow: quote-based (not add-to-cart).
Image strategy: DOM swap of pre-rendered KeyShot images per material variant.
Material variants include: top material, timber, anodised finish, size.

---

## Security Rules

Never commit to this repo:
- API keys or tokens
- Webflow API credentials
- `.env` files of any kind
- Payment or CRM integration secrets

`.gitignore` includes: `.DS_Store`, `node_modules/`, `.env`, `*.env`, `.env.local`

---

*Last updated: project setup session — VS Code, GitHub, jsDelivr chain established.*