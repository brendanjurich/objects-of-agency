/* ============================================================
   OSMO — Legal document index (table of contents)
   ------------------------------------------------------------
   Adapted for Objects of Agency from osmo.supply's "Table of
   Contents for Article". Differences from the stock resource:
     • No CDN GSAP. Uses Webflow-native window.gsap for the mobile
       accordion's motion only, and fails open — without it the
       accordion opens and closes without animation.
     • No scroll-following highlight. The selected section is the
       link last taken, and it holds until another is taken.
     • The section number is split into its own prefix element.
     • A back-to-top button for touch, shown while the folded index
       is out of view.
     • Their click handler is gone. Same-page anchor scrolling already
       belongs to initNavAnchorLinks in oa-global.js, which owns the
       Lenis call, the capture-phase stop of Webflow's own anchor
       scroll, and the focus move. That handler was nav-only; it now
       also accepts links inside [data-oa-anchor-scroll]. One
       interaction, one owner — not a second copy here.
     • data-toc-offset (a hardcoded 80px) dropped. Clearance under the
       fixed nav comes from the heading's own scroll-margin-top, read
       live, so it tracks the breakpoint — the /all-products convention.
     • {skip} marker, data-toc-ignore and the h3 depth rules deleted.
       The pack's documents are a flat list of sections, so the index takes
       the shallowest heading level present and nothing consumed the rest.
     • Attributes namespaced data-legal-toc-*.
     • Below the Lumos medium boundary the index folds into an accordion,
       because Terms & Conditions has 14 sections and a stacked list
       pushes the document off the screen. The accordion is an unlinked
       Lumos item restyled as .oa-accordion_*, pulled out of the Accordion
       List component: that component's embed script finds its items by
       the stock .accordion_* class names, so renaming them left it with
       nothing to bind. This file owns it now, by attribute, so a class
       rename in the Designer can never break it again.
   Page-level embed (legal pages). Raw-served (no build).
   ============================================================ */
