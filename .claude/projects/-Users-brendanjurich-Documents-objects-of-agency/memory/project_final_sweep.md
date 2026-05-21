---
name: final_sweep_tasks
description: Known deferred tasks to capture in the final site debug/sweep pass
type: project
---

## Keyboard accessibility — product slider (deferred)

**Task:** Implement proper keyboard focus state on product slider cards via Swiper `a11y` JS config.

**Why:** CSS-only `:focus-visible` approach was attempted but Swiper's a11y module controls `tabindex` on slides and redirects Tab through its own controls (dots, arrows). In Safari this caused the focus ring to fire on unintended elements and jump out of order. Chrome worked perfectly with the CSS rule but Safari did not. Deferred to avoid shipping a known-broken state.

**How to apply:** When doing the final sweep, add to the JS task list:
- Disable or reconfigure Swiper's keyboard module so native Tab order takes over
- Set correct `tabIndex` on `.clickable_link` within slides
- Re-add the CSS focus ring rule (scale + shadow + outline on `.card_product_visual`) once tab order is correct
- Test Chrome + Safari

**File to edit:** `src/js/oa-global.js` (or wherever the product slider Swiper init lives)
**CSS rule ready to restore** — was in `oa-styles.css`, removed at `v1.0.36`
