---
name: configurator_state
description: Current state of the ViewFinder product configurator — what's built, what's pending, DOM contract
type: project
---

Product configurator is in active development on the staging site (oa-v5.webflow.io/product/viewfinder-xen and /viewfinder-cr).

**Current live tag:** oa-configurator.js @ v1.0.18 (pinned separately from oa-global.js for stability)

**What's built and working:**
- Cascading slider (image gallery) synced to radio button selection
- Radio → slider: clicking a radio moves the slider to the matching slide
- Slider → radio: navigating the slider checks the correct radio and updates visual state via `dispatchEvent(change)`
- Keyboard arrow keys: scoped to the hovered/focused slider only via mouseenter/mouseleave + focusin/focusout (no tabindex on wrapper)
- Focus ring: shows on `.form_ui_input` when radio is tabbed to, using `:has(input:focus-visible)`
- Size slider: side strips hidden (only centre slide visible) for SVG line drawing display
- Radio IDs: deduped via `fixRadioIds()` for Sizes, Top-Material, Timber, Anodised-Finish
- Pricing engine: additive (base price + per-selection modifiers), formatted via Intl.NumberFormat
- Summary updater: live updates #summary-size, #summary-top-material, #summary-timber, #summary-anodising

**Pending:**
- Image DOM swap (KeyShot renders swapped on material selection) — design TBD, see feature/configurator branch
- Quote form integration
- Move oa-configurator.js from sitewide embed to page-level embed (product pages only)

**Key class/ID names:**
- `form_ui_item` — radio card wrapper
- `form_ui_input` — custom visual radio button element
- `form_ui_label` — label text span
- `config_base_price` — hidden element, raw base price number from CMS
- `config_from_price` — visible price display, updated by JS
- `config_price_prefix` — static "From $" prefix, never touched by JS
- `config_summary_value` spans: `#summary-size`, `#summary-top-material`, `#summary-timber`, `#summary-anodising`

**Radio input names:** Sizes, Top-Material, Timber, Anodised-Finish

**Why:** jsDelivr caches branch URLs, so switched to git tags for delivery. CSS and JS may be on different tag numbers — check docs/architecture.md for current versions.
