# Objects of Agency — Claude Context

> Source of truth for Claude Code. Loaded every session — keep it to durable
> rules and facts. One-off rationale belongs in `docs/DECISIONS.md`, not here.

## Project

Webflow site (staging: `oa-v5.webflow.io`) with custom JS/CSS served from this
repo via jsDelivr. Webflow loads tagged releases.

Repo: `brendanjurich/objects-of-agency` (public). **Never commit secrets, API
keys, tokens, or `.env` files.**

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
5. **Verify the tag URL returns `200` before updating Webflow.** A freshly pushed tag can hit jsDelivr before GitHub propagation, making jsDelivr cache a `404` ("Failed to fetch from GitHub") served as `text/plain` — the browser then **ORB-blocks** it (`net::ERR_BLOCKED_BY_ORB`) and the script silently never executes (e.g. loader hangs, CustomEase unregistered). This negative cache is **time-based and a purge won't always clear it** (can take up to ~1h). Check: `curl -sI "https://cdn.jsdelivr.net/gh/brendanjurich/objects-of-agency@v1.0.X/[path]"` → expect `200` + `application/javascript`/`text/css`, not `404`/`text/plain`. To unblock immediately, point Webflow at the **commit-SHA URL** (`@<full-sha>/[path]`) — immutable, resolves independently of the tag-ref cache, no purge needed; switch back to the tag once it returns `200`.
6. Update the URL(s) in Webflow → Site Settings → Custom Code (or page-level settings)
7. Force jsDelivr cache purge: `https://purge.jsdelivr.net/gh/brendanjurich/objects-of-agency@v1.0.X/[path]`

When presenting CDN updates after a tag, always show: **from `@v1.0.X` → to `@v1.0.Y`** for each changed file. Only the files that changed need their URL bumped; unchanged files can stay on their current tag.

---

## Branch Strategy

- `dev` — all active work
- `main` — release branch; merge dev → main after tagging

---

## Script Load Order & Placement (Webflow Custom Code)

**Head code:**
- `oa-styles.css` `<link>`

**Footer code (sitewide), in this order:**
1. `oa-global.js`
2. `hls.js` (npm, exact-pinned `@1.6.11`)
3. `oa-configurator.js`

`oa-global.js` **must** load before `oa-configurator.js` (both read `window.gsap`). GSAP and its plugins are injected by Webflow ahead of the footer code, so `window.gsap` is available when these run.

`oa-global.js` **must also load before `hls.js`** — load-bearing, do not reorder. `oa-global.js` runs the loader at execution (not on `DOMContentLoaded`), and `DOMContentLoaded` is held back until the ~157KB parser-blocking `hls.js` finishes (~17s on Slow 4G). Putting `hls.js` first delays the loader dismissal to ~21s. `oa-global.js` has no dependency on `hls.js`, so it is safe ahead of it; `oa-homepage.js`/`oa-configurator.js` (which read `window.Hls`) stay after it.

**Page-level embeds** (no dependency on the order above):
- `oa-homepage.js` — homepage
- `oa-all-products.js` + `oa-all-products.css` — /all-products

> Note: `oa-configurator.js` currently loads sitewide but is only needed on
> product pages. Scoping it to product pages would drop one script request on
> every other page (perf optimisation, not a blocker).

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
- Animation components are frequently sourced from **osmo.supply**: I paste the Webflow HTML, Claude Code adapts the JS with my tweaks

---

## Dependencies & Constraints

### GSAP (managed by Webflow)

GSAP is provided by Webflow's **native GSAP integration** (Site Settings → GSAP), not a CDN `<script>`. There is no GSAP URL in custom code, and GSAP is not in `package.json`.

- GSAP Core: **enabled**.
- Enabled plugins — code depends on these; do not disable without checking usage:
  `Flip`, `ScrollTrigger`, `SplitText`, `Inertia`, `Observer`, `ScrollSmoother`,
  `ScrollTo`, `Text`, `CustomEase`, `CustomBounce`, `CustomWiggle`, `EasePack`.
- `oa-global.js` registers `CustomEase` at top-level execution — **CustomEase must stay enabled.**
- Webflow auto-updates GSAP (and plugins) to the latest version on **every publish**. The version cannot be pinned. If a publish coincides with a GSAP release, re-verify all animations: loader, nav, slideshow, configurator cascading slider.

