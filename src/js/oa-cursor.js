/* ============================================================
   OSMO — Dynamic Text Cursor
   ------------------------------------------------------------
   Adapted for Objects of Agency from osmo.supply's "Dynamic Text
   Cursor". Differences from the stock resource:
     • No CDN GSAP — reuses window.gsap from Webflow's integration and
       skips instead of throwing when it is absent. A second gsap makes a
       duplicate window.gsap that clobbers the CustomEase registration in
       oa-global.js.
     • Mount and state are separate attributes: data-cursor-init marks the
       element, data-cursor-status carries what CSS reads. Stock overloads
       data-cursor for both, which couples the two layers together.
     • Every selector is an attribute, never their BEM classes, so the
       Designer owns the class names and can rename them freely.
     • One hit-test per animation frame. Stock queues a fresh
       requestAnimationFrame on every mousemove, so a fast pointer runs
       several elementFromPoint tests — each forcing layout — per paint.
     • Reduced motion places the bubble on the pointer and keeps the label,
       rather than dropping the feature.
     • Size, colour, radius, padding and type are Designer knobs — see
       oa-cursor.css for what this layer deliberately does not set.
   Page-level embed (/contact). Raw-served (no build).
   ============================================================ */

function initDynamicTextCursor() {
  const cursor = document.querySelector('[data-cursor-init]');
  if (!cursor) return; // page carries no cursor markup — nothing to mount

  // Capability, not width: a touchscreen laptop still hovers, an iPad Pro does not.
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  if (!window.gsap) {
    console.warn('[oa-cursor] gsap unavailable — skipping init.');
    return;
  }

  const textTarget = cursor.querySelector('[data-cursor-text-target]');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Reduced motion keeps the label and the hover states and drops only the trail:
  // the bubble is placed on the pointer instead of chasing it.
  const xTo = reduced
    ? v => gsap.set(cursor, { x: v })
    : gsap.quickTo(cursor, 'x', { duration: 0.4, ease: 'power3.out' });
  const yTo = reduced
    ? v => gsap.set(cursor, { y: v })
    : gsap.quickTo(cursor, 'y', { duration: 0.4, ease: 'power3.out' });

  let mouseX = 0;
  let mouseY = 0;
  let hasMoved = false;
  let queued = false;

  function update() {
    queued = false;

    // Resolved at pointer time rather than bound per node, so a list that is
    // destroyed and rebuilt — the brief's piece tags are, on every change —
    // never needs rebinding. The bubble is pointer-events:none in the CSS, so
    // elementFromPoint returns what is under it, never the bubble itself.
    const hit = document.elementFromPoint(mouseX, mouseY);
    const item = hit && hit.closest('[data-cursor-hover]');
    const atEdge = cursor.getBoundingClientRect().right >= window.innerWidth;

    cursor.setAttribute('data-cursor-status', item ? (atEdge ? 'active-edge' : 'active') : '');

    if (item && textTarget) {
      const label = item.getAttribute('data-cursor-text');
      if (label) textTarget.textContent = label;
    }
  }

  // At most one hit-test per frame. mousemove fires several times between paints
  // on a fast pointer, and every elementFromPoint call forces layout.
  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  }

  window.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    hasMoved = true;
    xTo(mouseX);
    yTo(mouseY);
    queue();
  });

  // Scrolling moves the page under a stationary pointer, so what it sits over
  // changes without a mousemove. Skipped until the pointer has been seen once,
  // or the first scroll hit-tests the top-left corner.
  window.addEventListener('scroll', () => {
    if (hasMoved) queue();
  }, { passive: true });
}

document.addEventListener('DOMContentLoaded', initDynamicTextCursor);
