# Contact Strategy

<!-- created: 2026-06-04 -->
<!-- revised: 2026-08-09 — email surface + obfuscation decided; copy-to-clipboard dropped -->

## Architecture: Two-Tier

### Tier 1 — The `• oa CTA` component

The ambient contact surface. One component, reused wherever contact belongs —
currently `/about`, and `/contact` alongside the long-form brief. It carries
**two** controls and no form:

- **“Project Brief”** → links to `/contact`. Label is deliberate — never “Contact Us”.
- **“Email Direct”** → the e-mail address, assembled by JS at interaction time (see below).

**Copy-to-clipboard is not used.** The earlier plan here specified a copy button
with a ~1.5s `"Copied"` swap. It was assessed 09-08-2026 against Osmo Supply's
production component and dropped. Two reasons, in order:

1. It solves nothing on security. A copy button holds the address in plaintext
   in the served HTML exactly as a `mailto:` does — a harvester reads a `<span>`
   as easily as an `href`. It is a UX pattern wearing a security costume.
2. It costs the `mailto:` affordance, and browsers already provide the copy
   gesture natively (right-click → *Copy Email Address*) once the link is real.

### Tier 2 — Dedicated `/contact` page

- Framed as a project brief intake, not a contact form
- Language tuned to the architectural/design trade throughout
- Submission triggers a response confirming receipt + expected turnaround (e.g. “We’ll respond within 48 hours”)
- Also carries the Tier 1 CTA component, so Email Direct is available beside the long form

-----

## E-mail Exposure — how the address is published

**The address never appears in the served HTML.** Decided 09-08-2026.

The Designer holds it split on a pipe, as a custom attribute on the Button Main
instance — `data-oa-email="hello|objects.agency"`. No `@` exists for a
harvester's regex to match. `initEmailDirect()` in `src/js/oa-global.js` rejoins
the parts and writes the `mailto:` href, but only on `pointerenter`, `focusin`
or `touchstart` — so a headless harvester that executes JS but never interacts
still gets nothing.

Two layers, both of which blocked 100% of 698 harvesters in Spencer Mortensen's
2026 honeypot study (JS concatenation, and user-interaction trigger); layering
them is his own recommendation, since a harvester must break both.
Ref: <https://spencermortensen.com/articles/email-obfuscation/>

**Rules that follow from this:**

- **Never set a Designer link to a `mailto:`.** That reinstates the exposure in
  one click and leaves no trace in the repo. The Email Direct link prop points
  at `/contact` — that is its no-JS fallback, not its real destination.
- Never place the address in visible or hidden text on any element.
- The site degrades gracefully with JS off (the FOUC pre-hide is gated on
  `html.w-mod-js`), so the fallback link is genuinely reachable — keep it useful.

-----

## Page Architecture

|Page      |Purpose                              |Schema                          |
|----------|-------------------------------------|--------------------------------|
|Homepage  |Brand surface + ambient contact      |`Organization` + `LocalBusiness`|
|`/contact`|Structured enquiry intake            |`ContactPage`                   |
|`/about`  |Studio story, founder, Perth workshop|`Organization` (detailed)       |

`/contact` must exist as a real crawlable URL — not just an anchor on the homepage — for schema and AEO indexing.

-----

## Form Fields — `/contact`

Include:

- Name + Practice / Studio
- Role: `Architect / Interior Designer / Private Client / Trade / Other`
- Project type: `Residential / Commercial / Hospitality / Mixed`
- Pieces of interest (multi-select from catalogue)
- Timeline / required delivery window
- Volume / quantity indication
- How did you hear about us

Exclude:

- Budget (too early, feels transactional)
- Phone number (designers prefer async)
- Any field without a clear reason to exist

-----

## Copy Principles

Every label is a brand touchpoint. Write conversationally:

|Avoid                     |Use instead            |
|--------------------------|-----------------------|
|“Contact Us”              |“Start a Project Brief”|
|“Required delivery window”|“What’s your timeline?”|
|“Submit”                  |“Send Enquiry”         |
|“Company”                 |“Practice / Studio”    |

-----

## Stretch Goal — Trade Programme

Consider a parallel **“Apply for Trade Account”** path for repeat professional buyers:

- Architects and designers are accustomed to trade accounts (Living Edge model)
- Gate BIM downloads, spec sheets, and trade pricing behind account access
- Stronger long-term CRM play than a one-off contact form
- Signals the studio takes the professional relationship seriously

-----

## SEO / AEO Notes

- Separate `/contact` page required — section anchor on homepage is not indexable as a distinct entity
- `ContactPage` schema on `/contact`, `Organization` schema on `/about`
- “About Us” is now considered authority-verification infrastructure for AI answer engines — `/about` is non-optional