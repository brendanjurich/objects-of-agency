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
| `src/js/oa-homepage.js` | Homepage hero carousels (hero_feed_top, hero_feed_right) + Bunny background video. Swiper via `window.oaLoadSwiper` (oa-slider.js); injects hls.js on demand (`HLS_VERSION` constant, exact-pinned). Dispatches `oa:hero-media-ready` for the loader gate. | Raw file → CDN |
| `src/js/oa-global.js` | GSAP fail-open guard, loader, page transitions, slideshow (data-slideshow), nav animations, custom eases, Lenis smooth scroll, Email Direct mailto assembly (`data-oa-email`). | Raw file → CDN |
| `src/js/oa-slider.js` | Lumos slider init (product + homepage menu). Loads the Swiper 12.2.0 bundle from jsDelivr when a slider exists and exposes the loader as `window.oaLoadSwiper` — the **single Swiper source sitewide**. | Raw file → CDN |
| `src/js/oa-configurator.js` | Cascading slider (product carousels with GSAP, touch/click), pricing engine, summary. | Raw file → CDN |
| `src/js/oa-all-products.js` | Osmo multi-match filter for /all-products. Reads `?filter=` URL param via `paint()` on init. | Raw file → CDN |
| `src/css/oa-styles.css` | Global styles, FOUC prevention, nav, hero carousel. | Raw file → CDN |
| `src/css/oa-all-products.css` | /all-products page styles. | Raw file → CDN |
| `src/js/oa-infinite-grid.js` | Osmo infinite draggable grid (embedded variant) for product pages. Drag + idle drift via GSAP Observer; reuses `window.gsap`/`window.Observer` (no CDN GSAP). | Raw file → CDN |
| `src/css/oa-infinite-grid.css` | Infinite grid behavioural glue (`touch-action`, status states, Designer preview). Sizing/radius/height live in the Designer. | Raw file → CDN |
| `src/js/oa-about.js` | /about intro: video beat → blur crossfade → ABOUT scrambles in (blur and title start together and resolve together). Gates on page reveal + video `canplay`, each raced against a cap. Needs **ScrambleTextPlugin**, loaded per-page (see Script Load Order); degrades to a plain fade without it. Beat timings are Designer knobs (`data-oa_about_intro-*`). No paired CSS — nothing it needs is inexpressible in the Designer. | Raw file → CDN |

**There is no build step.** Every file is served raw via jsDelivr. (The old
Rollup → `dist/oa-homepage.js` bundle was removed at v1.0.131 — the homepage
reuses the sitewide Swiper via `window.oaLoadSwiper` instead of bundling its own.)

---

## CDN Deployment Workflow

1. Make changes and commit to `dev`
2. Tag the commit: `git tag v1.0.X && git push origin v1.0.X`
3. jsDelivr URL format:
   ```
   https://cdn.jsdelivr.net/gh/brendanjurich/objects-of-agency@v1.0.X/src/js/oa-homepage.js
   https://cdn.jsdelivr.net/gh/brendanjurich/objects-of-agency@v1.0.X/src/css/oa-styles.css
   ```
4. **Verify the tag URL returns `200` before updating Webflow.** A freshly pushed tag can hit jsDelivr before GitHub propagation, making jsDelivr cache a `404` ("Failed to fetch from GitHub") served as `text/plain` — the browser then **ORB-blocks** it (`net::ERR_BLOCKED_BY_ORB`) and the script silently never executes (e.g. loader hangs, CustomEase unregistered). This negative cache is **time-based and a purge won't always clear it** (can take up to ~1h). Check: `curl -sI "https://cdn.jsdelivr.net/gh/brendanjurich/objects-of-agency@v1.0.X/[path]"` → expect `200` + `application/javascript`/`text/css`, not `404`/`text/plain`. To unblock immediately, point Webflow at the **commit-SHA URL** (`@<full-sha>/[path]`) — immutable, resolves independently of the tag-ref cache, no purge needed; switch back to the tag once it returns `200`.
5. Update the URL(s) in Webflow → Site Settings → Custom Code (or page-level settings)
6. Force jsDelivr cache purge: `https://purge.jsdelivr.net/gh/brendanjurich/objects-of-agency@v1.0.X/[path]`

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
2. `oa-slider.js`
3. `lenis` (npm, exact-pinned `@1.3.23` — JS + `lenis.css`)
4. `oa-configurator.js`

