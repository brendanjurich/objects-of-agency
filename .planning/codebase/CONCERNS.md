# Codebase Concerns

**Analysis Date:** 2026-05-27

---

## Deployment Process Risks

**Manual CDN tagging with no automation:**
- Issue: Every release requires manually running `git tag`, `git push origin vX.X.X`, updating CDN URLs in Webflow Site Settings, and purging the jsDelivr cache. There is no CI/CD pipeline, no deploy script, and no guard against forgetting any step.
- Files: `CLAUDE.md` (documents the workflow), `rollup.config.mjs`
- Impact: A forgotten cache purge silently serves stale JS/CSS to all users. A missed Webflow URL update means a new tag has no effect on the live site. Both have occurred in practice (v1.0.73 hotfix cycle).
- Fix approach: Write a `scripts/release.sh` that runs build, creates the tag, pushes, and prints the jsDelivr purge URLs and Webflow update checklist. Even a Makefile target would eliminate the multi-step error surface.

**No automated cache purge verification:**
- Issue: jsDelivr cache purge is manual (`https://purge.jsdelivr.net/gh/...`). There is no script or check to confirm the purge succeeded before the Webflow URL update is considered done.
- Files: `CLAUDE.md`
- Impact: Stale bundles can persist for hours with no visible error. Debugging requires manually checking response headers or hard-reloading in incognito.
- Fix approach: Add the purge URL call to a release script and check the HTTP response code.

**dist/oa-homepage.js committed to the repo:**
- Issue: The built artifact `dist/oa-homepage.js` is tracked in git. This means the dist and source can diverge silently if a developer edits `src/js/oa-homepage.js` without running `npm run build`.
- Files: `dist/oa-homepage.js`, `src/js/oa-homepage.js`, `rollup.config.mjs`
- Impact: A tag could be pushed referencing a stale bundle. No build verification exists in CI.
- Fix approach: Add a pre-push hook or CI check that runs `npm run build` and asserts `dist/oa-homepage.js` matches what Rollup produces. Alternatively, add a build step note to the release checklist in `CLAUDE.md`.

---

## Global Dependency Coupling (Raw Files)

**`oa-configurator.js` depends on `gsap` as an implicit global:**
- Issue: `oa-configurator.js` calls `gsap.to()`, `gsap.set()`, and `gsap.delayedCall()` throughout (`src/js/oa-configurator.js` lines 143, 151, 159, 161, 202, 209, 216) with no import. It depends entirely on GSAP being loaded by `oa-global.js` first via a `<script>` tag in Webflow.
- Files: `src/js/oa-configurator.js`, `src/js/oa-global.js`
- Impact: Load order in Webflow custom code determines whether the configurator works. If `oa-configurator.js` ever loads before `oa-global.js` (e.g. wrong script order, async loading), every animation fails silently with `gsap is not defined` errors.
- Fix approach: Document the required load order in `CLAUDE.md`. Long-term: bundle configurator with GSAP via Rollup the same way `oa-homepage.js` bundles Swiper.

**`oa-global.js` depends on `gsap` and `CustomEase` as implicit globals:**
- Issue: `oa-global.js` line 4 calls `gsap.registerPlugin(CustomEase)` and line 9 calls `CustomEase.create(...)` with no imports. GSAP and CustomEase must already be on `window` when this file executes.
- Files: `src/js/oa-global.js`
- Impact: If the GSAP CDN tag is removed or reordered in Webflow settings, `oa-global.js` fails completely — loader, slideshow, nav animations, and custom eases all break.
- Fix approach: Add explicit dependency documentation. Consider bundling GSAP imports for the global file as a future refactor.

