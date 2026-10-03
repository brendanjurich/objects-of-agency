// ============================================================
// OA SAVED ITEMS — saved configurations (sitewide)
// ============================================================
// A trade designer's shortlist, kept in localStorage with no login. One entry per
// distinct configuration of a piece; saving the same configuration again removes it.
//
// Hooks (Designer):
//   [data-oa-save]            Save button instance (product template, 3 of them).
//                             Gets data-oa-save-state="saved|idle" and its label swapped.
//   [data-option]             option slug, on each configurator option list item
//                             (the element that also carries data-price)
//   [data-oa-saved-count]     nav badge. The number goes into its text element (so the
//                             Designer's text style survives); the badge is hidden at zero
//
// Saved Items page (/saved-items) — one Products Collection List; each item is a row
// template. The slug comes from the row's link to its product page (/product/{slug}):
// Slug can't be bound as an attribute there, and a component Link prop can't point at
// the current item, so the View piece link is an unlinked Clickable bound to it.
//   [data-oa-saved-row]        the Collection item (row template)
//   [data-oa-saved-price]      price number;  [data-oa-saved-price-wrap] hidden with no price
//   [data-oa-saved-line="Sizes|Top-Material|Timber|Anodised-Finish"]
//                              config line; its parent (bullet + text) hides when empty
//   [data-oa-saved-qty="minus|plus"], [data-oa-saved-qty-value]
//   [data-oa-saved-edit]       gets /product/{slug}?cfg=…; hidden for static pieces
//   [data-oa-saved-remove]
//   [data-oa-saved-empty]      empty state
//   [data-oa-saved-project]    project name input
//   [data-oa-saved-brief|email|share]  hidden while the list is empty (wired in later phases)
//
// The product slug is read from the URL (/product/{slug}), not from the page.
// Price is a snapshot of the configured indicative price and never leaves the browser.

