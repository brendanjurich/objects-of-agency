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
      Aker-style approach: ScrollTrigger `fromTo` reveals with
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
      was redundant — the thumb hover only ever scales ≤1, never clips). Shown
      **≥1280** only (base `display:none`, Large 1280 `display:flex`); columns
      unmoved (removing the nav from flow leaves space-between pinning them to the
      same edges). Gated to ≥1280 because below ~1290 a viewport-centred nav
      overlaps the grid map card — geometry, not z-index.
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
