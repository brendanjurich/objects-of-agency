# Remaining — Launch Checklist

Ordered by dependency. Work top-to-bottom where possible: foundation before SEO, content before schema, features last.

---

## ⚠️ Critical — Domain Cutover

- [ ] **Swap the web manifest off the staging domain.** `src/icons/oa-site.webmanifest`
      hardcodes `id`, `start_url` and `scope` as absolute
      `https://oa-v5.webflow.io/` URLs. They **must** be absolute — the manifest is
      served cross-origin from jsDelivr, so relative values would scope the PWA to
      the CDN and break it. On custom-domain go-live: edit those three fields, re-tag,
      bump the four `@v1.0.X` URLs in `02-brand/oa-logo/icons/webflow-head-code.html`
      (command centre), re-paste into Webflow → Project Settings → Custom Code → Head,
      publish. **If this is missed the PWA installs against the staging domain** —
      silent failure, nothing visibly breaks on the site itself.

### Context: the icon system is Webflow-bypassed

Webflow's Site Settings **Favicon/Webclip fields cannot be cleared once set.** They
currently hold duplicate copies of the *current* icon artwork (deliberate — if a tag
ever leaks past the neutraliser it renders correct art, not stale). Consequence:

- The **served HTML always contains ~6 Webflow icon tags** from
  `cdn.prod.website-files.com`. This is expected, not a regression.
- A runtime script in the head code strips them, matching on the
  `website-files.com` **host** (not filenames), so new uploads there are handled
  automatically.
- **Audit the post-JS DOM and the network log, never the served HTML.** Pass = 0
  Webflow icon tags remaining in the DOM, and only jsDelivr icons fetched.
- The light/dark favicon swap is **JS-driven on a `matchMedia` listener**, because
  neither Chromium nor WebKit evaluates `prefers-color-scheme` inside an SVG favicon
  (Firefox is the only engine that does). The script also removes the `.ico` link at
  runtime so the SVG wins unambiguously. Don't "simplify" this back to the pure-CSS
  approach — it was tested and does not work.

---

## ⚠️ Critical — The brief pipeline runs on free tiers

**A paused Supabase project loses briefs silently.** `brief-intake` inserts the row
before it mails anything, so if the database is unreachable the insert fails, the
function returns non-200, and the visitor sees "That didn't send." Nothing is
queued and nothing retries. You would not know a brief had been attempted — there
is no alert on this path, and the studio email is only sent *after* a successful
insert. This is the one failure in the whole site that destroys work a real person
did rather than just looking wrong.

Free projects pause after **7 days** without activity.
`.github/workflows/keepalive.yml` pings every third day, which is the right
cadence. The risk is not the cadence — it is that every link in the chain is
itself free and unmonitored.

### The chain that has to hold

| Link | Fails when | Today |
|---|---|---|
| GitHub Actions cron | repo sits ~60 days with no activity — Actions **disables scheduled workflows** | active, green 10-09 / 13-09 / 16-09 |
| `ping` reaches Postgres | function returns 200 without touching the database | fixed — now does a head-count on `briefs` |
| Supabase project awake | 7 days idle | awake |
| `brief-intake` insert | project paused, or schema drift | no alerting either way |

The GitHub link is the weak one, and it gets weaker exactly as the site
stabilises: the quieter this repo goes, the more likely Actions switches the cron
off, and the pause follows about a week later.

### Actions

- [ ] **Deploy the hardened ping.** Written, not deployed:
      `supabase functions deploy ping --project-ref nleekoypvxoagnwiqtzz --no-verify-jwt`.
      Until this ships, the keep-alive only proves the Functions runtime is alive.
- [ ] **Confirm the retention job is actually scheduled.** `delete_stale_briefs()`
      exists and `20260909000000_briefs.sql` schedules it nightly — but only inside
      an `if exists (… pg_extension where extname = 'pg_cron')` guard. If pg_cron
      was not enabled when that migration ran, the block was a silent no-op and
      **nothing is deleting anything**, while the ack email and the privacy policy
      both promise twelve months. Check:
      `select * from cron.job where jobname = 'delete-stale-briefs';`
- [ ] **Put a reminder on the GitHub cron.** A calendar entry every ~45 days to
      check the workflow is still enabled, or a second independent trigger.
      `workflow_dispatch` is already on the workflow, so a manual run is one click.
- [ ] **Decide the paid-tier trigger** (below) rather than discovering it.

