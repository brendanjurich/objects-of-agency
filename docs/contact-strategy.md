# Contact Strategy

<!-- created: 2026-06-04 -->

## Architecture: Two-Tier

### Tier 1 — Homepage section

- Display email address with **copy-to-clipboard** on click
- Text swaps to `"Copied"` for ~1.5s on trigger, then reverts
- Single CTA linking to `/contact` — label: **“Start a Project Brief”** (not “Contact Us”)
- No form. No fields. Absolute minimum friction.

### Tier 2 — Dedicated `/contact` page

- Framed as a project brief intake, not a contact form
- Language tuned to the architectural/design trade throughout
- Submission triggers a response confirming receipt + expected turnaround (e.g. “We’ll respond within 48 hours”)

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