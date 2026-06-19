# Repo-driven Lumos slider init (Option B) + controls redesign — resume brief

**Date:** 2026-06-19 · **Status:** agreed, not started · **Branch:** `dev` · **Next session entry point.**

This is the handoff for the slider work. The user is designing the new **controls** offline
(a day or two) and we resume B + controls **together** — they share the slider's Swiper config,
so we wire init + new controls once, test once, deploy once.

---

## What shipped this session (done — don't redo)

- **Slider centering fix** — `.static_slider_offset .slider_list.swiper-wrapper { margin-inline: 0 }`
  in `oa-styles.css`. Kills the doubled Lumos offset margin → product sliders centred, LHS clip
  gone, controls aligned. Scoped so the homepage slider is untouched. **Shipped `v1.0.113`.**
- **`CLAUDE.md`** — added the **Lumos ≠ Osmo** hard rule + corrected the Lumos-update wording
  (it's a build-time clone, no runtime, no auto-update; only re-import by the user changes it).
- **`docs/CSS-ARCHITECTURE.md`** — the Webflow/Lumos-vs-repo-override mental model.

## Live deploy state (from on-page script audit)

| File | Live tag | Note |
|---|---|---|
| `oa-styles.css` | **v1.0.113** | centering fix — user bumping the Webflow URL |
| `oa-global.js` | v1.0.107 | **B will change this → new tag + sitewide URL bump** |
| `oa-configurator.js` | v1.0.111 | unchanged |
| `dist/oa-homepage.js` | v1.0.112 | unchanged |

`dev` ahead of `main`; **merge to `main` is held until the slider work is done** (user's call).

---

## The decision: Option B (repo-driven), and *why it's safe*

Move the Swiper-8 load + Lumos slider init **into the repo**; delete the embeds from Webflow.
The earlier worry ("we'd have to maintain Lumos's init on updates") is **void** — verified there
is **no Lumos runtime** (`anyLumosRuntime: []`); the init is an **inline, frozen** `<script>`.
Nothing auto-updates it. So owning it in the repo is just relocating frozen code → version
control + dedup + lets us **delete the `window.load` speed/transition patches** (fold them into
init). Net simplification of `oa-global.js`.

### The duplication being fixed
- **Product template** — slider component is `.static_slider_contain` (`[data-slider='component']`),
  instantiated **3×** (slider / press / process); the full Swiper-8-load + init embed is **baked
  inside that component** → **3 copies** of `swiper@8` JS+CSS + 3 init scripts.
- **Homepage** — *different* component `.slider_wrap`, **1 instance → 1 copy** (already fine).
- Lever: the init does `querySelectorAll("[data-slider='component']")` → **one copy initialises
  every slider on the page.** So the end-state is 1 source of init for the whole site.

---

## The Lumos init script (verbatim — so we don't re-scrape it)

This is what's currently baked in each embed. B reproduces it faithfully in the repo:

```js
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-slider='component']:not([data-slider='component'] [data-slider='component'])").forEach((component) => {
    if (component.dataset.scriptInitialized) return;
    component.dataset.scriptInitialized = "true";

    const swiperElement = component.querySelector(".slider_element");
    const swiperWrapper = component.querySelector(".slider_list");
    if (!swiperElement || !swiperWrapper) return;

    // flatten Lumos u-display-contents wrappers
    function flattenDisplayContents(slot) {
      if (!slot) return;
      let child = slot.firstElementChild;
      while (child && child.classList.contains("u-display-contents")) {
        while (child.firstChild) slot.insertBefore(child.firstChild, child);
        slot.removeChild(child);
        child = slot.firstElementChild;
      }
    }
    flattenDisplayContents(swiperWrapper);

    // lift CMS items out of the .w-dyn-list into the wrapper
    function removeCMSList(slot) {
      const dynList = Array.from(slot.children).find((c) => c.classList.contains("w-dyn-list"));
      if (!dynList) return;
      const nestedItems = dynList?.querySelector(".w-dyn-items")?.children;
      if (!nestedItems) return;
      const staticWrapper = [...slot.children];
      [...nestedItems].forEach(el => { const c = [...el.children].find(c => !c.classList.contains('w-condition-invisible')); c && slot.appendChild(c); });
      staticWrapper.forEach((el) => el.remove());
    }
    removeCMSList(swiperWrapper);

    [...swiperWrapper.children].forEach((el) => el.classList.add("swiper-slide"));

    const followFinger = swiperElement.getAttribute("data-follow-finger") === "true",
      freeMode = swiperElement.getAttribute("data-free-mode") === "true",
      mousewheel = swiperElement.getAttribute("data-mousewheel") === "true",
      slideToClickedSlide = swiperElement.getAttribute("data-slide-to-clicked") === "true",
      speed = +swiperElement.getAttribute("data-speed") || 600;

    new Swiper(swiperElement, {
      slidesPerView: "auto",
      followFinger, loopAdditionalSlides: 10, freeMode, slideToClickedSlide,
      centeredSlides: false, autoHeight: false, speed,
      mousewheel: { enabled: mousewheel, forceToAxis: true },
      keyboard: { enabled: true, onlyInViewport: true },
      navigation: {
        nextEl: component.querySelector("[data-slider='next'] button"),
        prevEl: component.querySelector("[data-slider='previous'] button"),
      },
      pagination: {
        el: component.querySelector(".slider_bullet_list"),
        bulletActiveClass: "is-active", bulletClass: "slider_bullet_item",
        bulletElement: "button", clickable: true,
      },
      slideActiveClass: "is-active", slideDuplicateActiveClass: "is-active",
    });
  });
});
```

---

## B — implementation shape (for next session)

- **File home:** fold into **`oa-global.js`** (sitewide, already touches these sliders; raw-served).
  Alt: dedicated `oa-slider.js` if we want single-responsibility — decide at start.
- **Mechanism:** on init, `if (document.querySelector("[data-slider='component']"))` →
  **dynamically inject `swiper@8` JS + CSS** (append `<script>`/`<link>`, await `onload`), then run
  the init above. Guard keeps Swiper off slider-less pages (perf — matches today's behaviour).
- **Fold in the two existing `oa-global.js` patches (then delete them):**
  1. **Speed** — currently `document.querySelector('.static_slider-wrap .slider_element')` gets
     `speed = isTouch ? 700 : 800` at `window.load`. ⚠️ **Only the `.static_slider-wrap` (main
     product) slider** — *not* press/process/homepage (they keep `data-speed || 600`). Reproduce
     exactly: set that one slider's `speed` in its config; leave the others on init default.
  2. **`is-slider-transitioning`** — currently wired on `.section_menu_wrap .slider_element`
     (homepage) at `window.load` (`transitionStart`/`End`, `touchStart`/`End` → toggle
     `body.is-slider-transitioning`). Attach these listeners inline right after creating that
     component's Swiper. Keep the `console.warn` null-guard spirit.
- **FOUC guard (the one real gotcha):** async-loading Swiper means a beat before
  `.swiper-initialized`. Add the hide-until-initialized pattern (same as the hero in
  `oa-styles.css`: `opacity:0;visibility:hidden` on slides → restore on `.swiper-initialized`).
  Scope to `.slider_element` so the homepage + product sliders both covered.
- **Keep untouched:** `--ease-osmo` easing rule + the v1.0.113 centering rule. Swipe feel stays.
- **Webflow steps (user, in Designer):** delete the Swiper-8-load + init embed from **both**
  components — `.static_slider_contain` (product) and `.slider_wrap` (homepage). No page-level
  embed needed; the repo handles load + init. Then bump `oa-global.js` URL to the new tag sitewide.

---

## Controls redesign (open — user designing now)

The user is bringing the new controls design. It edits the slider's `navigation` (`[data-slider='next'/'previous'] button`)
and `pagination` (`.slider_bullet_list`, `.slider_bullet_item`) — the **same Swiper config** B owns.
So: take the new controls DOM/markup from the user, wire `navigation`/`pagination` selectors +
any new classes into the repo init, style in `oa-styles.css`. Existing pagination contract for
reference: `bulletClass: slider_bullet_item`, `bulletActiveClass: is-active`, `bulletElement: button`,
`clickable: true`; controls live in `.slider_controls` (aligns to `.static_slider_contain` frame).

**Need from the user at resume:** the controls design (look + behaviour), and whether they're
rebuilt in Webflow first (new DOM) or we drive structure from the repo.

---

## Verification at resume (real-device / staging — no automated tests)

| Check | Pass |
|---|---|
| All 3 product sliders init + work (drag/click/arrows/bullets/keyboard/mousewheel) | functional |
| Homepage `.section_menu_wrap` slider | unchanged behaviour + `is-slider-transitioning` raise still works |
| Swiper loads **once** per page; **zero** on slider-less pages | network panel |
| Speed: main product slider 800/700; others 600 (or their `data-speed`) | feel matches today |
| No FOUC of un-initialised slides on load | visual |
| Swipe feel (easing) + centering (v1.0.113) | unchanged |

## Open decisions for next session
1. `oa-global.js` vs new `oa-slider.js`.
2. Controls: rebuilt in Webflow first, or repo-driven structure?
3. Confirm only `.static_slider-wrap` keeps the 800/700 speed (vs applying to press/process too).