### Cost / benefit — when to go paid

Verify current pricing before acting; the figures below are indicative.

| Option | Cost | Buys | Cost of not doing it |
|---|---|---|---|
| Stay free + hardened ping | £0 | removes the Functions-only blind spot | still exposed to Actions disabling the cron |
| Calendar reminder | £0 | covers the weakest link | a missed check ≈ one paused project |
| **Supabase Pro** | ~US$25/mo | **no pause at all** — the whole chain above becomes irrelevant, plus daily backups and 7-day PITR | one lost commission enquiry costs more than a year of this |
| Resend paid | ~US$20/mo | >100 emails/day | free tier is 100/day, 3,000/mo — nowhere near binding yet |

**Recommendation:** stay free through pre-launch, and treat **the first real
enquiry from a studio** as the trigger for Supabase Pro — not a date, not traffic.
The moment a brief in that table represents actual revenue, £25/mo to remove an
entire class of silent data loss stops being a judgement call. Resend can stay
free well past that point; it is volume-bound, not reliability-bound, and 100/day
is far beyond the expected rate.

Until then the honest posture is: the keep-alive is real and working, but it is
three free services in a trench coat, and the failure mode is losing a brief
without ever knowing it arrived.

---

## Foundation

- [ ] Semantic HTML & structure audit
- [ ] `<main>` landmark on `/` and `/all-products` — `/about` has `main#main`
      (done 2026-08-02). Neither other page has one: their `#main` skip targets
      are hero sections, not content wrappers, so each needs the sections wrapped
      in a Div tagged **Main** first, with the `main` ID moved onto that wrapper
      (ids must stay unique — remove it from the hero). `/all-products` also
      reverted its `<main>` tag to `section` when its ID was renamed `top` → `main`.
- [ ] Nav locale switcher — decide whether a language dropdown belongs in the nav
      while the site is single-locale (EN-AU). It is **not** debris: the dropdown
      wrapping the "This is some text inside of a div block." placeholder contains
      a `LocalesWrapper`. Its dangling `aria-labelledby="w-dropdown-toggle-2"`/`-6`
      exists because Webflow emits the dropdown list but not its toggle when there
      is one locale. Hiding the switcher clears both, plus the placeholder text.
- [ ] Section heading pass — a label that is structurally a heading must be a
      **Heading element**, not a Rich Text (Webflow Rich Text can never carry a
      heading tag; see DECISIONS 2026-08-02). `/about` done; audit the other pages.
- [ ] Aria labels — all interactive elements labelled. Nav search inputs done
      2026-08-02 (`aria-label="Search"`, duplicate `id="search"` removed).
- [ ] Product slider keyboard focus (deferred) — CSS-only `:focus-visible` worked in
      Chrome but broke in Safari (Swiper's a11y module controls `tabindex` on slides
      and redirects Tab through its dots/arrows, firing the ring out of order).
      Fix: disable/reconfigure Swiper's keyboard module so native Tab order wins, set
      correct `tabIndex` on `.clickable_link` in slides, then re-add the focus-ring
      rule (scale + shadow + outline on `.card_product_visual`, removed at v1.0.36).
      Test Chrome + Safari. Edit `src/js/oa-global.js`.

---

## Legal & Content

- [ ] **Contact page — `/contact` returns 404** while the nav and footer link to it
      on every page. Build it, or point those links elsewhere until it exists.
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

- [ ] **iPad portrait: the hero video is cropped to ~37% of the frame.** The mobile
      gate is `(max-width: 767px) and (orientation: portrait)`, so a 768×1024 iPad
      clears it by one pixel and takes the **2048×1024 (2:1)** desktop encode. With
      `object-fit: cover` into a 768-wide, full-height slot that shows **768 of 2048
      px — 37.5% of the frame**, centre-cropped; the other ~62% is thrown away. Not
      a bug — a consequence of the gate sitting on Webflow's breakpoint — but the
      composition was never judged at that crop. **Look at it on a real iPad first**,
      then choose: widen the portrait gate to ≤991 (the vertical file is only 720px
      wide, so a 768@2dpr iPad would upscale ~2.1× — probably worse), cut a third
      tablet-framed encode, or accept it and compose the shot to survive a centre
      slice. Same question applies to the hold image, which is cropped identically.

---

## Post-Launch

- [ ] A/B testing setup (Optimise or equivalent)
- [ ] "Are we in the conversation?" — visibility / PR audit
