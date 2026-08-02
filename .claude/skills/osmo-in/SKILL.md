---
name: osmo-in
description: Use when an osmo.supply resource is being brought into the site — Brendan pastes Osmo's "AI instructions", a CSS + JS block, or Copy-to-Webflow markup, with or without a framing sentence. Also fires on "osmo-in", "here's the osmo code", "adapt this osmo component", or any third-party Webflow component arriving as code to absorb. Audits the stock resource against house rules (no CDN GSAP, rem over em, the Designer owns the design knobs, --ease-oa), adapts it into src/, and hands the styling knobs back to the Webflow Designer.
---

# Osmo in

Absorbing a resource from **osmo.supply** into this site. Brendan inspects the
component on a staging testing ground, pastes the Webflow elements in (or rebuilds
them natively), then pastes Osmo's CSS + JS here. This is the procedure from that
paste to a shipped file.

**You have standing authority to rewrite, simplify, rename, split and delete their
code.** Stock Osmo code has no preservation claim — it is a starting point, not a
dependency, and it was written for a demo page, not this site. Don't ask permission
per change; the Step 1 audit *is* the disclosure. Never keep a construct just because
Osmo shipped it: config objects with one call site, demo scaffolding, dead branches,
and `data-*` attributes nothing consumes all go.

The corollary: **"Osmo does it this way" is not a reason.** Every line that survives
survives on its own merit, in this codebase's terms.

## Ground truth

| What | Where |
|---|---|
| Best-adapted precedent (JS + CSS) | `src/js/oa-infinite-grid.js`, `src/css/oa-infinite-grid.css` |
| Opposite-branch precedent (their classes dropped) | `src/js/oa-all-products.js` — `initBasicFilterSetupMultiMatch` |
| Where a style belongs — Webflow vs repo | `docs/CSS-ARCHITECTURE.md` |
| Hard constraints + durable recipes | `docs/REFERENCE.md` |
| Deploy, load order, GSAP/Lumos facts | `CLAUDE.md` |
| Past gotchas, append-only | `docs/DECISIONS.md` |

**Lumos ≠ Osmo.** Lumos owns the build system — `u-` utilities, `--_…---` variables,
type clamps, the sliders. Osmo is a vault of individual components. Only the slider
*easing* is Osmo-derived. Never call a Lumos slider an Osmo one.

## Step 0 — Scope and name

Establish before reading their code closely:

- **Sitewide or page-level?** Page-level is the default for an Osmo component.
- **Which page / section does it mount on?**
- **Pasted wholesale, or rebuilt natively in the Designer?** This decides the
  class-name rule in Step 2 — ask if it isn't obvious.

Name it `oa-<feature>.js` — kebab, feature-scoped (not layer-scoped), flat in
`src/js/`. A paired `src/css/oa-<feature>.css` **only if the component is
page-level**; sitewide CSS goes into a new commented section of `oa-styles.css`
instead. A CSS file only exists when the feature needs one.

If the mount point is genuinely unknown, ask. Otherwise infer and state the assumption.

## Step 1 — Audit → **Gate**

Report before writing anything. Keep it short and in this shape:

- **What it does** — plain terms, one paragraph. No jargon left untranslated.
- **What it collides with** — every house-rule violation found, each naming the rule
  it breaks.
- **What I'll change and why** — the adaptation list.
- **What goes to the Designer** — preview of the Step 3 handoff.
- **Flags** — anything that isn't an execution call:
  - It changes IA or content, not just visuals → that's a strategy decision, not
    ours. Drop `FLAG-YYYY-MM-DD-topic.md` into the command centre's `inbox/`
    (see `WORKFLOW.md`) and say so.
  - It duplicates something the site already has → **merge into the existing
    initialiser, don't ship a second copy.**
  - The component is heavier than what it replaces for a marginal visual gain →
    say so plainly.

**Gate: stop here. Do not write files until Brendan says go.**

## Step 2 — The rules

### JavaScript

- **Never load their CDN GSAP.** Reuse `window.gsap` and `window.Observer` — Webflow's
  native GSAP integration provides both (Observer ships via ScrollTrigger). A second
  `window.gsap` clobbers the top-level `CustomEase` registration in `oa-global.js`.
  Guard and skip:

  ```js
  const Observer = window.Observer;
  if (!window.gsap || !Observer) {
    console.warn('[oa-<name>] gsap/Observer unavailable — skipping init.');
    return;
  }
  gsap.registerPlugin(Observer); // no-op if Webflow already registered it
  ```

- **Delete any `gsap.defaults(...)`, `gsap.registerEase` or global ease they set.**
  Osmo bundles rewrite tween defaults site-wide — silently, everywhere.