`oa-global.js` **must** load before `oa-configurator.js` (both read `window.gsap`). GSAP and its plugins are injected by Webflow ahead of the footer code, so `window.gsap` is available when these run.

`oa-slider.js` **must** load before any page-level embed that calls `window.oaLoadSwiper` (currently `oa-homepage.js`). Webflow appends page-level footer code after sitewide footer code, so this holds automatically — just never move `oa-slider.js` out of the sitewide footer.

**There is no `hls.js` footer script.** It was removed at v1.0.131: `oa-homepage.js` injects `hls.js` on demand (exact-pinned via its `HLS_VERSION` constant) only when a Bunny background player exists on the page. The old "oa-global.js before hls.js" ordering constraint is gone with it.

**Page-level embeds** (load after the sitewide footer):
- `oa-homepage.js` — homepage (needs `window.oaLoadSwiper` from `oa-slider.js`)
- `oa-all-products.js` + `oa-all-products.css` — /all-products
- `oa-infinite-grid.js` + `oa-infinite-grid.css` — product template (the grid section ships per-product via a CMS toggle; the script no-ops when it's absent)
- `oa-about.js` — /about. Its readiness gate is its own, not `oa-global.js`'s loader gate (/about carries no `[data-load-wrap]`). **Ordering constraint:** `ScrambleTextPlugin.min.js` must load before it. ScrambleText is not enabled in this site's GSAP integration (which ships core + ScrollTrigger + SplitText + CustomEase), so /about's page footer loads it from Webflow's own GSAP CDN at the matching version — `https://cdn.prod.website-files.com/gsap/<gsap-version>/ScrambleTextPlugin.min.js`. This is a plugin registering against the existing core, **not** a second `window.gsap`, so it does not break the no-CDN-GSAP rule. If Webflow's GSAP version is ever bumped, bump this path with it.

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
- Animation components are frequently sourced from **osmo.supply**: I paste the Webflow HTML, Claude Code adapts the JS with my tweaks — procedure in `.claude/skills/osmo-in/`

---

## Dependencies & Constraints

### GSAP (managed by Webflow)

GSAP is provided by Webflow's **native GSAP integration** (Site Settings → GSAP), not a CDN `<script>`. There is no GSAP URL in custom code, and GSAP is not in `package.json`.

- GSAP Core: **enabled**.
- Enabled plugins — code depends on these; do not disable without checking usage:
  `Flip`, `ScrollTrigger`, `SplitText`, `Inertia`, `Observer`, `ScrollSmoother`,
  `ScrollTo`, `Text`, `CustomEase`, `CustomBounce`, `CustomWiggle`, `EasePack`.
- `oa-global.js` registers `CustomEase` at top-level execution — **CustomEase must stay enabled.**
- **Third-party / Osmo GSAP components: reuse `window.gsap` and `window.Observer` — never load their CDN GSAP.** Webflow already provides both (Observer ships via ScrollTrigger). A second CDN `gsap` makes a duplicate `window.gsap` that can clobber the top-level `CustomEase` registration above. See `oa-infinite-grid.js` and docs/DECISIONS.md (2026-06-22).
- Webflow auto-updates GSAP (and plugins) to the latest version on **every publish**. The version cannot be pinned. If a publish coincides with a GSAP release, re-verify all animations: loader, nav, slideshow, configurator cascading slider.

### Lumos

Version: **v2.2.1** — a **build-time clone**, baked into the Webflow project at the version downloaded. **There is no Lumos runtime**: nothing loads from a Lumos CDN, and its CSS/classes are frozen in the published file. Unlike GSAP above (which Webflow genuinely auto-updates on publish), Lumos does **not** auto-update — Timothy Ricks cannot change anything already in your project. The *only* way Lumos changes the live site is if **you** re-clone / re-import its components in the Designer yourself.

**`oa-slider.js` owns the slider init outright** (since v1.0.135). Lumos's inline init embeds were deleted in the Designer and the two old `oa-global.js` `window.load` patches removed with them — `oa-global.js` no longer touches sliders. Per-slider config is read from Designer data-attributes (`data-speed`, `data-speed-touch`, `data-loop`, `data-parallax`, `data-slides-per-view`); `oa-slider.js` is the source of truth for the defaults. Re-test slider behaviour only if **you** re-import the Lumos sliders and their DOM or class names change — *not* on every publish.

**Lumos ≠ Osmo — never conflate.**

- **Lumos** (v2.2.1, Timothy Ricks' Webflow framework) owns the build system: the `u-` utility classes, the `--_…---` / `--site--` variables, the type clamps / root font-size, and the **sliders** (`[data-slider='component']`, `.slider_element` / `.slider_list`, Swiper 8 — "Lumos-initialized Swipers"). CSS written inside Lumos embeds is wiped if you re-clone/re-import the embed.
- **Osmo** (osmo.supply) is a vault of individual components I paste in and adapt — e.g. the Glass CTA (Button 097/046 + Glass Effect), the all-products multi-match filter, and the easing curve now named **`--ease-oa`** (Osmo-derived, renamed to signal it's ours). Osmo does **not** own the sliders; only the slider *easing* is Osmo-derived.

The product/home sliders are **Lumos**. Don't call them Osmo.

### Finsweet Attributes (listnest)

```html
<script defer src="https://cdn.jsdelivr.net/npm/@finsweet/attributes-listnest@1/listnest.js"></script>
```

Major-pinned (`@1`). `oa-styles.css` assumes Finsweet injects swatch dots (search for the swatch-dot rules; add a `/* FINSWEET: swatch dots */` marker if one isn't present). A Finsweet major version bump requires re-testing swatch display on the All Products page.

### Lenis

```html
<script src="https://cdn.jsdelivr.net/npm/lenis@1.3.23/dist/lenis.min.js"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/lenis@1.3.23/dist/lenis.css">
```

Smooth scroll, sitewide footer. **Exact-pinned.** Load-bearing beyond scrolling:
`oa-global.js` uses it for the loader scroll-lock, the nav-menu scroll-lock, the
page-transition leave handler, and the bfcache restore (`pageshow.persisted` must
restart it — see DECISIONS.md 2026-06). `initSmoothScroll()` fails open if the
CDN is down (native scroll). Bumping the version requires re-testing: scroll
feel, menu open/close lock, page transitions, back/forward restore.

### hls.js

**Not a footer script** (removed at v1.0.131). Injected on demand by
`oa-homepage.js` (`loadHls()`, exact-pinned via its `HLS_VERSION` constant —
currently `1.6.11`) only on pages with a `[data-bunny-background-init]` player.
Bumping the version requires re-testing video.

### Swiper

**One source sitewide:** `oa-slider.js` injects the `swiper-bundle@12.2.0` JS+CSS
from jsDelivr (version constant at the top of that file) and exposes the loader as
`window.oaLoadSwiper`. The homepage hero carousels consume the same loader —
never re-introduce a second Swiper copy or version. Bumping the version requires
re-testing every slider: product, homepage menu, both hero feeds. (See Key
Patterns for the custom class-name convention.)

### Greeting Animation

The greeting rotation in `oa-styles.css` is hardcoded for exactly **9 greetings** (`nth-child` 1–9, 36s total cycle). It is **not data-driven**. If the CMS greeting count changes, the keyframes must be updated manually (search for the greeting `nth-child` rules; add a `/* GREETINGS: hardcoded 9-item, 36s cycle */` marker).

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

---

## Engineering Conduct

Behavioural guardrails for Claude Code on this repo. Bias toward caution over speed; use judgment on trivial changes.

- **Think before coding.** State assumptions. If a *requirement* is genuinely ambiguous, name the ambiguity and ask — don't guess silently. (For *approach*, still recommend one path with trade-offs, not a menu.)
- **Simplicity first.** Write the minimum that solves the problem. No speculative features, no abstractions for single-use code, no configurability or error handling that wasn't asked for. If it could be half the lines, rewrite it.
- **Surgical changes.** Touch only what the task requires. Don't "improve," refactor, or reformat adjacent working code; match the existing style even if you'd do it differently. Remove only the imports/variables *your own* change orphaned — flag pre-existing dead code, don't delete it. Every changed line should trace to the request. *Especially here: jsDelivr serves these files by path and Webflow pins exact tags, so an unrequested edit can ship straight to the live site.*
- **Verify before "done."** Turn the task into a success criterion and confirm it's met before declaring completion. Verification on this project is visual/behavioural on staging or the published site, plus the deploy checklist for shipped changes — there is no test suite to lean on.
