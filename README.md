# Objects of Agency

Custom JS/CSS for the Objects of Agency Webflow site (staging:
`oa-v5.webflow.io`). Webflow loads these files from this repo over the jsDelivr
CDN at pinned release tags; the code here augments the Webflow build with the
homepage hero carousels, the global loader/nav/slideshow, the product
configurator, and the All Products filter.

## Layout

- `src/js/`, `src/css/` — the source served to Webflow (see `CLAUDE.md` for the
  per-file purpose and load order). Only `oa-homepage.js` is bundled (Rollup →
  `dist/`); the rest ship as-is.
- `docs/` — project documentation:
  - [`REMAINING.md`](docs/REMAINING.md) — launch checklist
  - [`DECISIONS.md`](docs/DECISIONS.md) — session decisions & gotchas (append-only)
  - [`REFERENCE.md`](docs/REFERENCE.md) — durable implementation patterns
  - [`contact-strategy.md`](docs/contact-strategy.md) — contact/intake architecture
- `graphify-out/` — knowledge graph of the codebase (gitignored; regenerate with
  `graphify .`).
- `.claude/` — project-scoped Claude config (skills, agents, permissions).

## Working on it

`CLAUDE.md` is the source of truth — build step, CDN deploy checklist, script
load order, Webflow rules, and dependency constraints. Active work happens on
`dev`; `main` is the release branch.
