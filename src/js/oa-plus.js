/* ============================================================
   OA — Plus rotate
   ------------------------------------------------------------
   A "+" icon turns a quarter (or any angle) when something
   happens near it. Reference: camillemormal.com homepage, where
   the side crosses turn 90° per slide change, 1.2s expo-out
   (CSS transition, cumulative angle, sign = slide direction).

   Host: any element with data-oa-plus — the element that turns.
   It must not be display:inline (an inline box ignores transforms);
   give its class block / inline-block / flex in the Designer.

   Designer knobs, all optional, read once at init (bind them to
   component props on the host — a DOM element, not the SVG):
     data-oa-plus-trigger   hover | click | slide   (default hover)
     data-oa-plus-angle     degrees per step        (default 90)
     data-oa-plus-duration  seconds                 (default 0.4)
     data-oa-plus-ease      GSAP ease name          (default power2.inOut)
   A bad value falls back to its default.

   Triggers:
     hover  turns on pointer enter, back on leave. Mouse only —
            a tap fires enter but never leave. Listens on the
            nearest [data-oa-plus-scope], else the nearest a/button,
            else the host — so a plus in a card slot answers the
            whole card when the card carries data-oa-plus-scope.
     click  open/close: turns to the angle on open, back to 0 on
            close. Follows aria-expanded on that element, or on the
            first control inside it (a component wrapper such as
            oa Button Menu, whose state sits on its Clickable), so
            any close turns it back. With no aria-expanded anywhere,
            each click alternates.
     slide  adds a step per next slide, takes one per previous,
            on the Lumos slider around it ([data-slider='component']).
            Swipes, keys and bullets count, not just the buttons.

   Slide steps accumulate, and a tween caught mid-way continues
   from where it is.
   Reduced motion: the turn is instant.
   Needs window.gsap; without it the turn still happens, unanimated.
   Sitewide footer, after oa-slider.js. Raw-served (no build).
   ============================================================ */

(function () {
  const DEFAULTS = { trigger: 'hover', angle: 90, duration: 0.4 };
  // A→B with both ends on screen: in-out (docs/REFERENCE.md → Easing).
  const DEFAULT_EASE = 'power2.inOut';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const canHover = window.matchMedia('(hover: hover)');

  function num(host, name, min) {
    const v = parseFloat(host.getAttribute('data-oa-plus-' + name));
    return Number.isFinite(v) && v >= min ? v : DEFAULTS[name];
  }

  function ease(host) {
    const v = host.getAttribute('data-oa-plus-ease');
    return v && window.gsap && window.gsap.parseEase(v) ? v : DEFAULT_EASE;
  }

  function init(host) {
    const angle = num(host, 'angle', -Infinity);
    const duration = num(host, 'duration', 0);
    const curve = ease(host);
    let target = 0;

    function turnTo(deg) {
      target = deg;
      if (!window.gsap) { host.style.transform = 'rotate(' + deg + 'deg)'; return; }
      window.gsap.to(host, {
        rotation: deg,
        duration: reduce.matches ? 0 : duration,
        ease: curve,
        overwrite: true,
      });
    }

    const trigger = host.getAttribute('data-oa-plus-trigger') || DEFAULTS.trigger;

    if (trigger === 'slide') {
      const component = host.closest("[data-slider='component']");
      const el = component && component.querySelector('.slider_element');
      if (!el) return;
      // oa-slider.js builds the Swiper after its bundle loads, so wait for it.
      const bind = () => {
        el.swiper.on('slideNextTransitionStart', () => turnTo(target + angle));
        el.swiper.on('slidePrevTransitionStart', () => turnTo(target - angle));
      };
      if (el.swiper) return bind();
      const mo = new MutationObserver(() => { if (el.swiper) { mo.disconnect(); bind(); } });
      mo.observe(el, { attributes: true, attributeFilter: ['class'] });
      return;
    }

    const scope = host.closest('[data-oa-plus-scope]') || host.closest('a, button') || host;

    if (trigger === 'click') {
      // Follow the opener's own state, so a close from elsewhere (Escape,
      // another item opening) turns it back too. Looked up live: the page
      // script that owns the state may set it after this runs. An empty
      // aria-expanded is a Designer leftover, not state.
      const SEL = '[aria-expanded]:not([aria-expanded=""])';
      const stateEl = () => (scope.matches(SEL) ? scope : scope.querySelector(SEL));
      const isOpen = (el) => el.getAttribute('aria-expanded') === 'true';
      const first = stateEl();
      if (first && isOpen(first)) { // starts open: set, don't animate
        target = angle;
        if (window.gsap) window.gsap.set(host, { rotation: angle });
        else host.style.transform = 'rotate(' + angle + 'deg)';
      }
      new MutationObserver(() => {
        const el = stateEl();
        if (el && (target === angle) !== isOpen(el)) turnTo(isOpen(el) ? angle : 0);
      }).observe(scope, { attributes: true, subtree: true, attributeFilter: ['aria-expanded'] });
      scope.addEventListener('click', () => { if (!stateEl()) turnTo(target === angle ? 0 : angle); });
      return;
    }

    scope.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && canHover.matches) turnTo(angle); });
    scope.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') turnTo(0); });
  }

  function boot() {
    document.querySelectorAll('[data-oa-plus]').forEach(init);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