- Init on `DOMContentLoaded`. Use a `readyState` guard only if the file may load after
  parse; `Webflow.push` only when it must run after IX2 has bound.
- **Where double-init is possible, own the flag** — `el.dataset.oa<Name>Init`, never a
  vendor's key. A stray leftover embed can claim theirs and block us (`oa-slider.js`).
  A component with a single mount and no competing initialiser doesn't need one —
  `oa-infinite-grid.js` has none. Don't add ceremony that isn't earned.
- **Delegate** on the container or `document`, with `closest` + `contains`. CMS lists
  get regenerated; direct per-node binding rots.
- Data attributes namespaced `data-<feature>-init` (the mount point) and
  `data-<feature>-status` (state written back for CSS to read). This is how JS and CSS
  stay decoupled. **Delete every attribute nothing consumes** — verify against the
  loaded stylesheets and IX2, don't assume.
- **Detect input by capability, never by width** — `matchMedia('(hover: hover) and
  (pointer: fine)')`, `matchMedia('(pointer: coarse)')`, `e.pointerType`. A breakpoint
  calls an iPad Pro "desktop" and a touchscreen laptop "tablet". (A breakpoint is
  still fine for a genuine *layout-region* decision — see the 767px 2D-drag region in
  `oa-infinite-grid.css`. The ban is on inferring input from width.)
- **Reduced motion is a branch, not a kill.** Snap instead of tween (`gsap.set` over
  `gsap.to`), keep the end state, keep the feature.
- **Width-gate resize handlers** — mobile browsers fire `resize` on URL-bar show/hide
  while scrolling, and a naive rebuild resets the component mid-gesture.
- `{ passive: true }` on scroll; `{ once: true }` on one-shots; `IntersectionObserver`
  early-return so off-screen work is skipped.
- **Cleanup is disposal and idempotency, not `removeEventListener`** — `observer.kill()`,
  `gsap.ticker.remove(fn)`, `clearTimeout`, instance stashes nulled. This site is not
  an SPA; there are zero `removeEventListener` calls in the repo and that's correct.
- `console.warn('[oa-<name>] …')` for real failures only. **No `console.log` ships.**
- **Match the file you're in.** `oa-homepage.js` is `var` + `function(){}`; the newer
  files are `const` + arrows. Prettier: 2-space, single quotes, semicolons.

### CSS — the split

This is the rule that lets Brendan iterate on publish instead of cycling through the
repo. The repo layer loads *after* Webflow's CSS and wins at equal specificity, so
anything it declares is stolen from the Designer.

**The repo layer keeps only what the Designer panel cannot express:**
`touch-action`, `[data-<feature>-status]` state rules, `will-change` /
`backface-visibility`, the absolute positioning the JS depends on, the
`:is(.wf-design-mode, .wf-editor)` preview block, `@media (prefers-reduced-motion)`.

**Everything else is deleted from their CSS and handed to the Designer:** width,
height, padding, margin, `aspect-ratio`, `border-radius`, colours, typography, section
height. Leave a comment where a knob used to be, naming who owns it now —
`/* width / padding / aspect-ratio: set in the Webflow Designer (rem) */`.

> **Never hardcode a dimension in the repo layer that you want the Designer to
> control.** Their `height: 100%` silently beat a Designer `aspect-ratio` once
> already, and it read as an image-distortion bug, not a cascade bug.

Then:

- **rem over em.** `em` only where the value must track *local* type — underline
  thickness, a gap expressed in ems. Never `em` on a Lumos fluid-type element: the
  value drifts with the type scale as the clamp resolves.
- **No `clamp()`.** Lumos owns fluid type in the Designer against a flat 16px root.
  Strip their fluid type and hand it to a `u-text-style-*` utility. A raw Webflow text
  element has no `line-height` and will mis-centre until it gets one.
- `px` is fine for mechanical values — blur radii, transform offsets, breakpoints.
- **`svh`, never `dvh`.**
- **Rename their tokens into the `oa` namespace.** `--ease-osmo` → `--ease-oa` is the
  precedent; the rename signals the value is ours to retune. Retune it if it doesn't
  suit — the site curve is `cubic-bezier(0.22, 0.36, 0.1, 1)` because Osmo's pure curve
  read as lag on touch.
- Consume Lumos variables (`--_theme---text`, `--focus--width`), never redefine them.
- **Specificity ladder:** use a Webflow/Designer hook → out-specify with a descendant
  or compound selector → **only then `!important`, with a comment naming the inline
  style it fights.** A runtime writing inline styles is the only good reason.
