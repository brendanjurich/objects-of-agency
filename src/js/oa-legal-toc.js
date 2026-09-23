/* ============================================================
   OSMO — Legal document index (table of contents)
   ------------------------------------------------------------
   Adapted for Objects of Agency from osmo.supply's "Table of
   Contents for Article". Differences from the stock resource:
     • No CDN GSAP. Uses Webflow-native window.gsap + ScrollTrigger,
       and fails open — the index still builds and navigates when
       GSAP is absent, it just loses the scroll-following highlight.
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
     • Mobile adds a disclosure: the index collapses behind a toggle,
       because Terms & Conditions has 14 sections and a stacked list
       pushes the document off the screen.
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
      textTarget.textContent = heading.textContent.trim();
      link.href = '#' + heading.id;
      link.removeAttribute('data-legal-toc-link');
      link.setAttribute('data-legal-toc-item', '');
      listEl.appendChild(link);
      return link;
    });
    templateLink.remove();

    // Mobile disclosure. Closed on load, closes again after a link is taken so
    // the reader lands on the section rather than back at the index.
    // The state rides the list's own parent — whatever the Designer has made
    // that, the CSS only tests for the attribute on an ancestor.
    const toggle = document.querySelector('[data-legal-toc-toggle]');
    const stateEl = listEl.parentElement || listEl;
    if (toggle) {
      const setOpen = (open) => {
        stateEl.setAttribute('data-legal-toc-open', open ? 'true' : 'false');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      };
      setOpen(false);
      // preventDefault because a Webflow Button renders as <a href="#">, which
      // would otherwise jump the page to the top on every tap.
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        setOpen(stateEl.getAttribute('data-legal-toc-open') !== 'true');
      });
      // Bubble phase and no stopPropagation: oa-global.js's capture-phase
      // handler has already claimed this click and must still run.
      listEl.addEventListener('click', (e) => {
        if (e.target.closest('[data-legal-toc-item]')) setOpen(false);
      });
    }

    const ScrollTrigger = window.ScrollTrigger;
    if (!window.gsap || !ScrollTrigger) {
      console.warn('[oa-legal-toc] gsap/ScrollTrigger unavailable — index built, highlight skipped.');
      return;
    }

    const setActive = (index) => {
      links.forEach((link, i) => {
        if (i === index) link.setAttribute('data-legal-toc-status', 'active');
        else link.removeAttribute('data-legal-toc-status');
      });
    };

    headings.forEach((heading, i) => {
      const next = headings[i + 1];
      // Same number the scroll lands on, so a section highlights exactly when
      // its heading reaches its resting position under the nav.
      const offset = parseFloat(getComputedStyle(heading).scrollMarginTop) || 0;
      ScrollTrigger.create({
        trigger: heading,
        start: 'top ' + (offset + 1) + 'px',
        endTrigger: next || contentEl,
        end: next ? 'top ' + (offset + 1) + 'px' : 'bottom top',
        onToggle: (self) => {
          if (self.isActive) setActive(i);
        }
      });
    });

    // Above the first heading nothing is in range, which would leave the index
    // blank for the intro paragraph.
    setActive(0);
  });
};

document.addEventListener('DOMContentLoaded', initLegalToc);
