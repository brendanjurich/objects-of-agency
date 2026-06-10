# Homepage Hero Scale Lever — Implementation Plan

> **For agentic workers:** This plan is executed in **Webflow Designer + page custom code**, not the repo. There is no test suite; verification is measured on staging (`oa-v5.webflow.io`) via chrome-devtools. Steps use checkbox (`- [ ]`) syntax for tracking. No git commits — the only repo artifact is the spec.

**Goal:** Make the homepage hero scale as one smooth, coherent flow — nav buttons and text-column breathe gently on a scoped `--hero-k` lever, the divider tracks the cards via its own clamp — without touching the global root or Lumos's type system.

**Architecture:** A single page-level `<style>` embed on the homepage defines `--hero-k` on `.hero_main_layout` and applies the four rules. The embed is the single source of truth so the interrelated values are tunable in one place; interim Designer overrides are removed to avoid conflicts. All units are viewport-driven clamps/`calc()`; nothing changes the 16px root.

**Tech Stack:** Webflow (Lumos framework v2.2.1), CSS custom properties + `clamp()`/`calc()`, chrome-devtools for measured verification.

**Spec:** [docs/superpowers/specs/2026-06-10-homepage-hero-scale-lever-design.md](../specs/2026-06-10-homepage-hero-scale-lever-design.md)

---

## File / surface map

This touches **no repo files**. The surfaces are:

- **Homepage custom code** (Webflow → Homepage → Page Settings → Custom Code → *Before `</body>` tag*) — the new `<style>` embed. Placed in the footer so it loads after Webflow's stylesheet and wins specificity ties.
- **`.hero_main_mid-text-wrap`** (Designer class) — remove the interim `max-width: 40ch`.
- **`.hero_main_mid`** (Designer class) — remove the interim `bottom: 36vh`.

---

## Task 1: Add the hero-scale `<style>` embed to the homepage

**Surface:** Homepage → Page Settings → Custom Code → Before `</body>` tag

- [ ] **Step 1: Paste the embed**

```html
<style>
/* Homepage hero — smooth scale flow.
   Spec: docs/superpowers/specs/2026-06-10-homepage-hero-scale-lever-design.md
   --hero-k: gentle shrink-only breath, 1.0 at >=1440 -> ~0.9 floor.
   Divider: own steeper clamp that tracks the cards. */

.hero_main_layout {
  --hero-k: clamp(0.9, calc(0.81 + 100vw / 7570px), 1.0);
}

.crisp-header__slider-nav-btn,
.crisp-header__slider-nav-btn.is--current {
  width:  calc(3.5rem  * var(--hero-k));
  height: calc(2.75rem * var(--hero-k));
}

.hero_main_mid-text-wrap {
  max-width: calc(30rem * var(--hero-k));
}

.hero_main_mid {
  bottom: clamp(
    9.44 * 1rem,
    ((9.44 - ((28.5 - 9.44) / (var(--site--viewport-max) - var(--site--viewport-min)) * var(--site--viewport-min))) * 1rem
     + ((28.5 - 9.44) / (var(--site--viewport-max) - var(--site--viewport-min))) * 100vw),
    28.5 * 1rem
  );
}
</style>
```

Note the `.is--current` selector is included explicitly — the active thumbnail has its own two-class rule (`.crisp-header__slider-nav-btn.is--current { width: 3.5rem }`), so without matching that specificity the active button would not scale.

- [ ] **Step 2: Save** the page settings (do not publish yet — removing the interim Designer values comes first).

---

## Task 2: Remove the interim Designer overrides

These were experimental and would otherwise sit alongside the embed and confuse future tuning. The embed (footer) would win on source order, but remove them so there's one source of truth.

- [ ] **Step 1: Clear the text-wrap interim value**
On class **`.hero_main_mid-text-wrap`**, remove `max-width: 40ch`. (The embed now sets `max-width: calc(30rem * var(--hero-k))`.)

- [ ] **Step 2: Clear the divider interim value**
On class **`.hero_main_mid`**, remove `bottom: 36vh`. (The embed now sets the `bottom` clamp.)

- [ ] **Step 3: Confirm no other `bottom`/`max-width` overrides** remain on those two classes at the Desktop breakpoint that would shadow the embed. (Leave tablet/mobile breakpoint values alone — those are intentional per-breakpoint positions and should override.)

---

## Task 3: Publish to staging