- **Ship a `wf-design-mode` preview block** whenever the JS doesn't run in the canvas —
  otherwise Brendan edits an invisible or collapsed element.
- **Class names:** markup pasted wholesale → keep their BEM as-is
  (`.infinite-grid__card`). Rebuilt natively in the Designer → **drop their class names
  entirely** and target the project's Webflow classes (the all-products filter went
  this way — the shipped CSS targets cards by attribute and project class, never the
  demo's `.filter-btn`).

### The header comment is mandatory

Every adapted file opens with the banner naming the source resource and enumerating
**differences from stock**. This is what makes the next session's audit possible.
Format, verbatim from `oa-infinite-grid.js`:

```js
/* ============================================================
   OSMO — <Component Name> (<variant>)
   ------------------------------------------------------------
   Adapted for Objects of Agency from osmo.supply's "<exact
   resource name>". Differences from the stock resource:
     • <change> — <why>
     • <change> — <why>
   <Sitewide | Page-level embed (which page)>. Raw-served (no build).
   ============================================================ */
```

The CSS file gets the same banner, stating that it is **behavioural glue only** and
naming the knobs it deliberately omits.

## Step 3 — Designer handoff

Emit this with the code, every time. It's the deliverable that ends repo round-trips
for visual iteration.

| Element / class | Property | Stock value | Set in Designer |
|---|---|---|---|

Convert stock values to rem where they're design knobs, and say so. Then a short
**do not touch** list — the things where a Designer change silently breaks init:

- the mount attribute (`data-<feature>-init`)
- any element providing a positioning context the JS measures against
- the list/item nesting depth the JS walks
- classes named in JS selectors — **a Designer rename breaks the guard silently**

Frame it plainly: these are yours, those are the machine's.

## Step 4 — Write and register

Write `src/js/oa-<name>.js` (+ CSS if page-level). In the same change:

- Add rows to the **Source Files** table in `CLAUDE.md`.
- Add the file to **Script Load Order & Placement** — page-level embed or sitewide
  footer, stating any ordering constraint.
- Append a `docs/DECISIONS.md` entry (`## YYYY-MM-DD — <summary>, v1.0.X`) **only if
  something non-obvious surfaced** — a gotcha that would bite again. Not every import
  earns one.

## Step 5 — Verify before deploying

- **Network log shows no `gsap` request from our code.** This is the one that has
  actually bitten.
- Console clean; the guard's `warn` fires only when GSAP is genuinely absent.
- The component renders and is editable in the Designer canvas — the preview block works.
- Touch and reduced-motion paths both exercised, not assumed.
- **Every Designer handoff value actually set, and the component still looks right** —
  that's the proof the split didn't drop a knob on the floor.
- **Verify hooks against the live post-JS DOM** — not the served HTML, not the canvas.

## Step 6 — Deploy

Follow `CLAUDE.md` → **CDN Deployment Workflow**. Don't restate it here; that file owns
it. In short: commit on `dev` → tag → `curl -sI` every changed file for `200` **before**
touching Webflow → Brendan bumps the URLs → publish. Report the bump as
`@v1.0.X → @v1.0.Y` per changed file.

## Traps

- **"Copy to Webflow" splits a component's CSS in half.** The snippet Osmo gives you to
  paste is only the part Webflow can't represent (custom properties, `::after`,
  `clip-path`, `mix-blend-mode`, `@media (hover)`). The structural half rides on the
  *classes* the paste recreates. Symptom: you paste the snippet and the element renders
  completely unstyled — looks like a class mismatch, isn't.
- **A second CDN `gsap` clobbers `CustomEase`.** Their bundles also re-load Lenis and
  call `gsap.defaults({ease:"osmo"})`, rewriting tween defaults site-wide. This is why
  Barba was rejected outright.
- **Their scroll capture assumes a full-viewport takeover.** Dropped into a mid-page
  block it kills page scroll — remove the wheel handler and axis-lock touch with
  `touch-action`.
- **Their hardcoded dimensions override your Designer values silently**, because this
  layer loads second.
- **Don't ship a second copy** of something the site already does. Merge into the
  existing initialiser with two binding strategies (the directional-hover precedent).
- **Evaluate the content cost, not just the visual upgrade.** The Osmo multilevel nav
  was built, tagged `v1.0.125`, published and rolled back — the component was fine, the
  content it demanded wasn't wanted. The tag stays; it was deployed.
- **jsDelivr tags are immutable.** Any change needs a new tag — never re-point one.
- **A 0-result is not evidence of absence** when querying the Designer or the DOM.
