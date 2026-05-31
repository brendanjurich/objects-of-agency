# Session Findings

Append-only. One entry per session that touched production code or surfaced a non-obvious behaviour, corrected assumption, or deliberate decision worth preserving. Not every session — only when a gotcha would bite again.

---

## 2026-05-27 — Defensive improvements, dependency lock, v1.0.78

### HLS.js warn requires `!isSafariNative` guard

In `oa-homepage.js`, the warn for missing HLS.js must be:

```js
if (!window.Hls && !isSafariNative) { console.warn(...) }
```

`!window.Hls` alone fires on Safari, where `isSafariNative = true` and HLS.js is intentionally absent. `isSafariNative` is declared one line above the warn — it's in scope.

### Array `.length`, not `.size` for filter token check

In `oa-all-products.js`, `tokens` from `.split().filter()` is an **Array**, not a Set. Use `tokens.length === 0`, not `tokens.size === 0`. Sets have `.size`; Arrays do not.

### Lumos null guard already existed — enhance, don't duplicate

The Lumos Swiper patch forEach in `oa-global.js` already had a silent `if (!sw) return`. The fix was to **replace** it with a warned version — not to add a new guard before it. Adding both would produce redundant guards.

### Slideshow thumb document-scope is intentional

In `initSlideShow()`, thumb elements are queried at document scope as a fallback:

```js
thumbs: Array.from(thumbsInEl.length ? thumbsInEl : document.querySelectorAll('[data-slideshow="thumb"]'))
```

This is correct. Thumbs live in `.hero_feed_nav_wrap` as siblings of the slideshow container, not children — added intentionally in v1.0.64. The comment `// Intentional: thumbs are siblings...` documents this.

### FOUC prevention CSS is a separate concern from the flex layout issue

The `.hero_feed_top` flex issue was resolved in Webflow Designer (layout settings). The `opacity:0; visibility:hidden` pattern restored by `.swiper-initialized` is a separate FOUC guard — it prevents a flash of unstyled slides before Swiper initialises. Keep both; they solve different problems.

### Configurator hardcoding is intentional — refactor not worth it

`fixRadioIds()` and `initSummaryUpdater()` hardcode radio `name` attributes (`Sizes`, `Top-Material`, `Timber`, `Anodised-Finish`). A data-driven refactor was evaluated and rejected:

- The option list is stable — it's set in Webflow Designer and rarely changes.
- Any configurator change already requires a code release; the hardcoding adds no extra friction.
- A data-driven version would add an invisible Webflow attribute dependency with no grep trail.

Decision: keep hardcoded. Comment above `fixRadioIds()` documents the coupling and lists current options.

### Always rebuild dist before tagging when oa-homepage.js changes

`dist/oa-homepage.js` is the CDN-served bundle. Tagging without rebuilding serves stale code. Run `npm run build` and verify the bundle before `git tag`. Now documented in CLAUDE.md under Dependency Versions and Constraints.

### iOS Safari orientationchange fires before layout settles — wait for resize

`orientationchange` fires at the start of rotation, before the browser has updated viewport dimensions. Any DOM measurement (`getBoundingClientRect`, `offsetWidth`) or Swiper `update()` call made immediately after — even with a 150ms debounce — can return pre-rotation values on iOS Safari, leaving transforms/positions stale.

The reliable pattern is to wait for the `resize` event that iOS fires *after* reflow completes, with a safety fallback timeout:

```js
window.addEventListener('orientationchange', function () {
  var fired = false;
  function onResize() {
    if (fired) return;
    fired = true;
    window.removeEventListener('resize', onResize);
    // measure / update here
  }
  window.addEventListener('resize', onResize);
  setTimeout(onResize, 500);
});
```

Applied in `oa-configurator.js` (cascading slider re-measure) and `oa-homepage.js` (`swiper.update()` on both hero feed carousels) in v1.0.84–85.

---

### Exact GSAP and Lumos versions still need recording

CLAUDE.md has placeholders for the GSAP CDN URL and Lumos version — both loaded by Webflow, not npm. Record the exact URLs from Webflow → Site Settings → Custom Code before any library-touching changes.
