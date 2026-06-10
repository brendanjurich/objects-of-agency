# Homepage Hero — Smooth Scale Flow (scoped `--hero-k` lever + bespoke divider clamp)

**Date:** 2026-06-10
**Status:** Design — pending implementation plan
**Scope:** Webflow Designer / Lumos custom CSS only. No repo files change.

---

## Context

The homepage hero was rebuilt as absolutely-positioned children inside a
full-bleed wrapper so the composition scales down as the viewport narrows
(benchmark: akercompanies.com). Most of it doesn't scale: the nav-button
thumbnails, the mid text block, and the divider line are all sized/positioned in
**raw `rem`**, and Lumos keeps the root font-size **flat at 16px** by design
(it scales *type* via per-variable `clamp()`s and *layout* via container queries
— never the root). So every raw-rem value is frozen at a constant pixel size,
while the cards scale steeply with viewport width. Different rates → the hero
reads as incoherent on resize: cards shrink, chrome stays put, the divider
decouples from the cards (its gap blows out 16px→131px over 1440→1024).

Aker looks cohesive because it runs a **fluid root**, so every rem in its hero
rides one gentle rate. We can't copy that: Lumos builds its type clamps on rem
assuming a flat root, so a fluid root would distort type sitewide.

**Goal:** a smooth, coherent scale flow for the homepage hero — the chrome
breathes gently as the window narrows, the divider stays locked to the cards —
achieved *without* touching the global root or Lumos's type system.

### Anchor rationale (why 1440 = full size)

The hero content **caps at 1440px**: cards are `max-width: 30rem`, so above ~1440
they're at full size and stop growing; text/buttons are fixed rem. From 1440 up
to a Studio Display's ~2560 the hero content is identical — only background bleed
grows. So 1440 is where content **rests at full size**, and the system holds full
size from there upward and only shrinks below. (If the cards' `max-width` is ever
raised so content keeps growing past 1440, move the cap accordingly.)

---

## Design

### 1. The lever — `--hero-k` (scoped, unitless, shrink-only)

Defined once on **`.hero_main_layout`** (common ancestor of the slider-nav, the
cards, the mid block):

```css
--hero-k: clamp(0.9, calc(0.81 + 100vw / 7570px), 1.0);
```

- `1.0` at ≥1440 (rest) → eases to ~`0.91` @768 → floors at `0.9`.
- Unitless factor, scoped to the hero — **does not touch the global root, so
  every Lumos type clamp is untouched.** The `7570px` slope and the `0.9`/`1.0`
  floor/ceiling are tune-on-staging knobs.
- Plateaus at 1440 like the divider clamp — the whole system rests above 1440 and
  breathes downward.

### 2. Elements on the lever (geometry only — fonts stay on Lumos clamps)

```css
.crisp-header__slider-nav-btn {
  width:  calc(3.5rem  * var(--hero-k));
  height: calc(2.75rem * var(--hero-k));
}
.hero_main_mid-text-wrap {
  max-width: calc(30rem * var(--hero-k));   /* reverts the interim 40ch */
}
```

Fonts are **not** multiplied by `--hero-k` — they keep Lumos's own fluid type
clamps. The lever scales *geometry* (button box, text-column width) only.

### 3. The divider — its own clamp (tracks the cards, not the gentle lever)

Replaces the current interim `bottom: 36vh` on **`.hero_main_mid`**:

```css
bottom: clamp(
  9.44 * 1rem,
  ((9.44 - ((28.5 - 9.44) / (var(--site--viewport-max) - var(--site--viewport-min)) * var(--site--viewport-min))) * 1rem
   + ((28.5 - 9.44) / (var(--site--viewport-max) - var(--site--viewport-min))) * 100vw),
  28.5 * 1rem
);
```

- Width-driven (Lumos fluid formula, `--site--viewport-min: 20` / `-max: 90`).
- **MAX = 28.5rem** at ≥1440 (resting position, ≈16px above the cards) → shrinks
  at the cards' rate so the gap holds across 1440→1024.
- A *steeper* curve than `--hero-k` on purpose: the divider has a geometric
  constraint (stay above the steeply-scaling cards), so it gets a bespoke clamp
  rather than the gentle lever. **MAX is the tuning knob; keep MIN ≈ MAX − 19** to
  preserve the tracking slope.
- Verified math (vpMin 20 / vpMax 90): 456px (28.5rem) @1440 · 343px (21.4rem)
  @1024 · floors at 9.44rem on tiny screens.

### 4. Untouched

Cards, logo (already breathes via Lumos display-font clamp), `.hero_main_layout`
geometry otherwise, the global root, all type. The nav-button **gap** stays as-is
(it's already font-relative, not frozen) — it joins the lever only if hero
spacing generally moves onto the lever later.

---

## Breakpoint behaviour (not seismic)

- **Divider:** the per-breakpoint `bottom`/position values already set in Designer
  for tablet/mobile **override** the desktop clamp automatically — the clamp
  governs desktop only, existing mobile positioning wins, no new work.
- **Lever:** `--hero-k` and the `calc()`s cascade into tablet/mobile but `k` floors
  at ~0.9, so worst case the chrome is ~90% size there. If that looks fine → do
  nothing. If a breakpoint wants full rem sizes back, add **one line** —
  `--hero-k: 1` on `.hero_main_layout` at that breakpoint resets the whole lever
  (buttons + text revert to plain rem). One reset per breakpoint at most.

---

## Implementation mechanism (confirm during planning)

`--hero-k` is a viewport-driven custom property, so it likely needs a small
page-level `<style>` embed defining `.hero_main_layout { --hero-k: … }` plus the
`calc()`s, rather than the Designer style panel (which may not express
`calc(rem * var())`). The divider clamp the user has already applied via Lumos's
clamp-value workflow, so that path is proven. Confirm the cleanest application
route (Designer custom values / Webflow variables / scoped embed) before building.

---

## Verification (staging, resize 1440 → 1024, plus 1920 / ~2560)

1. **≥1440:** hero content unchanged from today (rest); only background bleed
   grows toward 2560.
2. **1440 → 1024:** nav buttons + text-wrap breathe gently *together*; divider
   holds its ~16px gap above the cards (no blow-out).
3. **Type** unchanged at every width (Lumos clamps untouched).
4. **Nothing else** in the hero shifts; cards scale as before.
5. **Tablet/mobile:** confirm chrome at floored size looks acceptable; add a
   single `--hero-k: 1` reset on any breakpoint that doesn't.
