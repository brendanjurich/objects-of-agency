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
| `src/js/oa-global.js` | GSAP fail-open guard, loader, page transitions, slideshow (data-slideshow), nav animations, custom eases, Lenis smooth scroll, Email Direct mailto assembly (`data-oa-email`). | Raw file → CDN |
| `src/js/oa-slider.js` | Lumos slider init (product + homepage menu). Loads the Swiper 12.2.0 bundle from jsDelivr when a slider exists and exposes the loader as `window.oaLoadSwiper` — the **single Swiper source sitewide**. | Raw file → CDN |
| `src/js/oa-configurator.js` | Cascading slider (product carousels with GSAP, touch/click), pricing engine, summary. | Raw file → CDN |
| `src/js/oa-all-products.js` | Osmo multi-match filter for /all-products. Reads `?filter=` URL param via `paint()` on init. | Raw file → CDN |
| `src/css/oa-styles.css` | Global styles, FOUC prevention, nav, hero carousel. | Raw file → CDN |
| `src/css/oa-all-products.css` | /all-products page styles. | Raw file → CDN |
| `src/js/oa-infinite-grid.js` | Osmo infinite draggable grid (embedded variant) for product pages. Drag + idle drift via GSAP Observer; reuses `window.gsap`/`window.Observer` (no CDN GSAP). | Raw file → CDN |
| `src/css/oa-infinite-grid.css` | Infinite grid behavioural glue (`touch-action`, status states, Designer preview). Sizing/radius/height live in the Designer. | Raw file → CDN |
| `src/js/oa-intro.js` | Intro hero: video beat → blur crossfade → ABOUT scrambles in (blur and title start together and resolve together). Gates on page reveal + video `canplay`, each raced against a cap. Needs **ScrambleTextPlugin**, enabled site-wide in Webflow's GSAP integration; degrades to a plain fade without it. Markup comes from the reusable `• oa Intro Hero` component; beat timings are Designer knobs (`data-oa_intro_*`) on its section root. The container is `pointer-events:none`, so anything clickable in the slot must turn it back on. No paired CSS — nothing it needs is inexpressible in the Designer. | Raw file → CDN |
| `src/js/oa-whatsapp.js` | Osmo WhatsApp Modal, adapted. The `oa Whatsapp Modal` component in the `/contact` WhatsApp section (`section_contact_whatsapp`): the trigger opens a card holding a static QR and the chat link. Mount `data-whatsapp-init`; `data-whatsapp-trigger`, `-panel`, `-close` mark the parts; state is written back as `data-whatsapp-status`. On touch (`(hover: none) and (pointer: coarse)`) the trigger is left a plain link to the chat and the card never opens. Every href is the Business short link, set in the Designer — see `docs/contact-strategy.md`. | Raw file → CDN |
| `src/css/oa-whatsapp.css` | Behavioural glue for `oa-whatsapp.js`: the closed state, reduced motion. Card and button styling are Designer knobs. | Raw file → CDN |
| `src/js/oa-brief.js` | `/contact` project brief step engine. Root is `[data-oa-brief]` (the layout grid); each step is a question block + answers block sharing `data-oa-brief-step`, scoped by `data-oa-brief-branch` / `-when` / `-unless`. Chips are `• oa Brief Chip` / `• oa Brief Chip Radio` instances (forked from Lumos Form Checkbox/Radio). No `<form>`: values are read from the root and posted as JSON to the `brief-intake` Edge Function (`supabase/functions/`). Root knobs: `data-oa-brief-endpoint`, `data-oa-brief-turnstile-key`, `data-oa-brief-response`; step transition timings in seconds `data-oa-brief-exit` (0.2), `-enter` (0.45), `-stagger` (0.2, chip spread; 0 = off). Turnstile loads lazily on the two send screens. Draft in `sessionStorage`; `?piece=` pre-fills the piece screen. Copy: `docs/brief-copy-deck.md`. | Raw file → CDN |
| `src/js/oa-cursor.js` | Osmo Dynamic Text Cursor, adapted. A bubble follows the mouse and shows a per-element label; mount it with `data-cursor-init`, mark the text leaf `data-cursor-text-target`, and any element carrying `data-cursor-hover` + `data-cursor-text="…"` activates it. The hover target is resolved by `elementFromPoint` at pointer time, not bound per node, so a list that is destroyed and rebuilt (the brief's piece tags) never needs rebinding — but the bubble **must** keep `pointer-events:none` or it hit-tests itself. Reuses `window.gsap` (`quickTo`); warns and skips without it. Mouse-only by capability, and reduced motion snaps rather than dropping the label. Paired glue in `oa-cursor.css`. | Raw file → CDN |
| `src/css/oa-cursor.css` | Behavioural glue for `oa-cursor.js`: fixed positioning, the `[data-cursor-status]` state rules, touch/reduced-motion branches, and the `wf-design-mode` preview. Bubble size, colour, radius, padding and type are Designer knobs and are deliberately absent. | Raw file → CDN |
| `src/js/oa-legal-toc.js` | Legal pages' section index. Builds the "On this page" list from the shallowest heading level present inside `[data-legal-toc-content]` (a paste into a Webflow Rich Text does not reliably land on `h2` — Delivery & Returns came through as `h5`) by cloning the one `[data-legal-toc-link]` template, then highlights the section in view with ScrollTrigger (`data-legal-toc-status="active"`). Hooks are `[data-legal-toc-list]` (holds the one template link) and `[data-legal-toc-content]` (the Rich Text), resolved page-wide — they do not have to share a wrapper, because the Designer layout puts them in sibling branches of the `• oa Titles + Text` component. Adapted from Osmo's Table of Contents; their click handler was dropped because `initNavAnchorLinks` in `oa-global.js` already owns same-page anchor scrolling — the element holding the index links opts in with `data-oa-anchor-scroll`. Section numbers are stripped from the generated ids (a digit-leading id is a valid id but an invalid CSS selector, and `initNavAnchorLinks` resolves the target with `querySelector`). Below the Lumos medium boundary the index folds into an accordion this file owns by attribute: `[data-legal-toc-accordion]` (the `.oa-accordion_item`; carries the timing knobs `data-legal-toc-duration` / `-ease` / `-duration-close` / `-ease-close` / `-stagger`), `[data-legal-toc-toggle]` (the button; its `aria-expanded` is the state), `[data-legal-toc-panel]` (height animates), `[data-legal-toc-label]` (desktop-only label). The open look is Designer work through Lumos's `data-state="expanded"` → `--_state---true/false`. A link tap closes it instantly from a `window` capture click listener — ahead of `initNavAnchorLinks`, and never on `pointerdown`, which moves the link out from under the tap. Fails open without GSAP: the index still builds, navigates and toggles, without motion. | Raw file → CDN |
| `src/css/oa-legal-toc.css` | Behavioural glue for `oa-legal-toc.js`: the heading `scroll-margin-top` (nav clearance, same 130px as `oa-all-products.css`), the active-state rule on `--swatch--brand-500`, the accordion's show/hide states inside `@container (width < 50em)` (Lumos's medium boundary), and the `wf-design-mode` preview. Grid split, sticky offset, gaps, type and colours are Designer knobs. | Raw file → CDN |
| `src/js/oa-text-reveal.js` | Text reveal: section headings and lead paragraphs blur in line by line on scroll, with a short scramble on the front of each line. Opt in with `data-oa-reveal` in the Designer; timings are Designer knobs (`data-oa_reveal_*`). The attribute may sit on a wrapper — the split targets the text leaves (`h1`-`h6`, `p`) inside it, never the wrapper itself, or every line carries markup and the scramble guard drops the gesture. A Webflow **Rich Text** counts as a leaf (Webflow renders `<p>`/`<h*>` inside the `w-richtext` div) but a **Text Block** does not — it is a bare `div`, so it never splits and pops at full opacity while its siblings blur in. That is the difference between the `oa Page Headline` component, whose eyebrow and heading are both Rich Text, and a hand-built block: give any non-semantic text element the `p` tag or make it Rich Text. Uses **SplitText** (`type:'lines'`, `autoSplit`, `aria:'auto'`) + **ScrambleTextPlugin**, both from Webflow's GSAP integration. Gated on `oa:page-revealed` (the end of the page transition's enter fade, dispatched by `oa-global.js`) + fonts ready — the loader gate it used before fires at `DOMContentLoaded` on no-loader pages, so an above-the-fold block played out behind a page still at `opacity:0`. A `data-oa_reveal_delay` knob adds a lead-in on top of that gate. Paired pre-hide in `oa-styles.css`. | Raw file → CDN |

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
4. `oa-configurator.js`
5. `oa-text-reveal.js`

