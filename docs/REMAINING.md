# Remaining — Launch Checklist

Ordered by dependency. Work top-to-bottom where possible: foundation before SEO, content before schema, features last.

---

## Foundation

- [ ] Semantic HTML & structure audit
- [ ] Aria labels — all interactive elements labelled
- [ ] Product slider keyboard focus (deferred) — CSS-only `:focus-visible` worked in
      Chrome but broke in Safari (Swiper's a11y module controls `tabindex` on slides
      and redirects Tab through its dots/arrows, firing the ring out of order).
      Fix: disable/reconfigure Swiper's keyboard module so native Tab order wins, set
      correct `tabIndex` on `.clickable_link` in slides, then re-add the focus-ring
      rule (scale + shadow + outline on `.card_product_visual`, removed at v1.0.36).
      Test Chrome + Safari. Edit `src/js/oa-global.js`.

---

## Legal & Content

- [ ] T&C page — write and publish
- [ ] Q&A page — write and publish
- [ ] Nyoongar acknowledgement — copy and placement confirmed

---

## Assets & Downloads

- [ ] Revit files — upload and link from product pages
- [ ] Spec sheets — upload and link from product pages

---

## SEO / AEO

- [ ] Page titles and meta descriptions — every page
- [ ] Open graph images — every page
- [ ] Meta tagging audit — canonical, robots, hreflang if needed
- [ ] Schema markup — Organisation, Product, BreadcrumbList
- [ ] Structured data everywhere it's needed (verify coverage)
- [ ] FAQ schema — linked to Q&A page content
- [ ] AEO pass — answer engine optimisation (question-led headings, concise answers)

---

## Features & UI Polish

- [ ] Landing page options — decision needed, then build
- [ ] Scroll reveal animations — build on the Lenis engine (shipped v1.0.89).
      Approach: ScrollTrigger `fromTo` reveals with
      `toggleActions: 'play reset play reset'` (fire-on-enter, replay on re-enter)
      + SplitText for text reveals. No scrub/pin. Mobile differences are
      per-animation params via an `isMobile = innerWidth <= 768` flag (axis swap,
      scale, translate direction), not a separate scroll system. ScrollTrigger +
      SplitText already enabled in Webflow; Lenis is wired to `gsap.ticker` so
      these stay smooth. Separate art-direction pass per animation.
- [ ] Osmo flippy text animation
- [ ] Rolling inso design quotes — CSS marquee
- [ ] Video screen recording of configurator
- [ ] WhatsApp Osmo thing + face as a link
- [ ] One thing to watch on the scrollbar change: hiding the bar sitewide also hides it on long scrolling pages (e.g. /all-products) where a position indicator is genuinely useful. If that feels off anywhere, the fallback is scrollbar-gutter: stable on those pages instead. Flag it if you notice it; I won't touch it preemptively.
- [x] Hero slider nav — centred in viewport. Done 2026-06-09 (Webflow Designer,
      no repo code). The element was an in-flow flex middle-child of a
      `space-between` row between two unequal columns, so it centred on the *gap*
      (−44px@1200, −70px@992), not the viewport. Fix on `.crisp-header__slider-nav`:
      position **Absolute** in `.hero_main_layout` (relative, full-bleed) →
      **Left 50%**, **Right/Top Auto** (only one horizontal inset, so Width:Auto
      hugs the buttons), **Transform Move X −50%** (centres the content-width box),
      **Bottom 0** (page clamp-margin carries floor spacing), **z-index 2** (sits
      above the map card's backdrop-filter), wrapper padding **0** (osmo's 0.6rem
      was redundant — the thumb hover only ever scales ≤1, never clips). Columns
      unmoved (removing the nav from flow leaves space-between pinning them to the
      same edges).
      **Update 2026-06-10 — nav now stays, no extra breakpoint:** the old ≥1280
      gate (base `display:none` + a custom **Large 1280** `display:flex`) is
      **removed.** That 1280 breakpoint was the thing being avoided (it compresses
      the desktop Designer canvas). The nav now stays centred and scaling from
      large screens down to **992**; the only visibility gate is
      `.nav_viewport_wrapper { display:none }` on the **standard ≤991 tablet
      breakpoint** — no custom breakpoint added. The old "overlaps the grid map
      card below ~1290" concern is resolved by the hero scale flow shrinking the
      nav buttons (`--hero-k-nav`): the centred nav clears the grid by **11.5–14.5px
      across 992→1024** (verified on staging). `.nav_viewport_wrapper` is a flex placeholder
      for the centre slot of a `space-between` row (`hero_main_bottom` · wrapper ·
      `hero_feed_grid`) — the nav is `position:absolute` to `.hero_main_layout`, so
      the wrapper has **no in-flow content** and clearing its width collapses it to
      0. Give it a **width %** (currently ~32%, computes to 464px@1440), **not
      `flex:1`**. `flex:1` (grow:1, basis:0) makes the wrapper an active claimant of
      the row's free space, competing with `hero_feed_grid` (`width:100%;
      max-width:30rem; flex-shrink:1`) and shifting the grid's rendered width across
      the range — which detunes the divider clamp and `--hero-k`, both calibrated
      against that grid geometry (breaks off 1440, the reason `flex:1` failed in
      practice). A width % is a flex-*basis* with no grow: it reserves a
      viewport-proportional slot without stealing free space, so the grid keeps the
      exact shrink behaviour the scale flow was tuned against. The wrapper is a pure
      strut (absolute nav = zero in-flow content), so its width is functionally inert
      — it can't clip or move the nav, only hold the slot open. Verified on staging
      992→1920: divider→grid gap holds **16.3–17.1px**, nav clears the grid at every
      width (min 11.5px@992). **`height:2.75rem`** is the load-bearing value — it
      equals the max nav-button height (`calc(2.75rem × --hero-k-nav)`), so scaled
      buttons never clip. See the hero scale-lever
      spec: `docs/superpowers/specs/2026-06-10-homepage-hero-scale-lever-design.md`.
- [ ] Hero slider images → **AVIF** + fix loading. (Replaces the old "asset
      gating" plan — decided against; rationale below.) Swap the 3 slide jpgs
      (slides 1–3: `viewfinder-xen`, `interior-credenza`, `viewfinder-side-oval`)
      to AVIF (~½ size, ~no quality loss; keeps Webflow srcset). Set slide 2
      image `loading` **eager → lazy** — it isn't the LCP (slide 0 / the bunny
      video is) and shouldn't sit in the critical initial load.
      **Why no gate:** slides are nav-only / desktop-reward and already
      srcset-right-sized, so a data-src gate would drop srcset on 3 hero images
      for a small, device-narrow residual win — not worth it once AVIF halves them.

---

## Post-Launch

- [ ] A/B testing setup (Optimise or equivalent)
- [ ] "Are we in the conversation?" — visibility / PR audit
