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
- [ ] Hero slider nav — move from absolute to in-flow so it stops hiding behind
      the hero grid at narrower desktop widths. **Root cause** (diagnosed live in
      DevTools 2026-06-09): `.crisp-header__slider-nav` is `position:absolute` +
      centre-justified in `.hero_main_layout`, sharing the bottom band with the
      in-flow right column `.hero_feed_grid`. Absolute = no reserved space, so as
      the viewport narrows the right-aligned grid's left edge crosses the centred
      nav (grid-left ≈ vw−512, nav-buttons-right ≈ vw/2+123 → collide **~1270px**)
      and the grid's map card (a `backdrop-filter` stacking context) paints over
      it. z-index won't fix it — you'd just draw the nav over the map.
      **Fix** (Webflow Designer, no repo code):
      1. `.hero_main_layout` → Flex **VERTICAL**, Align Stretch (keep position
         relative, h:100%).
      2. Add `hero_main_row` [NEW]: Flex Horizontal · Justify Space Between ·
         Align End · Width 100% · **Flex Grow (1)** · position relative · z-index
         1. Move `hero_main_bottom` (left) and `hero_feed_grid` (right) into it.
      3. `.crisp-header__slider-nav` → make it the **LAST child** of
         `.hero_main_layout`: position **Static**, Width 100%, Flex · Justify
         **Center** · Align End, padding-bottom ~32px, keep z-index 1 (position
         relative); clear old top/bottom insets.
      **Viewport-centred** because the parent is full-bleed (0 padding) and the
      nav row is 100% wide → centre = viewport centre, not the gap between the
      columns. **Trade-off:** the headline + grid lift ~80–90px (they now
      bottom-align to row 1, not the viewport floor) — trim headline bottom
      padding if it crowds. Keep any future side padding on `.hero_main_layout`
      symmetric or the centring drifts.
- [ ] Slider asset gating (mobile load) — the bottom slider nav is `display:none`
      below tablet, but `display:none` does **not** stop `<img>`/`<video>`
      downloading (only CSS `background-image` is skipped). Move slider image URLs
      to `data-src` and swap to `src` on desktop only via `matchMedia` (breakpoint
      TBC, ~992px); likely also gate the `oa-configurator.js` init so it doesn't
      run on hidden markup. Need: confirm slider assets are `<img>` vs background
      image. (Background video stays on all viewports — decided.)

---

## Post-Launch

- [ ] A/B testing setup (Optimise or equivalent)
- [ ] "Are we in the conversation?" — visibility / PR audit