### Lumos

Version: **v2.2.1**. Controlled in Webflow, not this repo.

`oa-global.js` patches Lumos-initialized Swipers at `window.load` (search the source for `is-slider-transitioning`). A Lumos update that changes Swiper init timing or class names requires re-testing the speed patch and the `is-slider-transitioning` body-class behaviour.

### Finsweet Attributes (listnest)

```html
<script defer src="https://cdn.jsdelivr.net/npm/@finsweet/attributes-listnest@1/listnest.js"></script>
```

Major-pinned (`@1`). `oa-styles.css` assumes Finsweet injects swatch dots (search for the swatch-dot rules; add a `/* FINSWEET: swatch dots */` marker if one isn't present). A Finsweet major version bump requires re-testing swatch display on the All Products page.

### hls.js

```html
<script src="https://cdn.jsdelivr.net/npm/hls.js@1.6.11"></script>
```

Loaded first in the sitewide footer. **Exact-pinned.** Used for HLS video playback. Bumping the version requires re-testing video.

### Swiper

v12. Used for the homepage hero carousels. ES6 imports bundled into `dist/oa-homepage.js` via Rollup (see Key Patterns for the custom class-name convention).

### Greeting Animation

The greeting rotation in `oa-styles.css` is hardcoded for exactly **9 greetings** (`nth-child` 1–9, 36s total cycle). It is **not data-driven**. If the CMS greeting count changes, the keyframes must be updated manually (search for the greeting `nth-child` rules; add a `/* GREETINGS: hardcoded 9-item, 36s cycle */` marker).

### Dist File (build artifact)

`dist/oa-homepage.js` is a build artifact tracked in git. Before creating a release tag, always run `npm run build` and verify `dist/oa-homepage.js` was regenerated from the current `src/js/oa-homepage.js`. A tag pushed without rebuilding serves a stale bundle from the CDN.

---

## Scope

Until launch, stay focused on finishing the site. Out of scope for now: business
strategy, marketing, and new features — capture stray ideas elsewhere rather than
acting on them mid-build.

---

## How to Work With Me

- I'm the lead creative director and designer; I own design direction.
- Push back on design decisions that stray from convention or best practice when they'd hurt the goal — a premium, high-performing, beautifully designed site that designers love. I value your opinion here.
- You're my technical lead and engineer. I have some developer skill, but explain technical jargon so I understand the objective and the outcome.
- Use direct shorthand. Give tightly constrained recommendations over option lists. Surface trade-offs, then recommend one path.

### Model split

- **Plan in Opus, implement in Sonnet.** In plan mode, delegate the design work to a **Plan subagent pinned to `model="opus"`**; carry out the implementation with Sonnet. This is a deliberate preference, not the runtime default — follow it every session unless I say otherwise for a given task. (Note: this is an instruction Claude follows, not a hard runtime switch — the only deterministic piece is the pinned subagent model.)

---

## Engineering Conduct

Behavioural guardrails for Claude Code on this repo. Bias toward caution over speed; use judgment on trivial changes.

- **Think before coding.** State assumptions. If a *requirement* is genuinely ambiguous, name the ambiguity and ask — don't guess silently. (For *approach*, still recommend one path with trade-offs, not a menu.)
- **Simplicity first.** Write the minimum that solves the problem. No speculative features, no abstractions for single-use code, no configurability or error handling that wasn't asked for. If it could be half the lines, rewrite it.
- **Surgical changes.** Touch only what the task requires. Don't "improve," refactor, or reformat adjacent working code; match the existing style even if you'd do it differently. Remove only the imports/variables *your own* change orphaned — flag pre-existing dead code, don't delete it. Every changed line should trace to the request. *Especially here: jsDelivr serves these files by path and Webflow pins exact tags, so an unrequested edit can ship straight to the live site.*
- **Verify before "done."** Turn the task into a success criterion and confirm it's met before declaring completion. Verification on this project is visual/behavioural on staging or the published site, plus `npm run build` and the deploy checklist for shipped changes — there is no test suite to lean on.
