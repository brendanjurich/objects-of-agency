# CSS Architecture — Webflow, Lumos & the repo override layer

The mental model for **where a style lives and where a fix belongs**. As the build
grows, the recurring confusion is "do I change this in Webflow, or in the repo?" —
this is the answer, with the static-slider centering fix as the worked example.

The north star: stay at the nexus of **top-level development *and* a system that's
easy to follow**. The simplest fix that is also *legible six months later* wins —
not the cleverest one. When a repo override and a Webflow edit both work, prefer the
one a future reader (you) can trace fastest.

---

## The two layers (the cascade)

Styling arrives in the browser in **two stacked layers**, in this order:

1. **Webflow-generated CSS** — `oa-v5.webflow.shared.css`, served from
   `cdn.prod.website-files.com`. This is **everything the Designer + Lumos produce**:
   your class styles, Lumos's utility classes (`u-`), its variables (`--_…---`,
   `--site--`), type clamps, and the slider component styles. **Loads first.**
2. **The repo override layer** — `src/css/oa-styles.css`, served from jsDelivr.
   A thin layer of custom CSS that sits **on top**. **Loads after** layer 1.

Because the repo file loads **later in the cascade**, an equal-specificity rule in it
**wins**; a higher-specificity rule wins outright. So the repo file never *changes*
Webflow's CSS — it **overrides** it wherever its selectors match. Everything
underneath still exists and still applies everywhere the override doesn't reach.

```
Webflow/Lumos CSS  ──►  loads 1st  ──►  the baseline
repo oa-styles.css ──►  loads 2nd  ──►  wins where it matches  ──►  the override
```

### What you control, where

| Surface | You edit it in… | Notes |
|---|---|---|
| Your own classes (e.g. `.static_slider_offset`) | **Webflow Designer** | Persist across publishes. |
| Lumos classes (`.slider_list`, `.slider_element`, `u-…`) | Webflow Designer, **but risky** | A Lumos update can regenerate/wipe Designer tweaks to its classes. |
| CSS inside a **Lumos embed** | ❌ Never | Wiped on Lumos updates (see REFERENCE.md hard constraints). |
| The override layer | **repo `oa-styles.css`** | Version-controlled, outside Lumos's reach, immune to publishes. |

---

## Where a fix belongs (the heuristic)

**Fix it in Webflow Designer when** the target is a class/element **you fully own**
and the change is **naturally scoped there** — no global-class collision. Cleanest:
no CDN round-trip, styling stays co-located with the element.

**Fix it in the repo (`oa-styles.css`) when** you must override a **global or Lumos
class in only *some* contexts**, or you want the fix **version-controlled and immune
to Lumos updates**. The cost is the deploy round-trip (tag → verify 200 → bump URL →
publish), bought back in traceability and safety.

**Caveat (already in CLAUDE.md):** a repo override survives Lumos *value* changes, but
a Lumos *class rename* changes both the bug and the fix — re-test after a Lumos update.

---

## Worked example — the static-slider centering fix (v1.0.113)

**Symptom:** on the Product Template, the slider image sat 8px too far left — its left
edge clipped by the frame's `overflow:hidden`, controls misaligned with the image.

**Cause:** Lumos's `-8px` offset margin was applied to **two** nested elements when the
pattern intends **one**. Slides pad `+8px`; one `-8px` margin cancels it → flush. Two
stack to `-16px`, only `+8` cancels → net `-8px` left shift.

```css
.static_slider_offset       { margin-inline: calc(var(--_gap---size) * -.5); /* -8px */ }
.slider_list.swiper-wrapper { margin-inline: calc(var(--_gap---size) * -.5); /* -8px */ }
```

**Why "just remove one margin in Webflow" wasn't the clean fix** — the two `-8px`
margins *look* interchangeable but do different jobs (verified by live A/B test;
frame = `[41.1 → 774.9]`):

| Change | Image box | Verdict |
|---|---|---|
| none (bug) | `[33.1, 766.9]` w734 | 8px clipped left, 8px gap right |
| remove `.static_slider_offset` margin | `[41.1, 758.9]` w**718** | **shrinks** the slide — this margin *sizes* it ❌ |
| remove `.slider_list` margin | `[41.1, 774.9]` w734 | **centred, full width** ✅ |

So the class that's *safe to touch* (`.static_slider_offset`, product-only) is
**load-bearing for width**. The class that's *the actual bug* (`.slider_list`) is a
**global Lumos class** — the homepage Products slider has **no** `.static_slider_offset`
wrapper, so its single `.slider_list` margin is the only thing keeping *it* flush.
Zeroing `.slider_list` in the Designer fixes the product sliders and **breaks the
homepage** (image shifts `41.1 → 49.1`, an 8px gap — also verified live).

There is **no single Webflow class edit** that fixes the product sliders without
collateral. The correct fix is inherently **scoped**: zero `.slider_list`'s margin
*only inside* `.static_slider_offset`. In Webflow that needs a combo class on that
element (fiddly, lives in Lumos's territory). In the repo it's one descendant
selector — version-controlled and Lumos-proof:

```css
/* src/css/oa-styles.css — 3-class selector outranks Webflow's 2-class rule */
.static_slider_offset .slider_list.swiper-wrapper {
  margin-left: 0;
  margin-right: 0;
}
```

**Do the Webflow margins become redundant?** No — `.static_slider_offset`'s margin
still *sizes* the slide, and `.slider_list`'s margin is still needed by the homepage.
The repo rule doesn't delete either; it **overrides** `.slider_list`'s margin only for
`.static_slider_offset` descendants. Don't remove anything in Webflow.

---

## One-line takeaway

> The repo CSS is a **layer on top of** Webflow, not a replacement for it. Edit Webflow
> when you own the class and the change scopes cleanly there; reach for the repo
> override when you need to win against a **global/Lumos** class in only some places —
> or want the fix version-controlled and update-proof.
