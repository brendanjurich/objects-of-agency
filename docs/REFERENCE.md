# Technical Reference

Durable implementation patterns and gotchas for the build, distilled from the
per-feature working notes. The **code in `src/` is the source of truth**; this
captures the *why* and the non-obvious rules so they aren't rediscovered.

For session-by-session decisions and corrected assumptions, see
[DECISIONS.md](DECISIONS.md). For architecture relationships, query the knowledge
graph in `graphify-out/`.

---

## Hard constraints — never break these

- **Never use GSAP `autoAlpha` on `.nav_component`** — it sets `visibility`, which
  breaks `mix-blend-mode`. Toggle nav visibility via CSS class only
  (`loader-complete` on `<html>`; `revealAfterLoader()` also adds `w-mod-ix3` as a
  Webflow IX2 guard).
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

## Slider easing — `--ease-osmo`

CSS variable driving all Swiper slide transitions (Swiper writes the
timing-function inline every slide change, so the rule needs `!important`):

```css
:root { --ease-osmo: cubic-bezier(0.22, 0.36, 0.1, 1); }
.slider_element .swiper-wrapper { transition-timing-function: var(--ease-osmo) !important; }
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
  `--ease-osmo` with a 50ms delay so it reads as a settle.

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
