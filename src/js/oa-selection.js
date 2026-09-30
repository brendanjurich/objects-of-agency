// ============================================================
// OA SELECTION — saved configurations (sitewide)
// ============================================================
// A trade designer's shortlist, kept in localStorage with no login. One entry per
// distinct configuration of a piece; saving the same configuration again removes it.
//
// Hooks (Designer):
//   [data-oa-save]            Save button instance (product template, 3 of them).
//                             Gets data-oa-save-state="saved|idle" and its label swapped.
//   [data-option]             option slug, on each configurator option list item
//                             (the element that also carries data-price)
//   [data-oa-selection-count] nav count; gets the number as text and
//                             data-oa-selection-state="empty|filled"
//
// The product slug is read from the URL (/product/{slug}), not from the page.
// Price is a snapshot of the configured indicative price and never leaves the browser.

(function () {
  const KEY = 'oa-selection:v1';
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
  const TEXT = { idle: 'Save', saved: 'Saved', full: 'Selection full' };

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
  function store(list) {
    memory = list;
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
    paint();
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
    document.querySelectorAll('[data-oa-selection-count]').forEach(function (el) {
      el.textContent = n;
      el.setAttribute('data-oa-selection-state', n ? 'filled' : 'empty');
    });
  }

  function paint() {
    clearTimeout(fullTimer);
    paintButtons();
    paintCount();
  }

  function toggle(btn) {
    const entry = readConfig();
    const id = idOf(entry);
    const list = load();
    const i = list.items.findIndex(function (e) { return idOf(e) === id; });
    if (i > -1) {
      list.items.splice(i, 1);
      store(list);
      announce('Removed from your selection.');
      return;
    }
    if (list.items.length >= CAP) {
      setLabel(btn, TEXT.full);
      announce('Your selection is full — ' + CAP + ' pieces. Remove one to add another.');
      clearTimeout(fullTimer);
      fullTimer = setTimeout(paintButtons, 2500);
      return;
    }
    entry.qty = 1;
    entry.savedAt = Date.now();
    list.items.push(entry);
    store(list);
    announce('Saved to your selection. ' + list.items.length + ' of ' + CAP + '.');
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
