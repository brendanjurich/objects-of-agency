# Remaining — Launch Checklist

Ordered by dependency. Work top-to-bottom where possible: foundation before SEO, content before schema, features last.

---

## Foundation

- [ ] Semantic HTML & structure audit
- [ ] Aria labels — all interactive elements labelled

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

---

## Post-Launch

- [ ] A/B testing setup (Optimise or equivalent)
- [ ] "Are we in the conversation?" — visibility / PR audit
