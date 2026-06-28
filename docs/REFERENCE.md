# Technical Reference

Durable implementation patterns and gotchas for the build, distilled from the
per-feature working notes. The **code in `src/` is the source of truth**; this
captures the *why* and the non-obvious rules so they aren't rediscovered.

For session-by-session decisions and corrected assumptions, see
[DECISIONS.md](DECISIONS.md). For how styling is layered across Webflow / Lumos /
the repo override — and where a fix belongs — see
[CSS-ARCHITECTURE.md](CSS-ARCHITECTURE.md). For architecture relationships, query the
knowledge graph in `graphify-out/`.

---

## Hard constraints — never break these

- **Nav reveal is CSS-gated on `.loader-complete`** (on `<html>`), not GSAP. The nav
  (Osmo Multilevel Nav, class `.nav`) is FOUC-pre-hidden via `opacity:0` until the
  loader adds `.loader-complete`. (The old `.nav_component` + `mix-blend-mode` +
  `autoAlpha`-ban setup was retired 2026-06-28 — the new nav is blend-free.)
- **Never write CSS inside Lumos embeds** — wiped on Lumos updates. All custom CSS
  lives in `oa-styles.css`.
- **Never use `dvh` for hero height — use `svh`.**
- **Never commit API keys, credentials, or `.env` files.**
- jsDelivr rate-limits rapid tags; a fresh tag may 404 for up to ~1h (see CLAUDE.md
  deploy checklist for the SHA-URL workaround).

---

## Hero `.hero_feed_top` vertical Swiper

Two separate issues, both solved in CSS only — **do not** fix with `setTimeout`,
`creativeEffect` translate edits, or any JS change.

1. **Blank/wrong-slide bug = flex offset breaking progress math.** A
   `justify-content: center` (+ `align-items: center`) wrapper at a fixed 1-slide
   height centres the stacked slides, shifting each slide's `offsetTop` by one
   slide height. Swiper computes `progress = (offsetTop − wrapperTranslate)/height`
   assuming sequential offsets from `0`, so no slide ever lands at progress `0` and
   all render inactive (`opacity:0.1`, translated away). **Fix:**
   ```css
   .hero_feed_top-wrap { justify-content: flex-start !important; align-items: stretch !important; }
   ```
