I've fully diagnosed the issue. Here's exactly what's happening and why Claude Code's fix keeps getting overridden:

**The Problem — in `oa-all-products.css` (v1.0.53)**

There are two rules fighting each other:

```css
/* Rule 1 — GENERIC (this is the culprit) */
[data-filter-target][data-filter-status="active"] .button_main_element {
  border-bottom-color: var(--_theme---text) !important;
}

/* Rule 2 — SPECIFIC override (this never matches!) */
.all_tables_title-wrap [data-filter-target][data-filter-status="active"] .button_main_element {
  border-bottom-color: #d66740 !important;
}
```

**Why Rule 2 never works:** The selector targets `.all_tables_title-wrap`, but **that class does not exist in the DOM**. The actual parent wrapper class is `.all_categories_title-wrap`. So Rule 2 is a dead rule that never matches anything, and Rule 1 applies instead — which resolves `var(--_theme---text)` to `#1d1d1f` (dark/black).

**The Fix**

In `oa-all-products.css`, change Rule 1 to use the correct color directly:

```css
[data-filter-target][data-filter-status="active"] .button_main_element {
  border-bottom-color: #d66740 !important;
}
```

And either delete Rule 2 (since it's redundant now), or if you want to keep it as a scoped override for a future `.all_tables_title-wrap` element, fix its selector to `.all_categories_title-wrap`.

That's the one-line change in your GitHub repo at `src/css/oa-all-products.css`. The `!important` on Rule 1 is what keeps overriding anything Webflow or Claude Code tries to set — because it's loaded after the Webflow stylesheet and targets the same element with `!important`.