Task: Fix FOUC on .hero_feed_top Swiper slider
Problem
The .hero_feed_top vertical Swiper slider on the homepage briefly flashes its slide content in normal document flow before Swiper.js initializes and applies its creative-effect transforms. The slides are link blocks inside .hero_feed_top-wrap that are meant to be hidden/translated off-screen until they become the active slide, but there is no CSS rule that hides them in their pre-init state.
Root cause
The stylesheet contains only two rules targeting the slider:
css.hero_feed_top { overflow: hidden; aspect-ratio: 2.5/1; ... }
.hero_feed_top-slide { width: 100%; height: 186px; display: flex; ... }
Neither hides the inactive slides. Until Swiper attaches its inline transform: translate3d(0, ±125%, -500px) and opacity: 0.1 to each slide element, all three .hero_feed_top-slide link blocks render fully opaque in normal flow, stacked vertically. Because the container has overflow: hidden, the top edge of the first slide is briefly visible until Swiper's init pass repositions everything.
Swiper.js adds the swiper-initialized class to the container synchronously inside its constructor, the moment it has finished applying initial slide transforms and opacities. That class is the correct signal to use as a "safe to show" gate.
Required fix
Add the following CSS to the project. Recommended location: Webflow → Project settings → Custom code → Head code, inside a <style> block. If you have a global custom CSS embed already in use, add it there instead.
css/* Prevent FOUC on hero_feed_top vertical Swiper */
.hero_feed_top .hero_feed_top-slide {
  opacity: 0;
}
.hero_feed_top.swiper-initialized .hero_feed_top-slide {
  opacity: 1;
}
Why these specific declarations
Use opacity: 0, not visibility: hidden and not display: none. Swiper needs the slides to retain their layout box during init so it can measure heights and compute the creative-effect translate values. display: none will break Swiper's measurement; opacity: 0 preserves layout while hiding paint.
After swiper-initialized is added, the second rule restores opacity: 1 from the stylesheet. Swiper's own inline opacity: 0.1 on the non-active slides (and opacity: 1 on the active slide) then takes precedence via inline-style specificity, so the creative-effect fade continues to work exactly as designed. No JS changes are required.
Optional belt-and-suspenders hardening
On slower devices there is a theoretical risk of a single-frame flash if the browser paints the stylesheet before the inline <script> that constructs the Swiper runs. The container already has overflow: hidden in its existing styles, which covers most of this case. For additional safety, also hide the wrap during the pre-init phase by extending the rules above to:
css/* Prevent FOUC on hero_feed_top vertical Swiper */
.hero_feed_top .hero_feed_top-slide {
  opacity: 0;
}
.hero_feed_top .hero_feed_top-wrap {
  visibility: hidden;
}
.hero_feed_top.swiper-initialized .hero_feed_top-slide {
  opacity: 1;
}
.hero_feed_top.swiper-initialized .hero_feed_top-wrap {
  visibility: visible;
}
visibility: hidden on .hero_feed_top-wrap keeps the wrap and its children measurable by Swiper while guaranteeing zero paint of any slide content until swiper-initialized is applied. Once the class is added, both the wrap and the slides become visible in the same frame, and Swiper's inline transforms and opacities take over.
Verification steps

After deploying the CSS, hard refresh the homepage (Cmd+Shift+R / Ctrl+Shift+R) to bypass cache.
Visually confirm there is no flash of stacked slide content on initial paint. The slider area should appear empty/blank for a single frame and then the first slide should appear in its active position.
Throttle the network to "Slow 3G" in DevTools and reload. The flash should still not appear.
In the console, run document.querySelector('.hero_feed_top').classList.contains('swiper-initialized') and confirm it returns true after page load.
Confirm the creative-effect transitions still work normally (slides translate vertically with fade) by waiting through one autoplay cycle (5 seconds per slide).

Do not
Do not attempt to fix this with setTimeout before Swiper init, by altering creativeEffect.prev/next translate values, by changing autoplay.delay, or by modifying any JavaScript. The cause is a missing CSS initial state, and the fix belongs in CSS only.