## Instructions for Claude Code

> In the Webflow project for oa-v5 (product credenza page), apply the Osmo "Osmo" ease to the Swiper slider on the product page.
>
> **1. Add CSS** (either in Webflow's Custom Code → Head, or a global stylesheet):
> ```css
> :root {
>   --ease-osmo: cubic-bezier(0.625, 0.05, 0, 1);
> }
>
> /* Target the product slider's Swiper wrapper.
>    Use the slider's specific class (.slider_element) so this
>    doesn't leak into any other Swiper instances on the site. */
> .slider_element .swiper-wrapper {
>   transition-timing-function: var(--ease-osmo) !important;
> }
> ```
> The `!important` is needed because Swiper writes the timing function inline on every slide change.
>
> **2. Update the Swiper init** (wherever the Swiper is instantiated for `.slider_element`) to lengthen the duration so the ease has room to breathe:
> ```js
> new Swiper('.slider_element', {
>   // ...existing options...
>   speed: 800, // was 600
> });
> ```
>
> **3. Do NOT use GSAP CustomEase here** — Swiper's transition engine runs on CSS, so the CustomEase registration wouldn't affect the slide transition.
>
> **4. Test**: click the prev/next arrows and pagination dots on `/product/interior-credenza` and confirm the slide motion has a soft start and long graceful tail (classic Osmo S-curve).

Summary: on this page, stick with `cubic-bezier(0.625, 0.05, 0, 1)`, scoped to `.slider_element .swiper-wrapper` with `!important`, and optionally raise `speed` to 800ms. That'll give you the Osmo feel with the least amount of moving parts.