2. **FOUC** — slides flash in normal flow before init. Hide with `opacity:0`
   (not `display:none`, which breaks Swiper's height measurement), restore on the
   `.swiper-initialized` class Swiper adds synchronously in its constructor:
   ```css
   .hero_feed_top .hero_feed_top-slide { opacity: 0; }
   .hero_feed_top.swiper-initialized .hero_feed_top-slide { opacity: 1; }
   ```
   Swiper's inline `opacity:0.1`/`1` then wins by inline specificity, so the
   creative-effect fade still works. Optionally also `visibility:hidden` the
   `-wrap` pre-init for a belt-and-suspenders single-frame guard.

---

## Site easing — `--ease-oa`

> Renamed from `--ease-osmo` (2026-06-28) to signal it's ours, not Osmo's. The
> nav's `--cubic-default` aliases this var. Same curve, new name.

CSS variable driving all Swiper slide transitions (Swiper writes the
timing-function inline every slide change, so the rule needs `!important`):

```css
:root { --ease-oa: cubic-bezier(0.22, 0.36, 0.1, 1); }
.slider_element .swiper-wrapper { transition-timing-function: var(--ease-oa) !important; }
```

- `(0.22, 0.36, 0.1, 1)` is the tuned "goldilocks" curve: early responsive
  departure (no touch lag) without front-loading motion (stays composed on
  desktop). The product page originally used the pure Osmo curve
  `(0.625, 0.05, 0, 1)` — lazy start, gorgeous on desktop, read as lag on touch.
- **Static product slider speed** is patched in `oa-global.js` at `window.load`:
  `800ms` desktop / `700ms` touch (`matchMedia('(pointer: coarse)')`). The Webflow
  `data-speed` attribute is overwritten by this patch, so it's safe to leave/remove.
- **Mobile "raise on settle" gate**: with `slidesPerView: 1.1` a peek card was
  raising mid-swipe, so two cards competed for the raised state. `oa-global.js`
  toggles `body.is-slider-transitioning` on Swiper `transitionStart/End` +
  `touchStart/End`, and the raise is gated `body:not(.is-slider-transitioning)
  .card_product_wrap.is-active .card_product_visual`. Raise easing matches
  `--ease-oa` with a 50ms delay so it reads as a settle.

---

## Statement scroll-blur (`.oa_statement_blur`)

Text that fades as a soft-edged panel sweeps down it on scroll (homepage intro;
modelled on FlowGuide's brand-guide statement). The repo owns **only** the mask in
`oa-styles.css` — everything else is Webflow-side.

**The recipe — three Webflow-owned styles on `.oa_statement_blur` + one repo rule:**
- Webflow: `filter: blur(40px)` · `opacity: 0.8` · `background-color` = **the section bg colour**.
- Repo (`oa-styles.css`): `mask-image: linear-gradient(to bottom, transparent 0%, black 15%)`.
- Motion: Webflow **IX2** "While scrolling in view" (`OA Statement [Scroll]`) translates
  the panel down through the text. No GSAP/ScrollTrigger.

**The colour-lock rule — this is the one that bites.** The panel is invisible against
its backdrop *only* while `panel background == section background` (at 0.8 opacity,
`0.8·bg + 0.2·bg = bg`). Let them drift and the panel shows as a visible block/band.
→ Bind the panel's `background-color` to the **same colour variable the section uses**,
so a light/dark variant (or any re-theme) drags both together and can't desync.

**The mask is load-bearing — do not remove.** It feathers the wipe's leading (top) edge
as it sweeps through the text. On a **light** theme (dark text fading on light bg) the
40px blur alone leaves a visible line travelling over the text; the mask softens it out.
A **dark** variant (light text on dark, like FlowGuide) doesn't strictly need it but it's
harmless — leave it. (Removed once as "redundant" → the line came straight back →
restored. The "panel == bg ⇒ edge invisible" logic only holds for the edge over the
*bare bg*; it ignores the wipe edge over the *text*, which is what the mask fixes.)

**Component / variant flags:**
- The mask is a **global class rule** → it carries to every instance and variant
  automatically. Don't scope or duplicate it per-variant.
- Per dark variant: set the panel bg to *that* variant's section bg (ideally via the
  shared variable above); keep `opacity: 0.8` and `filter: blur(40px)`.
- After componentizing, **test the IX2 scroll interaction still fires** on each variant —
  IX2 + components is a fiddly area.
- **Timing** ("comes in at X% from bottom") is IX2 **Start / End offsets**, Designer-only
  (no API). Lower Start = later onset; a smaller End offset speeds the sweep (faster edge
  = more conspicuous, so don't over-compress it). Smoothing `80`.

---

## All Products filter (Osmo multi-match)

- **Approach B (chosen):** a CMS **plain-text** field (`Filter Tags`) bound directly
  to `data-filter-name` on each card, populated server-side. Space-separated,
  lowercase, hyphenated slugs (`coffee bedside`) matching the buttons'
  `data-filter-target` exactly.
- **Why not `data-filter-name-collect` auto-collect:** Finsweet List Nest injects
  nested CMS content **asynchronously after load**, but the Osmo collect sweep runs
  once at `DOMContentLoaded` — the collected children aren't in the DOM yet, so it
  always misses. `fs-list-cache=false` only makes the failure *consistent*, not
  fixed. Approach B has no timing dependency.
- Osmo (`data-filter-*`) and Finsweet (`fs-list-*`) use separate attribute
  namespaces — no collision. Live filter logic lives in `oa-all-products.js`
  (`paint()`); shipped CSS targets cards by attribute/class, not the demo's
  `.filter-btn`/`.filter-list__item`.

### URL pre-filtering (menu cards → pre-activated filter)

Category cards link to `/all-products?filter=<slug>`. On load, `paint()` reads the
`?filter=` param (`URLSearchParams`) and activates the matching filter — no click
simulation, no polling. (Earlier `setInterval`-click and `fsAttributes.push`
variants were superseded by reading the param directly in `paint()`.)

---

## CMS / configurator schema (product pages)

**Products collection toggles** drive section visibility: `Has Size Config`,
`Has Top Material`, `Has Timber`, `Has Anodised Finish`, `Has Static Info`,
`Show Label`, `Has More Variants`. Plus `Base Price` (number), `Label` (text).
**Sizes / Materials & Finishes:** `Price Modifier` (number), swatch/slider images
(avif).

Right-column DOM (`config_wrap_right`): `config_wrap_main` →
`config_wrap_price` (`config_price_prefix` static "From $" · `config_from_price`
JS-controlled · `config_base_price` hidden CMS number), then
`config_size_wrap` / `config_top_wrap` / `config_timber_wrap` /
`config_anodised_wrap` (toggle-gated), `config_summary_wrap` (always),
`config_static_wrap` (toggle).

- **Pricing is additive:** `Total = Base Price + Σ [data-price] on checked items`.
  Format with `Intl.NumberFormat`, no currency symbol; recompute on every radio
  change.
- **Radio names (hardcoded, intentional):** `Sizes`, `Top-Material`, `Timber`,
  `Anodised-Finish`. `fixRadioIds()` maps these to `size-{n}` / `top-material-{n}`
  / `timber-{n}` / `anodised-{n}`. A data-driven refactor was evaluated and
  rejected (see DECISIONS.md).
- **Summary IDs:** `#summary-size`, `#summary-top-material`, `#summary-timber`,
  `#summary-anodising` (default em-dash). Summary sources the material *name* from
  the active cascading slide, not the radio (swatch labels are image-only) — keep
  exactly one `[data-cascading-slide][data-status="active"]` at all times.
- **CMS-list-in-grid fix:** make the collection list/items transparent to grid via
  `display: contents` on the `_collection` (w-dyn-list) and `_list` (w-dyn-items)
  wrappers, so `.w-dyn-item` becomes a direct grid child.

---

## CSS / Webflow techniques

- **Background video tint** lives in Webflow as a CSS overlay
  (`.home-hero_video-gradient`, a `linear-gradient(#000, transparent)` at
  `opacity:0.3`), **not baked into the video**. Always do tints as a CSS overlay
  (`position:absolute; inset:0`) — non-destructive, responsive, tweakable.
- **Active filter-button bottom border** must use the literal `#d66740`. The
  scoped override selector targeted a non-existent `.all_tables_title-wrap`; the
  real wrapper is `.all_categories_title-wrap`. Generic rule
  `[data-filter-target][data-filter-status="active"] .button_main_element` wins via
  `!important` (loaded after Webflow's stylesheet).
- **Per-section image swap** (same product, different image in two sections):
  add a second CMS image field + second `<img>` (unique class), toggle by section
  ID — `section#edition .card_..._image-edition { display:block }` etc. No JS, no
  duplicate collection list.
- **Finsweet List Nest stale card:** one card showing old nested content =
  Chrome cache or List Nest's republish-persistent cache or a duplicate CMS slug
  (List Nest fetches each item's template page by URL). Fix: DevTools → "Empty
  Cache and Hard Reload" (hard refresh alone won't do it); `fs-list-cache="false"`
  during active CMS dev; check the offending item for a duplicate slug.
