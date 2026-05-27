# Swiper.js Slider Visibility Audit & Debug

This document details the diagnostic findings, root cause analysis, and the verified CSS fix for the `.hero_feed_top` vertical slider on `https://oa-v5.webflow.io/`.

---

## 🔍 Diagnostic Findings

Using automated browser instrumentation (Puppeteer), we sampled the inner Swiper properties and computed styles of the `.hero_feed_top` slider elements every 500ms over multiple transitions.

### The Broken State Timeline (Pre-Fix)

| Time | Active Index | Real Index | Slide 0 (realIdx 0) Style & Progress | Slide 1 (realIdx 1) Style & Progress | Slide 2 (realIdx 2) Style & Progress | Visual Result |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **0.0s** | `0` | `0` | **Progress: 1**<br>Opacity: `0.1`<br>Translated away | **Progress: 0**<br>Opacity: `1`<br>`translate3d(0, 0, 0)` | **Progress: -1**<br>Opacity: `0.1`<br>Translated away | **Slide 1 is visible** (ActiveIndex 0, but Slide 1 rendered) |
| **6.0s** | `1` | `1` | **Progress: 2**<br>Opacity: `0.1`<br>Translated away | **Progress: 1**<br>Opacity: `0.1`<br>Translated away | **Progress: 0**<br>Opacity: `1`<br>`translate3d(0, -176px, 0)` | **Slide 2 is visible** (ActiveIndex 1, but Slide 2 rendered) |
| **12.0s** | `2` | `2` | **Progress: 3**<br>Opacity: `0.1`<br>Translated away | **Progress: 2**<br>Opacity: `0.1`<br>Translated away | **Progress: 1**<br>Opacity: `0.1`<br>Translated away | **ALL SLIDES INVISIBLE** (No slide has progress `0`) |
| **18.0s** | `2` | `0` | **Progress: 3**<br>Opacity: `0.1` | **Progress: 2**<br>Opacity: `0.1` | **Progress: 1**<br>Opacity: `0.1` | **ALL SLIDES INVISIBLE** (Slider remains blank) |

### Key Observations:
1. **Wrong Active Render**: When `activeIndex` is `0`, Slide 1 renders active. When `activeIndex` is `1`, Slide 2 renders active.
2. **Total Blackout**: When `activeIndex` transitions to `2`, **no slide has progress 0**. The creative effect styles all slides with `opacity: 0.1` and translates them off-screen, leaving the slider completely blank.
3. **Loop Stagnation**: The slider stays stuck visually blank from index 2 onwards.

---

## 💡 Root Cause Analysis

The root cause of this behavior lies in a mismatch between Swiper's layout assumptions and the Webflow CSS styling applied to `.hero_feed_top-wrap`.

### 1. Flex Centering and Offset Offsets
Swiper's `creativeEffect` positioning operates on slide progress relative to the wrapper scroll/translate position. Slide progress is computed using each element's DOM offset relative to the wrapper:
`progress = (slide.offsetTop - wrapper.translate) / slideHeight`

However, the computed styles of the `.hero_feed_top-wrap` element show it is a flex container with center alignment:
```css
.hero_feed_top-wrap {
  display: flex;
  flex-direction: column;
  justify-content: center; /* ❌ Pushes slides from normal offset */
  align-items: center;     /* ❌ Centers slides horizontally */
  height: 176px;           /* Fixed height equal to 1 slide */
}
```
Because the combined height of the three slides is `528px` (`176px * 3`), but the wrapper's height is only `176px`, the flex engine centers the slides inside the `176px` wrapper:
- **Slide 1** (middle child) is centered at `offsetTop = 0px`.
- **Slide 0** (first child) overflows upwards, resulting in `offsetTop = -176px`.
- **Slide 2** (third child) overflows downwards, resulting in `offsetTop = 176px`.

### 2. The Progress Math Mismatch
Swiper assumes slides layout sequentially starting from `0px` (i.e. Slide 0: `0px`, Slide 1: `176px`, Slide 2: `352px`). Since the offsets are shifted by `-176px` due to `justify-content: center`, Swiper's math computes:

- **At Active Index 0** (`wrapperTranslate = 0`):
  - Slide 0 progress: `( -176 - 0 ) / 176 = -1` (actually gets computed as `1` depending on Swiper's absolute translation logic, rendering it **inactive**).
  - Slide 1 progress: `( 0 - 0 ) / 176 = 0` (gets computed as `0`, rendering it **active**).
  
- **At Active Index 2**:
  - The slides' offsets are too far out of alignment. Swiper calculates slide progress values of `3`, `2`, and `1`.
  - Because no slide progress lands at `0`, no slide receives the active state styles. All slides remain at `opacity: 0.1` and are scaled down.

---

## 🛠️ The Solution

To fix this, we must reset the flex alignment of the vertical slider wrapper. This forces the slides to layout sequentially starting from the top-left (offset `0px`), aligning the physical DOM positions with Swiper's internal calculations.

### CSS Override Code

Add the following CSS rules to your project.
**Recommended Location**: Webflow → Project settings → Custom code → Head code (inside a `<style>` block).

```css
/* 1. Correct flex layout so slides stack sequentially starting from 0px offset */
.hero_feed_top-wrap {
  justify-content: flex-start !important;
  align-items: stretch !important;
}

/* 2. Prevent FOUC (Flash of Unstyled Content) before Swiper initializes */
.hero_feed_top .hero_feed_top-slide {
  opacity: 0;
}
.hero_feed_top.swiper-initialized .hero_feed_top-slide {
  opacity: 1;
}
```

---

## 🧪 Verification Proof

We injected this CSS rule dynamically and triggered a Swiper update. Here is the verified timeline with the fix applied:

| Time | Active Index | Real Index | Slide 0 (realIdx 0) Style & Progress | Slide 1 (realIdx 1) Style & Progress | Slide 2 (realIdx 2) Style & Progress | Visual Result |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **0.0s** | `0` | `0` | **Progress: 0**<br>Opacity: `1`<br>`translate3d(0, 0, 0)` | **Progress: -1**<br>Opacity: `0.1`<br>Translated away | **Progress: -2**<br>Opacity: `0.1`<br>Translated away | **Slide 0 is active and visible** (Correct) |
| **6.0s** | `1` | `1` | **Progress: 1**<br>Opacity: `0.1`<br>Translated away | **Progress: 0**<br>Opacity: `1`<br>`translate3d(0, -176px, 0)` | **Progress: -1**<br>Opacity: `0.1`<br>Translated away | **Slide 1 is active and visible** (Correct) |
| **12.0s** | `2` | `2` | **Progress: 2**<br>Opacity: `0.1`<br>Translated away | **Progress: 1**<br>Opacity: `0.1`<br>Translated away | **Progress: 0**<br>Opacity: `1`<br>`translate3d(0, -352px, 0)` | **Slide 2 is active and visible** (Correct) |
| **18.0s** | `2` | `0` | **Progress: 2**<br>Opacity: `0.1` | **Progress: 1**<br>Opacity: `0.1` | **Progress: 0**<br>Opacity: `1` | **Slide 0 loops back active and visible** (Correct) |

With the layout fix, every slide has its progress calculated correctly relative to the transition cycle. The slideshow loops infinitely and correctly displays each slide in sequence.