const initLegalToc = () => {
  // Anchored on the list, and the document is found page-wide rather than
  // inside a shared wrapper. The first build required both to sit under one
  // [data-legal-toc-wrap]; a Designer rebuild around the `• oa Titles + Text`
  // component then put the index and the document in sibling branches whose
  // only common ancestor is inside that component — where an attribute would
  // ride every instance sitewide. One legal document per page, so page scope
  // is the honest scope, and there is no wrapper left to break.
  document.querySelectorAll('[data-legal-toc-list]').forEach((listEl) => {
    const contentEl = document.querySelector('[data-legal-toc-content]');
    const templateLink = listEl.querySelector('[data-legal-toc-link]');
    if (!contentEl || !templateLink) return;

    // The shallowest heading level present, not a hardcoded h2. Every document
    // in the legal pack is a flat numbered list of sections, so whichever level
    // the Rich Text ended up carrying IS the section level — and what a paste
    // into Webflow produces is not reliably h2 (Delivery & Returns came through
    // as h5). Deeper levels stay out of the index, which is what a flat index
    // wants anyway.
    let headings = [];
    for (let level = 2; level <= 6 && !headings.length; level += 1) {
      headings = Array.from(contentEl.querySelectorAll('h' + level)).filter(
        (h) => h.textContent.trim()
      );
    }
    if (!headings.length) return;

    const slugCounts = new Map();
    const slugify = (text) => {
      let slug = text
        .toLowerCase()
        // Drop the section number from the id only — "1. How delivery works"
        // becomes "how-delivery-works". Two reasons: a digit-leading id is a
        // legal id but an INVALID CSS selector, and oa-global.js resolves the
        // target with querySelector, so "#1-how-delivery-works" would throw,
        // be swallowed by its try/catch, and quietly hand the scroll back to
        // Webflow — which ignores scroll-margin-top and parks the heading
        // under the nav. Second reason: the numbers are the solicitor's to
        // change, and renumbering shouldn't break every anchor. The heading
        // itself keeps its number; only the id loses it.
        .replace(/^\s*\d+[.)]?\s*/, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      if (!slug || /^[0-9]/.test(slug)) slug = 'section-' + (slug || slugCounts.size + 1);
      const count = slugCounts.get(slug) || 0;
      slugCounts.set(slug, count + 1);
      return count === 0 ? slug : slug + '-' + (count + 1);
    };

    headings.forEach((heading) => {
      if (!heading.id) heading.id = slugify(heading.textContent.trim());
    });

    const links = headings.map((heading) => {
      const link = templateLink.cloneNode(true);
      const textTarget = link.querySelector('[data-legal-toc-text]') || link;
      // The section number goes to its own element so the Designer can style
      // and space it apart from the title. Without a prefix element the whole
      // heading stays in the text, number and all. An unnumbered heading
      // leaves the prefix empty.
      const prefixTarget = link.querySelector('[data-legal-toc-prefix]');
      const full = heading.textContent.trim();
      const match = prefixTarget && full.match(/^(\d+[.)]?)\s*(.*)$/);
      if (prefixTarget) prefixTarget.textContent = match ? match[1] : '';
      textTarget.textContent = match ? match[2] : full;
      link.href = '#' + heading.id;
      link.removeAttribute('data-legal-toc-link');
      link.setAttribute('data-legal-toc-item', '');
      listEl.appendChild(link);
      return link;
    });
    templateLink.remove();

    // Mobile accordion. Closed on load, closes again after a link is taken so
    // the reader lands on the section rather than back at the index.
    //   [data-legal-toc-accordion]  the item; carries the timing knobs
    //   [data-legal-toc-toggle]     the button; its aria-expanded IS the state
    //   [data-legal-toc-panel]      the element whose height animates
    // The open look is Designer work through Lumos's own state system: with
    // data-state="expanded" on the item, an aria-expanded="true" inside it flips
    // --_state---true / --_state---false for everything below, which is what
    // the icon's rotate(calc(-180deg * var(--_state---false))) already reads.
    // CSS draws the closed state, so the accordion still works without GSAP —
    // it just opens and closes without motion.
    const accordion = document.querySelector('[data-legal-toc-accordion]');
    const toggle = accordion && accordion.querySelector('[data-legal-toc-toggle]');
    const panel = accordion && accordion.querySelector('[data-legal-toc-panel]');
    if (toggle && panel) {
      const gsap = window.gsap;
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
      const knob = (name, fallback) => accordion.getAttribute('data-legal-toc-' + name) || fallback;
      const seconds = (name, fallback) => {
        const value = parseFloat(knob(name, ''));
        return isNaN(value) ? fallback : value;
      };
      // Whether the accordion is folded right now. Read off the toggle rather
      // than a viewport width, so it follows whatever boundary the CSS draws.
      const folded = () => toggle.getClientRects().length > 0;
      // Opening or closing changes the page's length under the highlight
      // triggers, which measured their positions against the old layout.
      const remeasure = () => window.ScrollTrigger && window.ScrollTrigger.refresh();

      const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';

      const setOpen = (open, instant) => {
        if (open === isOpen()) return;
        const from = panel.offsetHeight; // mid-tween height, so a reversal continues
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (!gsap) return;

        gsap.killTweensOf([panel, ...links]);
        gsap.set(links, { clearProps: 'opacity,transform' });
        if (instant || reducedMotion.matches || !folded()) {
          gsap.set(panel, { clearProps: 'height,visibility' });
          remeasure();
          return;
        }

        // Easing is chosen per direction — see "Easing" in docs/REFERENCE.md.
        // Opening is an entrance: out-ease, so the panel answers the tap at
        // once and settles softly. Closing is an exit that stays in view:
        // shorter, in-out, so the content below neither lurches nor stops dead.
        if (open) {
          gsap.fromTo(panel, { height: from }, {
            height: 'auto',
            duration: seconds('duration', 0.45),
            ease: knob('ease', 'power3.out'),
            clearProps: 'height,visibility',
            onComplete: remeasure
          });
          // The items arrive just behind the edge that uncovers them — a short
          // rise and fade, rippling down the list. 0 turns it off.
          const stagger = seconds('stagger', 0.025);
          if (stagger > 0) {
            gsap.fromTo(links, { opacity: 0, y: 8 }, {
              opacity: 1,
              y: 0,
              duration: 0.35,
              ease: 'power2.out',
              delay: 0.05,
              stagger,
              clearProps: 'opacity,transform'
            });
          }
        } else {
          // visibility stays on until the panel has shut; the CSS closed state
          // hides it, which keeps collapsed links out of the tab order.
          gsap.fromTo(panel, { height: from, visibility: 'visible' }, {
            height: 0,
            duration: seconds('duration-close', 0.3),
            ease: knob('ease-close', 'power2.inOut'),
            clearProps: 'height,visibility',
            onComplete: remeasure
          });
        }
      };

      // Closed on load, whatever the Designer left on the button.
      toggle.setAttribute('aria-expanded', 'false');
      if (!panel.id) panel.id = 'legal-toc-panel';
      toggle.setAttribute('aria-controls', panel.id);

      // preventDefault in case the toggle is ever a Webflow Button, which
      // renders as <a href="#"> and would jump the page to the top.
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        setOpen(!isOpen());
      });
      // Close on the click, ahead of initNavAnchorLinks. Three things forced
      // this exact spot:
      //   1. A close handler on the list never runs. initNavAnchorLinks calls
      //      stopPropagation() in the document's capture phase to stop
      //      Webflow's own anchor scroll, which kills every listener below it.
      //   2. Closing after it overshoots by the height of the open index: it
      //      measures the target first, then the collapse shortens the page
      //      under the scroll already in flight.
      //   3. Closing on pointerdown (the previous fix) kills the tap. The link
      //      collapses out from under the finger, pointerup lands on whatever
      //      moved into its place, and the click never reaches the link.
      // window's capture phase runs before any document listener, after the
      // click has already been dispatched to the link. Keyboard Enter fires the
      // same click, so this covers both. The close is instant, not animated: a
      // collapse still running when the scroll is measured is the overshoot.
      window.addEventListener(
        'click',
        (e) => {
          if (e.target.closest && e.target.closest('[data-legal-toc-item]')) setOpen(false, true);
        },
        true
      );
    }

    // The selected section: the link last taken, held until another is taken.
    // Not scroll-following — that version stalled on the last section a short
    // page can scroll its heading to, and read as broken. Bound on window
    // capture for the same reason as the close above: initNavAnchorLinks stops
    // the click before it reaches anything on the list.
    const setActive = (active) => {
      links.forEach((link) => {
        if (link === active) link.setAttribute('data-legal-toc-status', 'active');
        else link.removeAttribute('data-legal-toc-status');
      });
    };
    window.addEventListener(
      'click',
      (e) => {
        const link = e.target.closest && e.target.closest('[data-legal-toc-item]');
        if (link) setActive(link);
      },
      true
    );
    // A shared link to a section arrives selected.
    const arrived = links.find((link) => link.getAttribute('href') === location.hash);
    if (arrived) setActive(arrived);

    // Back to top: a fixed button for touch, shown only while the index is
    // folded into its accordion (the sticky desktop index already does this
    // job) and scrolled out of view above. A Link Block to "#" in the
    // Designer, so it still reaches the top without this script.
    //   [data-legal-toc-top]         the button; how it looks and where it
    //                                sits are Designer knobs
    //   data-legal-toc-top-state     written here, "visible" or "hidden"
    const topButton = document.querySelector('[data-legal-toc-top]');
    const indexEl = accordion || listEl;
    if (topButton) {
      let indexAbove = false;
      const update = () => {
        const show = indexAbove && !!toggle && toggle.getClientRects().length > 0;
        topButton.setAttribute('data-legal-toc-top-state', show ? 'visible' : 'hidden');
        // inert takes a hidden button out of the tab order and the
        // accessibility tree, so the CSS can fade it without visibility.
        topButton.inert = !show;
      };
      new IntersectionObserver(([entry]) => {
        indexAbove = !entry.isIntersecting && entry.boundingClientRect.bottom < 0;
        update();
      }).observe(indexEl);
      window.addEventListener('resize', update, { passive: true });
      update();

      topButton.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.lenis) window.lenis.scrollTo(0);
        else window.scrollTo({ top: 0, behavior: 'smooth' }); // reduced motion / Lenis CDN down
        // The button hides once the index is back in view, which would drop
        // keyboard focus to the body. Hand it to the index toggle instead.
        if (toggle) toggle.focus({ preventScroll: true });
      });
    }
  });
};

document.addEventListener('DOMContentLoaded', initLegalToc);
