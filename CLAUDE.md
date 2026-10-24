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
| `src/js/oa-homepage.js` | Homepage hero carousels (hero_feed_top, hero_feed_right) + Bunny background video. Swiper via `window.oaLoadSwiper` (oa-slider.js); picks the HEVC or H.264 encode via `canPlayType` (`HEVC_CODEC` constant, pinned to the encode). Dispatches `oa:hero-media-ready` for the loader gate. | Raw file → CDN |
| `src/js/oa-global.js` | GSAP fail-open guard, loader, page transitions, slideshow (data-slideshow), nav animations, custom eases, Lenis smooth scroll, Email Direct mailto assembly (`data-oa-email`), nav search dropdown (`initNavSearch`: focus the input on open, drop `aria-haspopup`). | Raw file → CDN |
| `src/js/oa-slider.js` | Lumos slider init (product + homepage menu). Loads the Swiper 12.2.0 bundle from jsDelivr when a slider exists and exposes the loader as `window.oaLoadSwiper` — the **single Swiper source sitewide**. | Raw file → CDN |
| `src/js/oa-configurator.js` | Cascading slider, pricing engine, summary, `?cfg=` restore (read through `window.oaSaved.parseCfg`; sets radios before the slider starts), sticky panel mask `[data-oa-stuck-mask]` (first child of `.config_wrap_left`; `.is-active` only while stuck — at rest it would cover the title). | Raw file → CDN |
| `src/js/oa-saved-items.js` | Saved Items: storage, nav badge, `/saved-items` list, Share and "Email me this list". Hooks and flows: file header. **Owns the saved configuration:** `oa-brief.js` and `oa-configurator.js` read it only through `window.oaSaved` (`current`, `forRequest`, `sameConfig`, `editHref`, `parseCfg`), never its storage keys or link formats — **swap all three together** (first tag after v1.0.249). Option-group order is the share-link index — **append-only**, here and in `items.ts` (`npm test` pins it). Its pre-hide in `oa-styles.css` holds until it adds `.oa-saved-ready` to `<html>` — **ship both on the same tag**. Click handlers are capture-phase so `oa-global.js`'s page-leave sees `defaultPrevented`. Never set the email modal's display (breaks `showModal()`). Prices never reach the server (W07). | Raw file → CDN |
| `src/js/oa-all-products.js` | Osmo multi-match filter for /all-products. Reads `?filter=` URL param via `paint()` on init. | Raw file → CDN |
| `src/js/oa-loader-line.js` | OA line loader on `[data-oa-loader="line"]`; knobs in the file. Never `vector-effect: non-scaling-stroke` — it breaks the `pathLength` dash. Path is `02-brand/oa-logo/clean-svg/oa-logo-line.svg` (command centre), verbatim. | Raw file → CDN |
| `src/js/oa-plus.js` | Rotating "+" icon on `[data-oa-plus]` (the element that turns — never `display:inline`). Triggers (hover, click, slide), scope and knobs: file header. Demo: `tools/oa-plus-demo.html`. | Raw file → CDN |
| `src/css/oa-styles.css` | Global styles, FOUC prevention (incl. the Saved Items pre-hide, released by `oa-saved-items.js`), the Saved Items spinner show state (`[data-oa-saved-busy]`), nav (the closed tablet/mobile nav's `difference` blend, with the Saved Items badge pre-inverted and hidden beside the hamburger while the menu is open), hero carousel and content group feeds, and the homepage hero's tablet styles ported to portrait 992–1134px (iPad Pro portrait; see DECISIONS.md). | Raw file → CDN |
| `src/css/oa-all-products.css` | /all-products page styles. | Raw file → CDN |
| `src/js/oa-infinite-grid.js` | Osmo infinite draggable grid (embedded variant) for product pages. Drag + idle drift via GSAP Observer; reuses `window.gsap`/`window.Observer` (no CDN GSAP). | Raw file → CDN |
| `src/css/oa-infinite-grid.css` | Infinite grid behavioural glue (`touch-action`, status states, Designer preview). Sizing/radius/height live in the Designer. | Raw file → CDN |
| `src/js/oa-intro.js` | Intro hero (/about): video beat → blur crossfade → ABOUT scrambles in. Needs **ScrambleTextPlugin** (Webflow GSAP integration); degrades to a fade. Markup from `• oa Intro Hero`; knobs `data-oa_intro_*` on its section root. The container is `pointer-events:none` — anything clickable in the slot must turn it back on. No paired CSS. | Raw file → CDN |
| `src/js/oa-content-group.js` | `oa Section Content Group` feeds (`.content_group_feed-images`, homepage + /contact): the hero feed's Swiper creative config, mirrored from `oa-homepage.js` — change one, change both. Autoplay holds until `oa:loader-complete`. Glue in `oa-styles.css`. | Raw file → CDN |
| `src/js/oa-whatsapp.js` | Osmo WhatsApp Modal in `oa Section Content Group` (homepage + /contact); hooks in the file header. Touch devices get the plain chat link, no card. Every href is the Business short link, set in the Designer — see `docs/contact-strategy.md`. | Raw file → CDN |
| `src/css/oa-whatsapp.css` | Behavioural glue for `oa-whatsapp.js`: the closed state, reduced motion. Card and button styling are Designer knobs. | Raw file → CDN |
| `src/js/oa-brief.js` | `/contact` brief step engine and piece drawer. No `<form>`: values post as JSON to the `brief-intake` Edge Function, which validates `items[]` in `items.ts` (any unknown key rejected — a price above all). Honeypot `[data-oa-brief-honeypot]` is **logged, never a drop** (autofill fills it whatever its name); Turnstile is the gate. Hooks, knobs, carry-over and Edit configuration: file header. Copy: `docs/brief-copy-deck.md`. | Raw file → CDN |
| `src/css/oa-brief.css` | Behavioural glue for the piece drawer: the `<dialog>` reset, level positioning, Done bar stacking, row hover/selected colours. Also the month select: arrow reset, and the open list's structure (`base-select`, desktop) — its look is an Embed on /contact. The canvas preview is a Designer Embed (source `tools/designer/oa-brief-preview.css`). Look and sizes are Designer knobs. | Raw file → CDN |
| `src/js/oa-cursor.js` | Osmo Dynamic Text Cursor (the `/contact` piece tags); hooks in the file header. The hover target is resolved by `elementFromPoint`, so rebuilt lists need no rebinding — the bubble **must** keep `pointer-events:none` or it hit-tests itself. Mouse-only. Paired glue in `oa-cursor.css`. | Raw file → CDN |
| `src/css/oa-cursor.css` | Glue for `oa-cursor.js`: fixed positioning, `[data-cursor-status]` states, touch/reduced-motion branches, canvas preview. The bubble's look is Designer knobs. | Raw file → CDN |
| `src/js/oa-legal-toc.js` | Legal pages' "On this page" index (Osmo TOC), folding into an accordion below Lumos's medium boundary; hooks and gotchas in the file header. Same-page anchor scrolling belongs to `initNavAnchorLinks` in `oa-global.js`. A link tap closes the accordion from a `window` capture click, never on `pointerdown`. | Raw file → CDN |
| `src/css/oa-legal-toc.css` | Glue for `oa-legal-toc.js`: heading `scroll-margin-top` (130px, matches `oa-all-products.css`), active state, accordion states inside `@container (width < 50em)`, back-to-top hidden state, canvas preview. Layout, type and colours are Designer knobs. | Raw file → CDN |
| `src/js/oa-text-reveal.js` | Headings and lead paragraphs blur in on scroll; opt in with `data-oa-reveal`, knobs `data-oa_reveal_*`. Needs **SplitText** + **ScrambleTextPlugin**; gated on `oa:page-revealed` + fonts. Splits `h1`–`h6`/`p` only: a **Text Block** is a bare `div`, never splits and pops at full opacity — give it the `p` tag or make it Rich Text. Pre-hide in `oa-styles.css`. | Raw file → CDN |

**There is no build step.** Every file is served raw via jsDelivr.

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

**Tags are immutable** — any change ships as a new tag. `.claude/hooks/guard_tags.py`
blocks moving, deleting or force-pushing a tag; it is registered in this repo's
`.claude/settings.json` and in the command centre's.

When presenting CDN updates after a tag, always show: **from `@v1.0.X` → to `@v1.0.Y`** for each changed file. Only the files that changed need their URL bumped; unchanged files can stay on their current tag.

---

## Branch Strategy

- `dev` — all active work
- `main` — release branch; merge dev → main after tagging

**Always `git merge --no-ff dev` into main**, with a `merge: <summary> (v1.0.X)`
message. `main` receives nothing but merge commits and `dev` never merges back, so
the two permanently diverge and `--ff-only` will always fail. `main` is routinely
several releases behind — a merge normally carries every tag since the last one,
not just the newest. Tags are pinned to commits, so merging never moves them and
never requires a republish.

---

## Script Load Order & Placement (Webflow Custom Code)

**Head code:**
- `oa-styles.css` `<link>`

**Footer code (sitewide), in this order:**
1. `oa-global.js`
2. `oa-slider.js`
3. `lenis` (npm, exact-pinned `@1.3.23` — JS + `lenis.css`)
4. `oa-text-reveal.js`
5. `oa-saved-items.js` (every page shows the nav count; Save lives on the product template)
6. `oa-loader-line.js` (no-ops on a page without `[data-oa-loader]`)
7. `oa-plus.js` (after `oa-slider.js` — its `slide` trigger waits for that file's Swipers; no-ops without `[data-oa-plus]`)

`oa-global.js` **must** load before `oa-configurator.js` (both read `window.gsap`); the page-level placement guarantees it. GSAP and its plugins are injected by Webflow ahead of the footer code, so `window.gsap` is available when these run.

ScrollTrigger consumers (e.g. `oa-text-reveal.js`) run through the Lenis↔ScrollTrigger glue in `oa-global.js` (`lenis.on('scroll', ScrollTrigger.update)`) — verify scroll-triggered starts against Lenis, not native scroll. Each must load after `oa-global.js` so Lenis exists when its triggers are created.

`oa-slider.js` **must** load before any page-level embed that calls `window.oaLoadSwiper` (currently `oa-homepage.js`, `oa-content-group.js`). Webflow appends page-level footer code after sitewide footer code, so this holds automatically — just never move `oa-slider.js` out of the sitewide footer.

**Page-level embeds** (after the sitewide footer; each no-ops without its markup):
- `oa-homepage.js` — homepage (needs `window.oaLoadSwiper`)
- `oa-all-products.js` + `.css` — /all-products
- `oa-configurator.js`, `oa-infinite-grid.js` + `.css` — product template (any other page rendering the configurator needs its own embed)
- `oa-brief.js`; `oa-brief.css` as a head `<link>` — /contact. **Ship both on the same tag:** without the CSS the drawer opens as a bare dialog.
- `oa-cursor.js` + `.css` — /contact
- `oa-whatsapp.js` + `.css`, `oa-content-group.js` — homepage + /contact (wherever `oa Section Content Group` sits)
- `oa-legal-toc.js` + `.css` — `/legal/*` (after `oa-global.js`, which creates Lenis and the anchor handler)
- `oa-intro.js` — pages with `• oa Intro Hero` (/about). Its own readiness gate, not the loader's (no `[data-load-wrap]` there).

---

## Webflow Rules

- **Component link props** require a **Link** field type in the CMS, not Plain Text. Plain Text cannot be bound to a link prop.
- **Grid row height** when an element spans multiple rows is controlled by that element's **aspect ratio**, not by padding on siblings. Change the spanning element's aspect ratio first.
- **FOUC prevention** pattern: hide elements with `opacity:0; visibility:hidden` before init, restore when `.swiper-initialized` (or equivalent initialized class) is added to the container.
- Webflow Designer vs. published site: CSS class changes in Designer apply immediately; script changes require a CDN re-tag + URL update + publish.
- **Site search is Webflow native** (`/search` utility page, no API). Its index refreshes only **3 days** after a **full-site** publish (this site's plan; Webflow's docs quote 12h for Premium); a single-item CMS publish never reindexes. **Adding or renaming a product = full-site publish + Settings → Search → Index now** (once a day at most; the panel shows when it unlocks), or the piece is missing from search for days. Search result bindings (title, URL, image) aren't exposed to the Data API/MCP — bind them in the Designer.

---

## Key Patterns

- `paint(target)` in `oa-all-products.js` — the filter activation function; also pre-fires on page load from `URLSearchParams('filter')`
- Swiper carousels use custom `wrapperClass` and `slideClass` (not default `.swiper-wrapper` / `.swiper-slide`) to avoid conflicts with Webflow's own Swiper instance
- GSAP `CustomEase` is registered globally in `oa-global.js` before any page scripts run
- **Easing is chosen per motion, never by reflex** — no site-wide default curve; `--ease-oa` is only the slider's. Table in `docs/REFERENCE.md` → "Easing — pick by motion".
- **Designer knobs are listed in `docs/PROPS.md`.** Any change that adds, renames, removes or re-defaults a `data-` knob updates it in the same commit — `/props` (`.claude/skills/props/`).
- **CMS/Designer edits that break a script's match are listed in `docs/CHANGE-IMPACT.md`.** A change that makes a script depend on a CMS slug, field value or Designer text adds its row there in the same commit.
- Animation components are frequently sourced from **osmo.supply**: I paste the Webflow HTML, Claude Code adapts the JS with my tweaks — procedure in `.claude/skills/osmo-in/`

---

## Supabase (backend for the brief; later the quote pipeline)

`supabase/` holds the Edge Functions (`brief-intake`, `selection-intake`, `share-list`, `ping`), migrations and tests. **Read `supabase/README.md` before any function change or deploy:** guard chain, deploy commands, front-end contracts, and the gotchas (table grants, keepalive header). Claude runs deploys.

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

Version **v2.2.1**, a build-time clone with **no runtime**: it never auto-updates, and changes only if you re-import its components in the Designer. **`oa-slider.js` owns the slider init** (no Lumos init embeds; per-slider config from `data-speed`, `data-speed-touch`, `data-loop`, `data-parallax`, `data-slides-per-view`, defaults in the file); re-test sliders only after re-importing them.

**Lumos ≠ Osmo — never conflate.**

- **Lumos** (Timothy Ricks' Webflow framework) owns the build system: the `u-` utility classes, the `--_…---` / `--site--` variables, the type clamps / root font-size, and the **sliders** (`[data-slider='component']`, `.slider_element` / `.slider_list`). CSS written inside Lumos embeds is wiped if you re-import the embed.
- **Osmo** (osmo.supply) is a vault of individual components I paste in and adapt — e.g. the Glass CTA (Button 097/046 + Glass Effect), the all-products multi-match filter, and the easing curve now named **`--ease-oa`** (Osmo-derived, renamed to signal it's ours — the *slider* curve, not a house default). Osmo does **not** own the sliders; only the slider *easing* is Osmo-derived.

The product/home sliders are **Lumos**. Don't call them Osmo.

### Finsweet Attributes (listnest)

```html
<script defer src="https://cdn.jsdelivr.net/npm/@finsweet/attributes-listnest@1/listnest.js"></script>
```

Major-pinned (`@1`). The swatch dots on /all-products depend on it (`/* FINSWEET: swatch dots */` in `oa-all-products.css`); a major bump means re-testing them.

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

### Background video (no dependency)

Hero video is direct MP4 from Bunny storage (`-main` HEVC, `-fallback` H.264); no hls.js (reintroducing it: DECISIONS 2026-08-15 first). **Before re-encoding or swapping a file, read `docs/REFERENCE.md` → Background video:** a codec string that claims a profile the file doesn't use gives a black hero with no recovery.

### Swiper

One source sitewide: `oa-slider.js` (version constant at its top, loader `window.oaLoadSwiper`). Never add a second copy or version. A bump means re-testing every slider: product, homepage menu, both hero feeds, the content group feeds.

### Greeting Animation

Hardcoded for exactly 9 greetings, not data-driven — see `/* GREETINGS */` in `oa-styles.css` before changing the CMS greeting count.

---

## Engineering Conduct

Working style and general engineering discipline are in `~/.claude/CLAUDE.md`;
this section carries only what is specific to this repo.

- **Surgical changes, especially here:** jsDelivr serves these files by path and
  Webflow pins exact tags, so an unrequested edit can ship straight to the live site.
- **Verification here is visual/behavioural** on staging or the published site, plus the deploy checklist for shipped changes. `npm test` (`tests/`, Node's runner + Playwright) covers the saved configuration module, the brief's month select, the Edge Function shared code and the contract checks against fixtures; pre-commit runs it. The brief drawer's behavioural check is `node tools/brief-walk.mjs [chromium|webkit] [w] [h] [--local]` (header lists what to read).
- **Designer hook contract:** `node tools/contract.mjs [contact|saved-items|product|legal|all]` checks the published staging page for every hook its script reads, and fails any page showing Webflow placeholder text. Add `--capture` to rewrite that page's test fixture after a deliberate Designer change. Run it after any Designer change to a scripted page, before and after publishing. Each page's hooks are a manifest in `tools/contracts/`: a script that gains or loses a marker hook updates its manifest in the same commit.
- **Guard hooks have tests:** `.claude/hooks/test_guards.py` covers all three guards (tags, clean-svg, osmo-in). `.githooks/pre-commit` runs it and `npm test`, and blocks the commit on a failure. A `SessionStart` hook in `.claude/settings.json` sets `core.hooksPath` on any clone where it is unset. Editing a guard means adding its new case there.
