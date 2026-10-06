/* ============================================================
   OA — Line loader (Study A)
   ------------------------------------------------------------
   The OA mark's outline draws itself as one line, holds closed,
   then the tail chases the head out along the same path, and loops.
   Spec: command-centre inbox/2026-10-06-oa-loader-line-handoff.md.

   Host: any element with data-oa-loader="line". Its CSS width (a
   Designer class) sets the size; height follows the mark, 504:499.
   Designer knobs, all optional, read once at init:
     data-oa-loader-draw / -hold / -release / -gap   ms
     data-oa-loader-stroke   on-screen px at any size (default 1.25)
     data-oa-loader-color    any CSS colour (default currentColor)
   A bad value falls back to its default.

   Runs only while the host is on screen and not display:none or
   visibility:hidden, and restarts from empty each time it shows.
   Reduced motion: the whole outline, still.
   Sitewide footer. Raw-served (no build).
   ============================================================ */

(function () {
  const VIEW_W = 504;
  const VIEW_H = 499;
  // 02-brand/oa-logo/clean-svg/oa-logo-line.svg, verbatim. Starts and ends at the pill's lower-right corner.
  const PATH = 'M499.405,276.066c0.717,0 1.4,0.307 1.876,0.843c0.476,0.536 0.7,1.251 0.615,1.963c-14.947,122.354 -120.827,217.315 -249.046,217.315c-138.448,0 -250.85,-110.716 -250.85,-247.087c0,-136.371 112.402,-247.087 250.85,-247.087c52.957,-0 108.048,18.303 143.063,43.998c1.603,1.191 2.2,3.314 1.452,5.165c-12.386,30.662 -112.049,277.339 -127.789,316.295c-0.469,1.16 -0.33,2.477 0.369,3.514c0.699,1.037 1.869,1.659 3.119,1.659c12.764,0 43.691,0 52.757,0c1.534,-0 2.914,-0.931 3.489,-2.353c10.194,-25.231 99.191,-245.506 112.32,-278.002c0.399,-0.989 1.274,-1.707 2.322,-1.906c1.048,-0.199 2.125,0.148 2.86,0.922c12.403,13.18 49.584,67.491 55.178,128.1c0.062,0.701 -0.173,1.395 -0.648,1.914c-0.475,0.519 -1.146,0.814 -1.849,0.814c-12.404,0.002 -62.896,0.002 -62.896,0.002c-14.883,0 -26.966,12.083 -26.966,26.966c0,14.883 12.083,26.966 26.966,26.966c0,0 50.254,-0 62.807,-0Z';
  const DEFAULTS = { draw: 1850, hold: 590, release: 1550, gap: 210, stroke: 1.25 };
  const EASE_DRAW = 'cubic-bezier(.45, 0, .15, 1)';
  const EASE_RELEASE = 'cubic-bezier(.55, 0, .35, 1)';
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function knob(host, name, min) {
    const v = parseFloat(host.getAttribute('data-oa-loader-' + name));
    return Number.isFinite(v) && v >= min ? v : DEFAULTS[name];
  }

  function build(host, still) {
    const t = {
      draw: knob(host, 'draw', 0),
      hold: knob(host, 'hold', 0),
      release: knob(host, 'release', 0),
      gap: knob(host, 'gap', 0),
    };
    const stroke = knob(host, 'stroke', 0.01);
    const color = host.getAttribute('data-oa-loader-color');

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + VIEW_W + ' ' + VIEW_H);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.style.cssText = 'display:block;width:100%;height:auto;overflow:visible';
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', PATH);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', color && CSS.supports('color', color) ? color : 'currentColor');
    path.setAttribute('stroke-linecap', 'butt');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('pathLength', '1');
    if (!still) {
      path.setAttribute('stroke-dasharray', '1 1');
      path.setAttribute('stroke-dashoffset', '1');
    }
    svg.appendChild(path);
    host.replaceChildren(svg);

    if (!host.hasAttribute('role')) host.setAttribute('role', 'status');
    if (!host.hasAttribute('aria-label') && !host.hasAttribute('aria-labelledby')) host.setAttribute('aria-label', 'Loading');

    // Stroke is on-screen px: convert to viewBox units from the drawn width, and again on resize.
    new ResizeObserver(function (entries) {
      const w = entries[0].contentRect.width;
      if (w > 0) path.setAttribute('stroke-width', String(stroke * VIEW_W / w));
    }).observe(host);

    if (still) return null;

    // Offset 1 → 0 → −1: the release runs on in the draw's direction, so the tail chases the head out.
    let total = t.draw + t.hold + t.release + t.gap;
    if (total <= 0) { Object.assign(t, DEFAULTS); total = t.draw + t.hold + t.release + t.gap; }
    const anim = path.animate([
      { offset: 0, strokeDashoffset: 1, easing: EASE_DRAW },
      { offset: t.draw / total, strokeDashoffset: 0, easing: 'linear' },
      { offset: (t.draw + t.hold) / total, strokeDashoffset: 0, easing: EASE_RELEASE },
      { offset: (t.draw + t.hold + t.release) / total, strokeDashoffset: -1, easing: 'linear' },
      { offset: 1, strokeDashoffset: -1 },
    ], { duration: total, iterations: Infinity });
    anim.pause();
    return { host: host, anim: anim, inView: false, running: false };
  }

  function init() {
    const hosts = document.querySelectorAll('[data-oa-loader="line"]');
    if (!hosts.length) return;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const loaders = [];
    hosts.forEach(function (host) {
      const l = build(host, still);
      if (l) loaders.push(l);
    });
    if (!loaders.length) return;

    // Run only while shown; each showing starts from empty.
    function shown(l) {
      if (!l.inView) return false;
      return l.host.checkVisibility
        ? l.host.checkVisibility({ visibilityProperty: true })
        : getComputedStyle(l.host).visibility !== 'hidden';
    }
    function sync(l) {
      const on = shown(l);
      if (on === l.running) return;
      l.running = on;
      if (on) { l.anim.currentTime = 0; l.anim.play(); } else l.anim.pause();
    }

    let queued = false;
    function syncSoon() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; loaders.forEach(sync); });
    }
    function touches(node) {
      return loaders.some(function (l) { return node === l.host || (node.contains && node.contains(l.host)); });
    }

    // Off screen and display:none come from the observer; visibility from ancestor
    // attribute changes and their transitions (a fade-out turns hidden only at its end).
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        const l = loaders.find(function (x) { return x.host === e.target; });
        l.inView = e.isIntersecting;
        sync(l);
      });
    });
    loaders.forEach(function (l) { io.observe(l.host); });

    new MutationObserver(function (records) {
      if (records.some(function (r) { return touches(r.target); })) syncSoon();
    }).observe(document.documentElement, { attributes: true, subtree: true });
    ['transitionstart', 'transitionend', 'transitioncancel'].forEach(function (type) {
      document.addEventListener(type, function (e) { if (touches(e.target)) syncSoon(); }, true);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