**`oa-homepage.js` depends on `window.Hls` (HLS.js) as an implicit global:**
- Issue: `oa-homepage.js` line 115 reads `window.Hls && Hls.isSupported()` to detect HLS.js for the Bunny background video player. HLS.js is not bundled — it must be loaded separately by Webflow before this script.
- Files: `src/js/oa-homepage.js`
- Impact: If HLS.js is not loaded (e.g. it's removed from Webflow custom code), non-Safari browsers silently fall back to `video.src = src` at line 142 with no HLS adaptive streaming. The fallback exists but its activation is invisible.
- Fix approach: Add a console warning when `window.Hls` is absent and HLS content is expected.

**Lumos-initialized Swipers patched via `window.load` in `oa-global.js`:**
- Issue: `oa-global.js` lines 170–211 patch Swiper speed and events on instances that Lumos (a third-party Webflow plugin) created. This is a timing-dependent workaround: the patch assumes Lumos finishes init before `window.load` fires.
- Files: `src/js/oa-global.js` (lines 166–211)
- Impact: If Lumos changes its initialization timing (e.g. moves to DOMContentLoaded or async), the `.swiper` property may be `undefined` at patch time, silently skipping all speed and transition overrides.
- Fix approach: Add a null-check guard with a console warning. Consider using a `MutationObserver` or Lumos-provided callback if one exists.

---

## Tech Debt

**Duplicate comment block in `oa-global.js`:**
- Issue: Lines 166–169 contain two nearly identical comment blocks back-to-back describing the same Lumos patch rationale. One was not cleaned up after editing.
- Files: `src/js/oa-global.js` (lines 166–169)
- Impact: Low — cosmetic only, but suggests the section was edited hastily.
- Fix approach: Remove the redundant comment on line 166–167.

**Hardcoded radio input `name` attributes in `oa-configurator.js`:**
- Issue: `fixRadioIds()` at lines 279–288 in `src/js/oa-configurator.js` hardcodes the strings `"Sizes"`, `"Top-Material"`, `"Timber"`, `"Anodised-Finish"`. Any new configurator option type requires a code change here.
- Files: `src/js/oa-configurator.js` (lines 279–288)
- Impact: Adding a new product option (e.g. "Colour") requires a code change and new CDN release, not just a Webflow CMS change.
- Fix approach: Make `fixRadioIds()` data-attribute-driven — scan all radio inputs and disambiguate by name dynamically, rather than enumerating names.

**Hardcoded summary group IDs in `oa-configurator.js`:**
- Issue: `initSummaryUpdater()` at lines 329–368 hardcodes `id` values (`summary-size`, `summary-top-material`, `summary-timber`, `summary-anodising`) and radio `name` attributes. Same coupling problem as `fixRadioIds()`.
- Files: `src/js/oa-configurator.js` (lines 330–336)
- Impact: Same as above — new option types require a code change, not a Webflow-only change.
- Fix approach: Use `data-summary-for` attributes on summary elements pointing to the radio `name`, driven entirely from Webflow CMS.

**`oa-styles.css` skeleton placeholder uses hardcoded hex colour:**
- Issue: `src/css/oa-styles.css` line 399 has `background-color: #e8e8e8; /* TODO: replace with Lumos skeleton/surface token */`. The token never existed.
- Files: `src/css/oa-styles.css` (line 399)
- Impact: Low. Skeleton colour may drift from design tokens if the palette changes.
- Fix approach: Replace with a CSS custom property once a design token for skeleton/surface exists.

**Greeting animation hardcoded to exactly 9 children:**
- Issue: `oa-styles.css` lines 171–179 hardcode `:nth-child(1)` through `:nth-child(9)` animation delays for `.hero_feed_greetings .greeting`. The total cycle duration is also hardcoded to 36s.
- Files: `src/css/oa-styles.css` (lines 171–179)
- Impact: Adding or removing a greeting in Webflow CMS breaks the animation timing without a CSS change. Currently not CMS-driven, so the risk is low but non-obvious.
- Fix approach: Document in `CLAUDE.md` that greeting count is fixed at 9 and CSS must be updated if count changes.

---

## Fragile Areas

**Swiper `EffectCreative` module registration (`oa-homepage.js`):**
- Issue: Both `initHeroFeedTopSwiper()` and `initHeroFeedRightSwiper()` pass `modules: [Autoplay, EffectCreative]` per-instance. This was a previously broken pattern (missing module registration) that was fixed. The fix is correct for Swiper v12, but the pattern is non-obvious — omitting `EffectCreative` from the array causes the creative effect to silently do nothing.
- Files: `src/js/oa-homepage.js` (lines 9, 48)
- Impact: Future edits that copy the Swiper config without the `modules` array will silently fall back to default slide behavior.
- Fix approach: Add an inline comment noting that `EffectCreative` is required for `effect: 'creative'` to work.

**`hero_feed_top` FOUC prevention depends on `.swiper-initialized` class:**
- Issue: `oa-styles.css` lines 498–508 hide `.hero_feed_top-wrap` and all slides with `visibility: hidden; opacity: 0` until `.swiper-initialized` is added to the container. If Swiper fails to init (e.g. DOM element not found, JS error), slides remain invisible permanently.
- Files: `src/css/oa-styles.css` (lines 498–508), `src/js/oa-homepage.js` (lines 4–41)
- Impact: A Swiper init failure produces a blank hero section with no visible error.
- Fix approach: Add a fallback timeout in `initHeroFeedTopSwiper()` that restores visibility if `.swiper-initialized` is not added within ~2s of DOMContentLoaded.

**Cascading slider clone padding: minimum 9 slides required:**
- Issue: `oa-configurator.js` lines 36–47 clone slides until there are at least 9. If Webflow CMS has fewer than 9 products in a configurator, clones fill the gap. Clone elements have `data-clone` attribute but are otherwise indistinguishable from real slides in the DOM.
- Files: `src/js/oa-configurator.js` (lines 36–47)
- Impact: If the real slide count changes (e.g. a product is unpublished), clone math changes silently. Radio sync (`syncRadio()` at line 168) uses `% originalCount` to map clones back to real indices — this breaks if `originalCount === 0`.
- Fix approach: Add a guard: if `radioInputs.length === 0`, skip `syncRadio()` (already partially done via the `if (!originalCount) return` on line 169, which is correct). Document the 9-slide minimum requirement in `CLAUDE.md`.

**`oa-all-products.js` filter relies on `data-filter-name` being set in HTML or via CMS collect divs:**
- Issue: The filter engine in `oa-all-products.js` reads `data-filter-name` from elements (lines 13–29). If Webflow CMS fields or element structure changes (renamed fields, restructured HTML), filter silently shows all items as matching everything.
- Files: `src/js/oa-all-products.js` (lines 13–29)
- Impact: Broken filtering with no JS error — all products appear regardless of selected filter.
- Fix approach: Add a console warning when `itemTokens` is empty for any filter group.

**`oa-global.js` slideshow fallback thumb scope:**
- Issue: `initSlideShow()` at line 22 in `src/js/oa-global.js` falls back to `document.querySelectorAll('[data-slideshow="thumb"]')` if no thumbs are found inside the slideshow element. This means thumb clicks on any page with a slideshow could inadvertently target thumbs outside the component's scope if the HTML is structured incorrectly.
- Files: `src/js/oa-global.js` (lines 22–23)
- Impact: Low in current structure, but could cause cross-component interference if multiple slideshows exist on the same page.
- Fix approach: Scope thumb query strictly to `el` and remove the document-level fallback, or document why the fallback is intentional.

---

## Security Considerations

**No Content Security Policy (CSP):**
- Risk: Scripts are loaded from jsDelivr CDN and GSAP CDN via Webflow custom code. No CSP headers restrict what scripts can execute. The site is Webflow-hosted, so CSP header control is limited.
- Files: N/A — Webflow platform constraint
- Current mitigation: None beyond Webflow's default hosting security.
- Recommendations: Use jsDelivr SRI (Subresource Integrity) hashes on script tags where Webflow allows. At minimum, document which CDN URLs are trusted so unexpected script injections are detectable.

**Public GitHub repository:**
- Risk: Source code, including all JS logic and CSS, is publicly visible at `https://github.com/brendanjurich/objects-of-agency`.
- Files: All files in `src/`
- Current mitigation: No secrets or credentials are stored in source (confirmed: no `.env` file committed).
- Recommendations: Maintain current hygiene. Do not add API keys or Webflow API tokens to any tracked file.

---

## Performance Concerns

**`backdrop-filter: blur(20px)` on multiple hero elements:**
- Issue: `oa-styles.css` applies `backdrop-filter: blur(20px)` to `.hero_feed_top::before` (line 464), `.hero_feed_right::before` (line 535), and `.hero_feed_map` (line 585). Backdrop filter is GPU-expensive, especially when multiple blurred layers are composited simultaneously.
- Files: `src/css/oa-styles.css` (lines 463–465, 534–536, 585–586)
- Impact: Potential jank on mid-range mobile devices when all three hero feed elements are visible together.
- Fix approach: Test on low-end Android. Consider reducing blur radius on mobile via a media query, or using `@supports (backdrop-filter: blur())` to offer a fallback.

**`will-change: opacity, transform` on all greeting elements:**
- Issue: `oa-styles.css` line 167 sets `will-change: opacity, transform` on every `.greeting` element. With 9 greetings, this creates 9 compositor layers simultaneously, even though only 1 is visible at a time.
- Files: `src/css/oa-styles.css` (line 167)
- Impact: Unnecessary memory consumption from promoted layers. Minor on desktop, potentially noticeable on older iOS.
- Fix approach: Remove `will-change` from the base rule and apply it only to the currently-active greeting via JS, or rely on the animation to trigger compositing naturally.

**`!important` overrides for Swiper inline styles:**
- Issue: Swiper writes `transition-timing-function` inline on every slide change, requiring `!important` to override. `oa-styles.css` uses `!important` 20 times total — several in direct response to Swiper and Webflow overwriting inline styles.
- Files: `src/css/oa-styles.css` (lines 477–478, 551–552, 603–604)
- Impact: Not a performance problem per se, but makes CSS specificity hard to reason about and cascading override chains fragile. Any Swiper or Webflow version update that changes which inline styles are set could break visual behavior silently.
- Fix approach: Document each `!important` use with an inline comment explaining why it is necessary (already done in some cases — expand to all instances).

---

## Test Coverage Gaps

**No automated tests exist:**
- What's not tested: All JavaScript behavior — Swiper init, filter logic, pricing calculations, cascading slider layout, video player state machine, loader animation sequencing.
- Files: `src/js/oa-homepage.js`, `src/js/oa-global.js`, `src/js/oa-configurator.js`, `src/js/oa-all-products.js`
- Risk: Regressions are only caught by manual browser testing. Complex logic (e.g. cascading slider `getOffset()` with clone padding, pricing engine `calculatePrice()`) has no regression safety net.
- Priority: High for pricing engine (financial display). Medium for filter engine and cascading slider. Low for animation-only code.

**No visual regression testing:**
- What's not tested: CSS animation states, FOUC prevention, hover effects, Swiper creative transitions.
- Files: `src/css/oa-styles.css`, `src/css/oa-all-products.css`
- Risk: A CSS change can silently break the loader, nav blend mode, or hero feed visibility with no automated detection.
- Priority: Medium.

---

## Dependencies at Risk

**Swiper locked to `^12.1.4` (bundled via npm):**
- Risk: `^` version range allows minor/patch upgrades on next `npm install`. Swiper has historically introduced breaking changes between minor versions (v8 → v11 → v12 all required code changes in this repo per commit history).
- Files: `package.json` (line 25), `src/js/oa-homepage.js`
- Impact: `npm install` after a Swiper minor release could silently break creative effect behavior.
- Fix approach: Lock to an exact version (`"swiper": "12.1.4"`) in `package.json` and commit `package-lock.json`. Update intentionally, not silently.

**GSAP loaded from external CDN (not bundled, version not pinned in repo):**
- Risk: GSAP version is controlled by a URL in Webflow custom code, not tracked in this repo. There is no record of which GSAP version is in use or when it was last updated.
- Files: `src/js/oa-global.js`, `src/js/oa-configurator.js` (both depend on global `gsap`)
- Impact: A CDN URL change or GSAP breaking change has no rollback path through git.
- Fix approach: Document the exact GSAP CDN URL and version in `CLAUDE.md`. Consider bundling GSAP via npm long-term.

**Lumos (third-party Webflow plugin) — no version tracking:**
- Risk: Lumos initializes Swipers that `oa-global.js` patches at `window.load`. Lumos version is controlled in Webflow, not in this repo.
- Files: `src/js/oa-global.js` (lines 166–211)
- Impact: A Lumos update that changes Swiper initialization timing or class names would silently break the speed patch and the `is-slider-transitioning` body class behavior.
- Fix approach: Document the Lumos version used in `CLAUDE.md`. Add defensive null checks around `el.swiper` access.

**Finsweet (third-party Webflow plugin) — no version tracking:**
- Risk: `oa-styles.css` line 412 notes "Finsweet injects dots here" for swatch rows. Finsweet's injected HTML structure is assumed but not verified in code.
- Files: `src/css/oa-styles.css` (line 412)
- Impact: A Finsweet update that changes injected HTML structure or class names could break swatch display silently.
- Fix approach: Document Finsweet version in `CLAUDE.md`.

---

*Concerns audit: 2026-05-27*