`oa-global.js` **must** load before `oa-configurator.js` (both read `window.gsap`). GSAP and its plugins are injected by Webflow ahead of the footer code, so `window.gsap` is available when these run.

ScrollTrigger consumers (e.g. `oa-text-reveal.js`, `oa-legal-toc.js`) run through the Lenis↔ScrollTrigger glue in `oa-global.js` (`lenis.on('scroll', ScrollTrigger.update)`) — verify scroll-triggered starts against Lenis, not native scroll. Each must load after `oa-global.js` so Lenis exists when its triggers are created.

`oa-slider.js` **must** load before any page-level embed that calls `window.oaLoadSwiper` (currently `oa-homepage.js`). Webflow appends page-level footer code after sitewide footer code, so this holds automatically — just never move `oa-slider.js` out of the sitewide footer.

**There is no `hls.js` anywhere** — hero video is direct MP4 (see Background video). Don't reintroduce HLS without re-reading DECISIONS.md 2026-08-15.

**Page-level embeds** (load after the sitewide footer):
- `oa-homepage.js` — homepage (needs `window.oaLoadSwiper` from `oa-slider.js`)
- `oa-all-products.js` + `oa-all-products.css` — /all-products
- `oa-infinite-grid.js` + `oa-infinite-grid.css` — product template (the grid section ships per-product via a CMS toggle; the script no-ops when it's absent)
- `oa-brief.js` — /contact only; page-level embed after the sitewide footer. Needs `window.gsap` for the step reveal (fails open without it).
- `oa-cursor.js` + `oa-cursor.css` — /contact (the piece tags). Page-level embed, no ordering constraint beyond the sitewide footer; it reads `window.gsap`, which Webflow injects ahead of footer code. No-ops on any page without `[data-cursor-init]`, so promoting it sitewide later is moving the markup and the embed, not a rewrite.
- `oa-whatsapp.js` + `oa-whatsapp.css` — /contact. Page-level embed, no ordering constraint beyond the sitewide footer.
- `oa-legal-toc.js` + `oa-legal-toc.css` — the legal pages (`/legal/*`). Page-level embed, after the sitewide footer so `oa-global.js` has created Lenis and the anchor handler before the index's triggers exist.
- `oa-intro.js` — every page carrying the `• oa Intro Hero` component (/about only); page-level embed, no ordering constraint beyond the sitewide footer. Its readiness gate is its own, not `oa-global.js`'s loader gate — those pages carry no `[data-load-wrap]`. Needs **ScrambleTextPlugin**, which is enabled in the site's GSAP integration (core + ScrollTrigger + SplitText + CustomEase + ScrambleText) and so arrives ahead of footer code like the rest of GSAP. Turning that toggle off does not break the page — the title falls back to a plain fade.

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
- **Easing is chosen per motion, never by reflex** — no site-wide default curve; `--ease-oa` is only the slider's. Table in `docs/REFERENCE.md` → "Easing — pick by motion".
- Animation components are frequently sourced from **osmo.supply**: I paste the Webflow HTML, Claude Code adapts the JS with my tweaks — procedure in `.claude/skills/osmo-in/`

---

## Supabase (backend for the brief; later the quote pipeline)

`supabase/` holds migrations, tests and Edge Functions; the repo is linked to project `nleekoypvxoagnwiqtzz` (Free tier, Sydney). Deploy with `supabase db push --linked` and `supabase functions deploy <name> --project-ref nleekoypvxoagnwiqtzz --no-verify-jwt` (functions gate themselves: origin allowlist, honeypot, min-time, Turnstile). "Automatically expose new tables" is **off** on the project, so every new table needs an explicit `grant … to service_role` — see `20260909000100_briefs_service_role.sql`. Secrets (`RESEND_API_KEY`, `TURNSTILE_SECRET`) live in function secrets, never in the repo or Webflow. `.github/workflows/keepalive.yml` pings the `ping` function every third day so the Free project never pauses. It is a bare `curl` with no header: GitHub refuses to register any workflow file in this repo that contains an `apikey:`-style header string, with or without secrets (bisected 09-09-2026), and the function needs none because it deploys with JWT verification off.

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

**`oa-slider.js` owns the slider init outright.** There are no Lumos inline init embeds in the Designer, and `oa-global.js` does not touch sliders. Per-slider config is read from Designer data-attributes (`data-speed`, `data-speed-touch`, `data-loop`, `data-parallax`, `data-slides-per-view`); `oa-slider.js` is the source of truth for the defaults. Re-test slider behaviour only if **you** re-import the Lumos sliders and their DOM or class names change — *not* on every publish.

**Lumos ≠ Osmo — never conflate.**

- **Lumos** (v2.2.1, Timothy Ricks' Webflow framework) owns the build system: the `u-` utility classes, the `--_…---` / `--site--` variables, the type clamps / root font-size, and the **sliders** (`[data-slider='component']`, `.slider_element` / `.slider_list`, Swiper 8 — "Lumos-initialized Swipers"). CSS written inside Lumos embeds is wiped if you re-clone/re-import the embed.
- **Osmo** (osmo.supply) is a vault of individual components I paste in and adapt — e.g. the Glass CTA (Button 097/046 + Glass Effect), the all-products multi-match filter, and the easing curve now named **`--ease-oa`** (Osmo-derived, renamed to signal it's ours — the *slider* curve, not a house default). Osmo does **not** own the sliders; only the slider *easing* is Osmo-derived.

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

### Background video (no dependency)

All hero video is direct MP4 from **Bunny storage** — no hls.js, no Bunny Stream, no
third-party player. One naming convention across both pages: **`-main` is the HEVC
encode, `-fallback` is H.264.** The homepage carries four, as Designer attributes on
`[data-bunny-background-init]`:

| Attribute | File |
|---|---|
| `data-player-src` | H.264 2048×1024 landscape — **the only required one** |
| `data-player-src-hevc` | HEVC 2048×1024 landscape |
| `data-player-src-mobile` | H.264 720×1280 portrait |
| `data-player-src-hevc-mobile` | HEVC 720×1280 portrait |

The mobile pair is a **9:16 portrait reframe, not a downscale**, so selection is
gated on `(max-width: 767px) and (orientation: portrait)`: a portrait file in a
landscape viewport crops to a ~26% sliver, worse than just serving the landscape
file.

Each optional attribute degrades on its own: clear `-hevc` and everything takes
H.264; clear either `-mobile` and that codec serves the landscape file to phones.
Chosen **once at attach** (`data-player-mobile-max` moves the threshold) and never
re-evaluated — a src swap on rotate restarts and re-downloads the clip, so a phone
rotated after load keeps whichever file it opened with.

**Re-encoding means re-reading the codec string out of the file** (`hvcC`), never
off the encoder preset, and updating `HEVC_CODEC` in `oa-homepage.js` *and*
`oa-intro.js` — currently `hvc1.2.4.L120.90` (Main10, Main tier, L4.0). Claiming a
profile the file does not use is the one failure with no recovery: the codec is
picked up front, so a device that says "probably" and then can't decode gets a black
hero. Understating is safe (drops to H.264). Reasoning: DECISIONS.md 2026-08-15 and
2026-08-19.

```
python3 tools/codec-string.py <file-or-url> [more...]
```

Reads the string straight out of the container and prints what the repo currently
pins beside it, so the two can be compared by eye. Takes a local export or a URL
(range-requested, ~1.5MB, not the whole video). `tools/` is dev-only — nothing in
there is served.

`/about` runs the same main/fallback pair on a plain `<video>`: HEVC in `src`, H.264
in `data-oa_intro_video-fallback` on `[data-oa_intro-hero]` — the `• oa Intro Hero`
component's section root, not the wrap, because Webflow only binds an attribute
value to a component prop on a **DOM** element and the section is the only one in
that tree. `oa-intro.js` swaps at parse time.

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

## Engineering Conduct

Working style and general engineering discipline are in `~/.claude/CLAUDE.md`;
this section carries only what is specific to this repo.

- **Surgical changes, especially here:** jsDelivr serves these files by path and
  Webflow pins exact tags, so an unrequested edit can ship straight to the live site.
- **Verification here is visual/behavioural** on staging or the published site, plus the deploy checklist for shipped changes — there is no test suite.