(function () {
  const KEY = 'oa-saved-items:v1';
  const CAP = 12;
  // Radio name → the configurator's summary element, which already holds the
  // human label (swatch radios carry no text of their own). Same list as
  // initSummaryUpdater() in oa-configurator.js.
  const SUMMARY = {
    'Sizes': 'summary-size',
    'Top-Material': 'summary-top-material',
    'Timber': 'summary-timber',
    'Anodised-Finish': 'summary-anodising',
  };
  const TEXT = { idle: 'Save', saved: 'Saved', full: 'List full' };

  // ---- store. Storage can throw (private mode, blocked site data): fall back to
  // memory so the page keeps working for this visit.
  let memory = { v: 1, project: '', items: [] };
  function load() {
    try {
      const list = JSON.parse(localStorage.getItem(KEY) || 'null');
      memory = list && Array.isArray(list.items) ? list : { v: 1, project: '', items: [] };
    } catch (e) {}
    return memory;
  }
  function write(list) {
    memory = list;
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
  }
  function store(list) {
    write(list);
    paint();
  }

  // `el.hidden` alone loses to any Designer display value; drive display inline.
  // Clearing it hands display back to the class.
  function setHidden(el, on) {
    if (!el) return;
    if (on) el.style.setProperty('display', 'none', 'important');
    else el.style.removeProperty('display');
  }

  // ---- the piece on this page
  const match = location.pathname.match(/^\/product\/([^/]+)/);
  const slug = match ? match[1] : '';

  // Hidden configurator sections (CMS toggles) stay in the DOM as w-condition-invisible,
  // with a radio checked by the slider sync — they are not part of the configuration.
  function readConfig() {
    const options = {};
    const labels = {};
    document.querySelectorAll('input[type="radio"]:checked').forEach(function (input) {
      const item = input.closest('[data-option]');
      if (!item || !SUMMARY[input.name] || input.closest('.w-condition-invisible')) return;
      options[input.name] = item.getAttribute('data-option');
      const summary = document.getElementById(SUMMARY[input.name]);
      if (summary) labels[input.name] = summary.textContent.trim();
    });
    const priceEl = document.querySelector('.configure_price');
    const price = priceEl && !priceEl.closest('.w-condition-invisible')
      ? parseFloat(priceEl.textContent.replace(/[^0-9.]/g, '')) || null
      : null;
    return { slug: slug, options: options, labels: labels, price: price };
  }

  function idOf(entry) {
    return entry.slug + '|' + Object.keys(entry.options).sort()
      .map(function (k) { return k + ':' + entry.options[k]; }).join(',');
  }

  // ---- announce (screen readers) — one polite live region, created on demand
  let live = null;
  function announce(msg) {
    if (!live) {
      live = document.createElement('div');
      live.className = 'u-sr-only';
      live.setAttribute('aria-live', 'polite');
      document.body.appendChild(live);
    }
    live.textContent = '';
    setTimeout(function () { live.textContent = msg; }, 50);
  }

  // ---- Save buttons. Lumos Button Main renders the label three times: the visible
  // .button_main_text and an sr-only copy in both the link and the button.
  function setLabel(btn, text) {
    btn.querySelectorAll('.button_main_text, .clickable_text').forEach(function (el) { el.textContent = text; });
  }
  let fullTimer = null;
  function paintButtons() {
    if (!slug) return;
    const id = idOf(readConfig());
    const saved = load().items.some(function (e) { return idOf(e) === id; });
    document.querySelectorAll('[data-oa-save]').forEach(function (btn) {
      btn.setAttribute('data-oa-save-state', saved ? 'saved' : 'idle');
      setLabel(btn, saved ? TEXT.saved : TEXT.idle);
    });
  }

  function paintCount() {
    const n = load().items.length;
    document.querySelectorAll('[data-oa-saved-count]').forEach(function (el) {
      (el.firstElementChild || el).textContent = n || '';
      setHidden(el, !n);
    });
  }

  // ---- Saved Items page. Every template stays hidden in place; each saved entry renders
  // as a copy inserted before its template, so the Collection List's own sort (series,
  // then name) is the page order and a second configuration sits beside the first.
  // Hidden now, at parse, so unsaved rows never paint.
  const templates = [];
  document.querySelectorAll('[data-oa-saved-row]').forEach(function (row) {
    const link = row.querySelector('a[href^="/product/"]');
    if (!link) return;
    templates.push({ row: row, slug: link.getAttribute('href').split('/')[2], copy: row.cloneNode(true) });
    setHidden(row, true);
  });
  const project = document.querySelector('[data-oa-saved-project]');
  const formatter = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 0 });

  function fillRow(row, entry) {
    const price = row.querySelector('[data-oa-saved-price]');
    if (price) price.textContent = entry.price ? formatter.format(entry.price) : '';
    setHidden(row.querySelector('[data-oa-saved-price-wrap]'), !entry.price);
    row.querySelectorAll('[data-oa-saved-line]').forEach(function (el) {
      const label = (entry.labels || {})[el.getAttribute('data-oa-saved-line')] || '';
      el.textContent = label;
      setHidden(el.parentElement, !label);
    });
    const qty = row.querySelector('[data-oa-saved-qty-value]');
    if (qty) qty.textContent = entry.qty || 1;
    const keys = Object.keys(entry.options);
    const edit = row.querySelector('[data-oa-saved-edit]');
    setHidden(edit, !keys.length);
    const editLink = edit && edit.querySelector('a');
    if (editLink) editLink.setAttribute('href', '/product/' + entry.slug + '?cfg=' +
      keys.map(function (k) { return k + ':' + entry.options[k]; }).join(','));
  }

  function renderPage() {
    if (!templates.length) return;
    document.querySelectorAll('[data-oa-saved-rendered]').forEach(function (el) { el.remove(); });
    const list = load();
    let shown = 0;
    templates.forEach(function (t) {
      list.items.forEach(function (entry) {
        if (entry.slug !== t.slug) return;
        const row = t.copy.cloneNode(true);
        row.setAttribute('data-oa-saved-rendered', idOf(entry));
        fillRow(row, entry);
        t.row.parentNode.insertBefore(row, t.row);
        shown++;
      });
    });
    setHidden(document.querySelector('[data-oa-saved-empty]'), shown > 0);
    document.querySelectorAll('[data-oa-saved-brief], [data-oa-saved-email], [data-oa-saved-share]')
      .forEach(function (el) { setHidden(el, !shown); });
    if (project && document.activeElement !== project) project.value = list.project || '';
  }

  function paint() {
    clearTimeout(fullTimer);
    paintButtons();
    paintCount();
    renderPage();
  }

  function toggle(btn) {
    const entry = readConfig();
    const id = idOf(entry);
    const list = load();
    const i = list.items.findIndex(function (e) { return idOf(e) === id; });
    if (i > -1) {
      list.items.splice(i, 1);
      store(list);
      announce('Removed from your saved items.');
      return;
    }
    if (list.items.length >= CAP) {
      setLabel(btn, TEXT.full);
      announce('Your saved items are full — ' + CAP + ' pieces. Remove one to add another.');
      clearTimeout(fullTimer);
      fullTimer = setTimeout(paintButtons, 2500);
      return;
    }
    entry.qty = 1;
    entry.savedAt = Date.now();
    list.items.push(entry);
    store(list);
    announce('Added to your saved items. ' + list.items.length + ' of ' + CAP + '.');
  }

  // Capture phase: oa-global.js's page-leave handler is a bubbling document listener
  // registered first, and it skips clicks that are already defaultPrevented. Without
  // this the static Saves (href="/contact") would fade the page out and navigate.
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-oa-save]');
    if (!btn || !slug) return;
    e.preventDefault();
    toggle(btn);
  }, true);

  // Row controls. Capture phase for the same reason as Save: their links are href="#".
  // Qty updates in place so keyboard focus stays on the button; Remove re-renders and
  // moves focus to the row that took its place.
  document.addEventListener('click', function (e) {
    const row = e.target.closest('[data-oa-saved-rendered]');
    const remove = row && e.target.closest('[data-oa-saved-remove]');
    const step = row && e.target.closest('[data-oa-saved-qty]');
    if (!remove && !step) return;
    e.preventDefault();
    const list = load();
    const id = row.getAttribute('data-oa-saved-rendered');
    const i = list.items.findIndex(function (x) { return idOf(x) === id; });
    if (i < 0) return;
    if (step) {
      const entry = list.items[i];
      const delta = step.getAttribute('data-oa-saved-qty') === 'plus' ? 1 : -1;
      entry.qty = Math.max(1, Math.min(99, (entry.qty || 1) + delta));
      write(list);
      const value = row.querySelector('[data-oa-saved-qty-value]');
      if (value) value.textContent = entry.qty;
      announce('Quantity ' + entry.qty + '.');
      return;
    }
    const rows = Array.prototype.slice.call(document.querySelectorAll('[data-oa-saved-rendered]'));
    const at = rows.indexOf(row);
    list.items.splice(i, 1);
    store(list);
    const left = document.querySelectorAll('[data-oa-saved-rendered]');
    const next = left[Math.min(at, left.length - 1)];
    // Lumos Clickable renders a link and a button and shows one (a[href="#"] is hidden),
    // so focus whichever is rendered.
    const scope = next ? next.querySelector('[data-oa-saved-remove]') : document.querySelector('[data-oa-saved-empty]');
    const focus = scope && Array.prototype.slice.call(scope.querySelectorAll('a, button'))
      .filter(function (el) { return el.getClientRects().length; })[0];
    if (focus) focus.focus();
    announce('Removed from your saved items.');
  }, true);

  if (project) project.addEventListener('input', function () {
    const list = load();
    list.project = project.value.slice(0, 120);
    write(list);
  });

  // A new configuration may or may not be saved already
  document.addEventListener('change', function (e) {
    if (e.target.type === 'radio' && SUMMARY[e.target.name]) paintButtons();
  });
  // Another tab changed the list, or this page came back from bfcache after an edit
  window.addEventListener('storage', function (e) { if (e.key === KEY) paint(); });
  window.addEventListener('pageshow', function (e) { if (e.persisted) paint(); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paint);
  else paint();
})();