- [ ] **Step 1: Publish** the site to `oa-v5.webflow.io`.

- [ ] **Step 2: Hard-refresh** `https://oa-v5.webflow.io` to clear cached CSS.

---

## Task 4: Verify desktop scaling (measured on staging)

Verification is done with chrome-devtools: navigate to staging, resize, and read computed values. The divider gap is height-invariant, so any viewport height is fine; use height 900 for consistency.

- [ ] **Step 1: Measure at 1440×900** — resize, then evaluate:

```js
() => {
  const btn = getComputedStyle(document.querySelector('.crisp-header__slider-nav-btn'));
  const tw  = getComputedStyle(document.querySelector('.hero_main_mid-text-wrap'));
  const r = (s)=>document.querySelector(s).getBoundingClientRect();
  return {
    vw: innerWidth,
    heroK: getComputedStyle(document.querySelector('.hero_main_layout')).getPropertyValue('--hero-k').trim(),
    btnW: btn.width, twMaxW: tw.maxWidth,
    dividerBottom: getComputedStyle(document.querySelector('.hero_main_mid')).bottom,
    gap: +(r('.hero_feed_grid').top - r('.divider_horizontal-home').top).toFixed(1),
  };
}
```

Expected: `heroK` ≈ `1`, `btnW` ≈ `56px`, `twMaxW` ≈ `480px`, `dividerBottom` ≈ `456px`, `gap` ≈ `16px`.

- [ ] **Step 2: Measure at 1024×900** (same script). Expected: `heroK` ≈ `0.945`, `btnW` ≈ `52.9px`, `twMaxW` ≈ `453px`, `dividerBottom` ≈ `343px`, **`gap` ≈ `16px` (held — the headline result)**.

- [ ] **Step 3: Measure at 1920×900** (same script). Expected: `heroK` = `1` (capped), `btnW` ≈ `56px`, `twMaxW` ≈ `480px`, `dividerBottom` ≈ `456px`, `gap` ≈ `16px`. Confirms no growth / desync above 1440.

- [ ] **Step 4: Confirm type is unchanged** — the hero font sizes should read identically to before the change at each width (Lumos clamps untouched). Spot-check `.hero_main_mid-text` font-size matches its pre-change values (18px @1440, ~17.26px @1024).

- [ ] **Step 5: Visual pass** — screenshot 1440 and 1024; confirm nav buttons + text breathe together and the divider sits a consistent ~16px above the cards at both, with nothing else shifted.

---

## Task 5: Tune the knobs (only if a measurement or the look is off)

All three knobs are independent:

- [ ] **Divider resting gap** — if ~16px is too tight/loose at 1440, change `28.5` (the clamp MAX) in the embed, and set the MIN to `MAX − 19` to keep the tracking slope. Re-run Task 4 Step 1–2.
- [ ] **Breath amount** — if the gentle scale is too subtle/strong, change the `7570px` slope in `--hero-k` (smaller number = more shrink). Re-check button/text at 1024.
- [ ] **Floor** — if buttons/text get too small at the low desktop edge, raise the `0.9` floor in `--hero-k`.

---

## Task 6: Tablet / mobile breakpoint check

- [ ] **Step 1: Resize to 991 and 767** on staging; visually check the nav buttons + text-wrap. `--hero-k` floors at ~0.9 there, so they'll be ~90% size.

- [ ] **Step 2: If a breakpoint looks off**, add a one-line reset on `.hero_main_layout` at that Webflow breakpoint: `--hero-k: 1` (reverts buttons + text to plain rem at that breakpoint and below). Do this in Designer custom value or extend the embed with the breakpoint's media query.

- [ ] **Step 3: Confirm the divider** — the per-breakpoint `bottom`/position values already set for tablet/mobile should override the desktop clamp. Verify the line sits where intended on each breakpoint; no new work expected.

---

## Self-review notes

- **Spec coverage:** `--hero-k` definition (Task 1), nav buttons + text-wrap on lever (Task 1), divider own clamp (Task 1), interim reverts (Task 2), shrink-only/anchor behaviour verified (Task 4 incl. 1920), breakpoint handling (Task 6), tuning knobs (Task 5). All spec sections covered.
- **Specificity:** `.is--current` handled explicitly (Task 1) — the one non-obvious failure mode.
- **No placeholders:** every CSS value and measurement is concrete; expected numbers derived from the spec's verified math.
