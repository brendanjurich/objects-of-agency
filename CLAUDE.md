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
| `src/js/oa-configurator.js` | Cascading slider, pricing engine, summary, `?cfg=` restore (read through `window.oaSaved.parseCfg`; sets radios before the slider starts), sticky panel mask `[data-oa-stuck-mask]` (first child of `.config_wrap_left`; `.is-active` only while stuck — at rest it would cover the title). | Raw file → CDN |
| `src/js/oa-saved-items.js` | Saved Items: storage, nav badge, `/saved-items` list, Share and "Email me this list". Hooks and flows: file header. **Owns the saved configuration:** `oa-brief.js` and `oa-configurator.js` read it only through `window.oaSaved` (`current`, `forRequest`, `sameConfig`, `editHref`, `parseCfg`), never its storage keys or link formats — **swap all three together** (first tag after v1.0.249). Option-group order is the share-link index — **append-only**, here and in `items.ts` (`npm test` pins it). Its pre-hide in `oa-styles.css` holds until it adds `.oa-saved-ready` to `<html>` — **ship both on the same tag**. Click handlers are capture-phase so `oa-global.js`'s page-leave sees `defaultPrevented`. Never set the email modal's display (breaks `showModal()`). Prices never reach the server (W07). | Raw file → CDN |
| `src/js/oa-all-products.js` | Osmo multi-match filter for /all-products. Reads `?filter=` URL param via `paint()` on init. | Raw file → CDN |
| `src/js/oa-loader-line.js` | OA line loader on `[data-oa-loader="line"]`; knobs in the file. Never `vector-effect: non-scaling-stroke` — it breaks the `pathLength` dash. Path is `02-brand/oa-logo/clean-svg/oa-logo-line.svg` (command centre), verbatim. | Raw file → CDN |
| `src/js/oa-plus.js` | Rotating "+" icon on `[data-oa-plus]` (the element that turns — never `display:inline`). Triggers (hover, click, slide), scope and knobs: file header. Demo: `tools/oa-plus-demo.html`. | Raw file → CDN |
| `src/css/oa-styles.css` | Global styles, FOUC prevention (incl. the Saved Items pre-hide, released by `oa-saved-items.js`), the Saved Items spinner show state (`[data-oa-saved-busy]`), nav (the closed tablet/mobile nav's `difference` blend, with the Saved Items badge pre-inverted and hidden beside the hamburger while the menu is open), hero carousel, and the homepage hero's tablet styles ported to portrait 992–1134px (iPad Pro portrait; see DECISIONS.md). | Raw file → CDN |
| `src/css/oa-all-products.css` | /all-products page styles. | Raw file → CDN |
| `src/js/oa-infinite-grid.js` | Osmo infinite draggable grid (embedded variant) for product pages. Drag + idle drift via GSAP Observer; reuses `window.gsap`/`window.Observer` (no CDN GSAP). | Raw file → CDN |
| `src/css/oa-infinite-grid.css` | Infinite grid behavioural glue (`touch-action`, status states, Designer preview). Sizing/radius/height live in the Designer. | Raw file → CDN |
| `src/js/oa-intro.js` | Intro hero (/about): video beat → blur crossfade → ABOUT scrambles in. Needs **ScrambleTextPlugin** (Webflow GSAP integration); degrades to a fade. Markup from `• oa Intro Hero`; knobs `data-oa_intro_*` on its section root. The container is `pointer-events:none` — anything clickable in the slot must turn it back on. No paired CSS. | Raw file → CDN |
| `src/js/oa-whatsapp.js` | Osmo WhatsApp Modal in the `/contact` WhatsApp section; hooks in the file header. Touch devices get the plain chat link, no card. Every href is the Business short link, set in the Designer — see `docs/contact-strategy.md`. | Raw file → CDN |
| `src/css/oa-whatsapp.css` | Behavioural glue for `oa-whatsapp.js`: the closed state, reduced motion. Card and button styling are Designer knobs. | Raw file → CDN |
| `src/js/oa-brief.js` | `/contact` brief step engine and piece drawer. No `<form>`: values post as JSON to the `brief-intake` Edge Function, which validates `items[]` in `items.ts` (any unknown key rejected — a price above all). Honeypot `[data-oa-brief-honeypot]` is **logged, never a drop** (autofill fills it whatever its name); Turnstile is the gate. Hooks, knobs, carry-over and Edit configuration: file header. Copy: `docs/brief-copy-deck.md`. | Raw file → CDN |
| `src/css/oa-brief.css` | Behavioural glue for the piece drawer: the `<dialog>` reset, level positioning, Done bar stacking, row hover/selected colours. The canvas preview is a Designer Embed (source `tools/designer/oa-brief-preview.css`). Look and sizes are Designer knobs. | Raw file → CDN |
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

`oa-slider.js` **must** load before any page-level embed that calls `window.oaLoadSwiper` (currently `oa-homepage.js`). Webflow appends page-level footer code after sitewide footer code, so this holds automatically — just never move `oa-slider.js` out of the sitewide footer.

**There is no `hls.js` anywhere** — hero video is direct MP4 (see Background video). Don't reintroduce HLS without re-reading DECISIONS.md 2026-08-15.

**Page-level embeds** (load after the sitewide footer):
- `oa-homepage.js` — homepage (needs `window.oaLoadSwiper` from `oa-slider.js`)
- `oa-all-products.js` + `oa-all-products.css` — /all-products
- `oa-configurator.js` — product template (the configurator markup is on every product page; every step no-ops when its markup is absent, so any other page that renders it needs its own embed)
- `oa-infinite-grid.js` + `oa-infinite-grid.css` — product template (the grid section ships per-product via a CMS toggle; the script no-ops when it's absent)
- `oa-brief.js` — /contact only; page-level embed after the sitewide footer. Needs `window.gsap` for the step reveal (fails open without it).
- `oa-brief.css` — /contact, `<link>` in the page head. Ship with `oa-brief.js` on the same tag: without it the drawer opens unpositioned, as a bare dialog.
- `oa-cursor.js` + `oa-cursor.css` — /contact (the piece tags). Page-level embed, no ordering constraint beyond the sitewide footer; it reads `window.gsap`, which Webflow injects ahead of footer code. No-ops on any page without `[data-cursor-init]`, so promoting it sitewide later is moving the markup and the embed, not a rewrite.
- `oa-whatsapp.js` + `oa-whatsapp.css` — /contact. Page-level embed, no ordering constraint beyond the sitewide footer.
- `oa-legal-toc.js` + `oa-legal-toc.css` — the legal pages (`/legal/*`). Page-level embed, after the sitewide footer so `oa-global.js` has created Lenis and the anchor handler first.
- `oa-intro.js` — every page carrying the `• oa Intro Hero` component (/about only); page-level embed, no ordering constraint beyond the sitewide footer. Its readiness gate is its own, not `oa-global.js`'s loader gate — those pages carry no `[data-load-wrap]`. Needs **ScrambleTextPlugin**, which is enabled in the site's GSAP integration (core + ScrollTrigger + SplitText + CustomEase + ScrambleText) and so arrives ahead of footer code like the rest of GSAP. Turning that toggle off does not break the page — the title falls back to a plain fade.

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
- **Designer knobs are listed in `docs/PROPS.md`.** Any change that adds, renames, removes or re-defaults a `data-` knob updates it in the same commit — `/props` (`.claude/skills/props/`).
- **CMS/Designer edits that break a script's match are listed in `docs/CHANGE-IMPACT.md`.** A change that makes a script depend on a CMS slug, field value or Designer text adds its row there in the same commit.
- Animation components are frequently sourced from **osmo.supply**: I paste the Webflow HTML, Claude Code adapts the JS with my tweaks — procedure in `.claude/skills/osmo-in/`

---

## Supabase (backend for the brief; later the quote pipeline)

`supabase/` holds migrations, tests and Edge Functions (`brief-intake`, `selection-intake`, `share-list`, `ping`; `functions/_shared/items.ts` is the saved-configuration validator all three list functions use; `functions/_shared/intake.ts` is the guard chain `brief-intake` and `selection-intake` both run — the order lives only there, each function supplies a definition (`brief.ts`, `selection.ts`: fields, echoed text, store, mail) and its `index.ts` only wires Supabase, Turnstile and Resend in; `functions/_shared/guard.ts` holds the hardening helpers the chain calls; `functions/_shared/http.ts` the origin allowlist and CORS for all three; `functions/_shared/mail.ts` the Resend sender; `functions/_shared/share.ts` makes the short Saved Items links, stored in `shares`, 12 months from last shared). `share-list` has no Turnstile — it sends no mail and collects no email — and counts the per-IP limit (as intake `share`) only when it stores a new list; the repo is linked to project `nleekoypvxoagnwiqtzz` (Free tier, Sydney). Before deploying: `npm test` (the chain with fakes) and `npm run typecheck` (Deno, via npx). Deploy with `supabase db push --linked` and `supabase functions deploy <name> --project-ref nleekoypvxoagnwiqtzz --no-verify-jwt` (functions gate themselves: origin allowlist, min-time, Turnstile — which fails closed, a 503, if `TURNSTILE_SECRET` is unset — then a link check and rate limits; the honeypot is logged only). Rate limits: 10 sends per email per hour and 20 per IP per day, per intake, counted by `intake_allow()` in `intake_hits` (keyed hashes, pruned after a day); over the limit is an honest 429, never a silent "Sent". Free text echoed into the visitor's email (name, pieces, project, item names/labels) is rejected with a 400 if it holds a URL or bare domain; the brief note is kept and sent to the studio in full, and only left out of the visitor's copy. Both front ends show their generic "didn't send, email us directly" line for any of these. "Automatically expose new tables" is **off** on the project, so every new table needs an explicit `grant … to service_role` — see `20260909000100_briefs_service_role.sql`. Secrets (`RESEND_API_KEY`, `TURNSTILE_SECRET`) live in function secrets, never in the repo or Webflow. `.github/workflows/keepalive.yml` pings the `ping` function every third day so the Free project never pauses. It is a bare `curl` with no header: GitHub refuses to register any workflow file in this repo that contains an `apikey:`-style header string, with or without secrets (bisected 09-09-2026), and the function needs none because it deploys with JWT verification off.

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
- **Verification here is visual/behavioural** on staging or the published site, plus the deploy checklist for shipped changes. `npm test` (`tests/`, Node's runner + Playwright) covers the saved configuration module and the Edge Function shared code; run it after touching either. The brief drawer's behavioural check is `node tools/brief-walk.mjs [chromium|webkit] [w] [h] [--local]` (header lists what to read).
- **Designer hook contract:** `node tools/contract.mjs [contact|saved-items|product|legal|all]` checks the published staging page for every hook its script reads, and fails any page showing Webflow placeholder text. Add `--capture` to rewrite that page's test fixture after a deliberate Designer change. Run it after any Designer change to a scripted page, before and after publishing. Each page's hooks are a manifest in `tools/contracts/`: a script that gains or loses a marker hook updates its manifest in the same commit.
- **Guard hooks have tests:** `.claude/hooks/test_guards.py` covers all three guards (tags, clean-svg, osmo-in). `.githooks/pre-commit` runs it and `npm test`, and blocks the commit on a failure. A `SessionStart` hook in `.claude/settings.json` sets `core.hooksPath` on any clone where it is unset. Editing a guard means adding its new case there.
