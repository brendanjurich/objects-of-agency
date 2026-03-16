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

URLs use a git version tag (e.g. `v1.0.0`). Update the tag in Webflow on each release.

**Head tag:**
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/brendanjurich/objects-of-agency@v1.0.0/src/css/oa-styles.css">
```

**Before </body>:**
```html
<script src="https://cdn.jsdelivr.net/gh/brendanjurich/objects-of-agency@v1.0.0/src/js/oa-global.js"></script>
```

### Webflow Custom Code — Product Pages Only

`oa-configurator.js` is added at page level on product pages, not sitewide.
```html
<script src="https://cdn.jsdelivr.net/gh/brendanjurich/objects-of-agency@v1.0.0/src/js/oa-configurator.js"></script>
```

**Why tags, not `@main`:** jsDelivr caches branch URLs aggressively and purging is
unreliable. Tagged URLs are immutable and served immediately with no caching issues.

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
4. `git checkout main && git merge dev && git push origin main && git checkout dev`
5. `git tag v1.x.x && git push origin v1.x.x`
6. Update version tag in Webflow custom code (Site Settings → Custom Code)
7. Republish Webflow
8. Check browser console — confirm clean

### Commit Message Conventions

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