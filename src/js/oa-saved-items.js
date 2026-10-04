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
//   [data-oa-saved-name]       piece name; copied into the saved entry for the brief
//   [data-oa-saved-price]      price number;  [data-oa-saved-price-wrap] hidden with no price
//   [data-oa-saved-line="Sizes|Top-Material|Timber|Anodised-Finish"]
//                              config line; its parent (bullet + text) hides when empty
//   [data-oa-saved-qty="minus|plus"], [data-oa-saved-qty-value]
//   [data-oa-saved-edit]       gets /product/{slug}?cfg=…; hidden for static pieces
//   [data-oa-saved-remove]
//   [data-oa-saved-empty]      empty state
//   [data-oa-saved-wrap]       the list section (project field, rows, CTAs): hidden when empty
//   [data-oa-saved-missing]    notice, shown after dropping saved pieces that left the CMS
//   [data-oa-saved-project]    project name input
//   [data-oa-saved-brief|email|share]  hidden while the list is empty. Brief: the Designer's
//                              link gets ?from=saved-items, and oa-brief.js reads this store
//
// Email me this list: [data-oa-saved-email] opens the panel; the selection-intake Edge
// Function stores the list and emails it with a share link it builds itself (no price).
//   [data-oa-saved-email-form]    panel (a plain div, not a Webflow Form). Knobs on it:
//                                 data-oa-saved-email-endpoint, data-oa-saved-turnstile-key,
//                                 data-oa-saved-email-{sending|sent|invalid|error}-text
//   [data-oa-saved-email-input], [data-oa-saved-email-send], [data-oa-saved-email-status]
//   [data-oa-saved-honeypot]      hidden input; a name autofill doesn't know (not "website")
//   [data-oa-saved-share-price]  on the checkbox, its label, or inside the label: put prices
//                              in the link
//
// Share link: [data-oa-saved-share] copies (touch: share sheet) this page's URL with
// ?s=<base64url JSON> — project, and per item slug, qty, option slugs + labels, and the
// price only when [data-oa-saved-share-price] is ticked. Opening it shows that list
// read-only: storage is never touched, row controls, CTAs and the checkbox are hidden,
// the project field is read-only.
//   [data-oa-saved-shared]     shown only on a shared link (e.g. a banner)
//   [data-oa-saved-import]     "Add to my saved items": merges the shared list into the
//                              visitor's own (dedupe, cap) and drops ?s= in place
//
// The product slug is read from the URL (/product/{slug}), not from the page.
// Price is a snapshot of the configured indicative price and never reaches a server.

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
  const TEXT = { idle: 'Save', saved: 'Saved', full: 'List full', copied: 'Link copied' };
  const GROUPS = Object.keys(SUMMARY);
  const startedAt = Date.now();

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

  // ---- share link. Item = [slug, qty, [[group index, option slug, label], …], price?].
  // Anything malformed rejects the whole link, and the visitor sees their own list.
  function toBase64url(text) {
    let bin = '';
    new TextEncoder().encode(text).forEach(function (b) { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function fromBase64url(text) {
    const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    return new TextDecoder().decode(Uint8Array.from(bin, function (c) { return c.charCodeAt(0); }));
  }
  function encodeShare(list) {
    return toBase64url(JSON.stringify({
      v: 1,
      p: list.project || '',
      $: list.sharePrice ? 1 : 0,
      i: list.items.map(function (e) {
        const item = [e.slug, e.qty || 1, Object.keys(e.options).map(function (k) {
          return [GROUPS.indexOf(k), e.options[k], (e.labels || {})[k] || ''];
        })];
        if (list.sharePrice && e.price) item.push(e.price);
        return item;
      }),
    }));
  }
  const SLUG = /^[a-z0-9-]{1,100}$/;
  function decodeShare(param) {
    try {
      const d = JSON.parse(fromBase64url(param));
      if (d.v !== 1 || !Array.isArray(d.i) || d.i.length > CAP || typeof d.p !== 'string') return null;
      const items = d.i.map(function (it) {
        if (!SLUG.test(it[0]) || !Array.isArray(it[2])) throw 0;
        const options = {};
        const labels = {};
        it[2].forEach(function (o) {
          const group = GROUPS[o[0]];
          if (!group || !SLUG.test(o[1]) || typeof o[2] !== 'string') throw 0;
          options[group] = o[1];
          labels[group] = o[2].slice(0, 80);
        });
        const price = d.$ && typeof it[3] === 'number' && it[3] > 0 && it[3] < 1e7 ? it[3] : null;
        const qty = Math.max(1, Math.min(99, parseInt(it[1], 10) || 1));
        return { slug: it[0], options: options, labels: labels, price: price, qty: qty };
      });
      return { v: 1, project: d.p.slice(0, 120), items: items };
    } catch (e) {
      return null;
    }
  }
  const shareParam = new URLSearchParams(location.search).get('s');
  let shared = shareParam ? decodeShare(shareParam) : null;

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
    const name = row.querySelector('[data-oa-saved-name]');
    templates.push({ row: row, slug: link.getAttribute('href').split('/')[2], copy: row.cloneNode(true),
      name: name ? name.textContent.trim() : '' });
    setHidden(row, true);
  });
  const project = document.querySelector('[data-oa-saved-project]');
  const missing = document.querySelector('[data-oa-saved-missing]');
  setHidden(missing, true);
  let dropped = 0;
  // The brief (/contact) reads this store, so tell it where the visitor came from
  document.querySelectorAll('[data-oa-saved-brief] a[href]').forEach(function (a) {
    if (a.getAttribute('href').charAt(0) !== '/') return;
    const url = new URL(a.getAttribute('href'), location.origin);
    url.searchParams.set('from', 'saved-items');
    a.setAttribute('href', url.pathname + url.search + url.hash);
  });
  const formatter = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 0 });

  // The hook may sit on the input, the label or the label's text (Lumos Form Checkbox
  // props reach the input and the text span); show/hide the whole label either way.
  const sharePriceHook = document.querySelector('[data-oa-saved-share-price]');
  const sharePrice = sharePriceHook && (sharePriceHook.closest('label') || sharePriceHook);
  const sharePriceInput = sharePrice && (sharePrice.matches('input') ? sharePrice : sharePrice.querySelector('input'));

  function fillRow(row, entry) {
    const price = row.querySelector('[data-oa-saved-price]');
    if (price) price.textContent = entry.price ? formatter.format(entry.price) : '';
    setHidden(row.querySelector('[data-oa-saved-price-wrap]'), !entry.price);
    if (shared) {
      row.querySelectorAll('[data-oa-saved-qty], [data-oa-saved-remove], [data-oa-saved-edit]')
        .forEach(function (el) { setHidden(el, true); });
    }
    row.querySelectorAll('[data-oa-saved-line]').forEach(function (el) {
      const label = (entry.labels || {})[el.getAttribute('data-oa-saved-line')] || '';
      el.textContent = label;
      setHidden(el.parentElement, !label);
    });
    const qty = row.querySelector('[data-oa-saved-qty-value]');
    if (qty) qty.textContent = entry.qty || 1;
    const keys = Object.keys(entry.options);
    const edit = row.querySelector('[data-oa-saved-edit]');
    if (!shared) setHidden(edit, !keys.length);
    const editLink = edit && edit.querySelector('a');
    if (editLink) editLink.setAttribute('href', '/product/' + entry.slug + '?cfg=' +
      keys.map(function (k) { return k + ':' + entry.options[k]; }).join(','));
  }

  function renderPage() {
    if (!templates.length) return;
    document.querySelectorAll('[data-oa-saved-rendered]').forEach(function (el) { el.remove(); });
    const list = shared || load();
    // A saved piece whose product left the CMS (deleted, unpublished, slug changed) has no
    // row. Drop it so the badge matches the page, and keep the notice up for this visit.
    // Not at 100+ rows: a Collection List shows at most 100 items, so a row could just be
    // past the limit. A shared list is only filtered, never written.
    if (templates.length < 100) {
      const known = templates.map(function (t) { return t.slug; });
      const kept = list.items.filter(function (e) { return known.indexOf(e.slug) > -1; });
      if (kept.length < list.items.length) {
        dropped += list.items.length - kept.length;
        list.items = kept;
        if (!shared) {
          write(list);
          paintCount();
        }
      }
    }
    setHidden(missing, !dropped);
    // Saved entries hold slugs; the brief needs the CMS name, which only this page has
    let named = false;
    let shown = 0;
    templates.forEach(function (t) {
      list.items.forEach(function (entry) {
        if (entry.slug !== t.slug) return;
        if (!shared && t.name && entry.name !== t.name) { entry.name = t.name; named = true; }
        const row = t.copy.cloneNode(true);
        row.setAttribute('data-oa-saved-rendered', idOf(entry));
        fillRow(row, entry);
        t.row.parentNode.insertBefore(row, t.row);
        shown++;
      });
    });
    if (named) write(list);
    setHidden(document.querySelector('[data-oa-saved-empty]'), shown > 0);
    setHidden(document.querySelector('[data-oa-saved-wrap]'), !shown);
    document.querySelectorAll('[data-oa-saved-brief], [data-oa-saved-email], [data-oa-saved-share]')
      .forEach(function (el) { setHidden(el, !shown || shared); });
    setHidden(sharePrice, !shown || shared);
    if (!shown || shared) setHidden(emailForm, true);
    if (sharePriceInput) sharePriceInput.checked = !!list.sharePrice;
    document.querySelectorAll('[data-oa-saved-shared]').forEach(function (el) { setHidden(el, !shared); });
    if (project) project.readOnly = !!shared;
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
    if (shared) return;
    const list = load();
    list.project = project.value.slice(0, 120);
    write(list);
  });

  if (sharePriceInput) sharePriceInput.addEventListener('change', function () {
    const list = load();
    list.sharePrice = sharePriceInput.checked;
    write(list);
  });

  // ---- Email me this list. Turnstile (invisible) mounts the first time the panel opens;
  // tokens are single-use, so it resets after every send.
  const emailForm = document.querySelector('[data-oa-saved-email-form]');
  const emailKnob = function (k, d) { return (emailForm && emailForm.getAttribute('data-oa-saved-' + k)) || d; };
  const EMAIL_ENDPOINT = emailKnob('email-endpoint', 'https://nleekoypvxoagnwiqtzz.supabase.co/functions/v1/selection-intake');
  const TURNSTILE_KEY = emailKnob('turnstile-key', '0x4AAAAAAEtu2l3zZyHggUVm');
  const emailInput = emailForm && emailForm.querySelector('[data-oa-saved-email-input]');
  const emailField = emailInput && (emailInput.matches('input') ? emailInput : emailInput.querySelector('input'));
  const emailStatus = emailForm && emailForm.querySelector('[data-oa-saved-email-status]');
  const hpHook = emailForm && emailForm.querySelector('[data-oa-saved-honeypot]');
  const honeypot = hpHook && (hpHook.matches('input') ? hpHook : hpHook.querySelector('input'));
  setHidden(emailForm, true);
  if (emailStatus) emailStatus.setAttribute('aria-live', 'polite');
  function emailSay(key, fallback) { if (emailStatus) emailStatus.textContent = emailKnob('email-' + key + '-text', fallback); }

  let widget = null;
  let token = '';
  let tokenWait = null;
  function mountTurnstile() {
    if (!TURNSTILE_KEY || widget !== null || !emailForm) return;
    widget = 'loading';
    const host = document.createElement('div');
    emailForm.appendChild(host);
    const render = function () {
      widget = window.turnstile.render(host, {
        sitekey: TURNSTILE_KEY, size: 'invisible',
        callback: function (t) { token = t; if (tokenWait) { tokenWait(t); tokenWait = null; } },
        'error-callback': function () { token = ''; if (tokenWait) { tokenWait(''); tokenWait = null; } },
        'expired-callback': function () { token = ''; },
      });
    };
    if (window.turnstile) return render();
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = render;
    document.head.appendChild(script);
  }
  function turnstileToken() {
    if (!TURNSTILE_KEY) return Promise.resolve('');
    mountTurnstile();
    if (token) return Promise.resolve(token);
    return Promise.race([
      new Promise(function (res) { tokenWait = res; }),
      new Promise(function (res) { setTimeout(function () { res(token); }, 10000); }),
    ]);
  }

  // The visible half of a Lumos Clickable (it renders a link and a button, and shows one)
  function control(el) {
    return el && Array.prototype.slice.call(el.querySelectorAll('a, button'))
      .filter(function (c) { return c.getClientRects().length; })[0];
  }
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-oa-saved-email]');
    if (!btn || !emailForm || shared) return;
    e.preventDefault();
    const open = emailForm.style.display === 'none';
    setHidden(emailForm, !open);
    const c = control(btn);
    if (c) c.setAttribute('aria-expanded', String(open));
    if (open) { mountTurnstile(); if (emailField) emailField.focus(); }
  }, true);

  let sending = false;
  function sendList() {
    if (sending || !emailField) return;
    const email = emailField.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      emailField.setAttribute('aria-invalid', 'true');
      emailSay('invalid', 'Please check your email address.');
      emailField.focus();
      return;
    }
    emailField.removeAttribute('aria-invalid');
    const list = load();
    const items = list.items.filter(function (e) { return e.name; }).map(function (e) {
      const labels = {};
      Object.keys(e.labels || {}).forEach(function (k) { if (e.labels[k]) labels[k] = e.labels[k]; });
      return { slug: e.slug, name: e.name, options: e.options || {}, labels: labels, qty: e.qty || 1 };
    });
    sending = true;
    emailSay('sending', 'Sending…');
    turnstileToken().then(function (t) {
      return fetch(EMAIL_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email, project: list.project || '', items: items, website: honeypot ? honeypot.value : '',
          started_at: startedAt, origin_url: location.origin + location.pathname, turnstile: t }),
      });
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.ok) return emailSay('sent', 'Sent — check your inbox.');
        if (j.error === 'email') return emailSay('invalid', 'Please check your email address.');
        throw new Error(j.error || r.status);
      });
    }).catch(function (err) {
      emailSay('error', "That didn't send. Please try again, or email us directly.");
      console.error('oa-saved-items', err);
    }).then(function () {
      sending = false;
      token = '';
      if (window.turnstile && widget && widget !== 'loading') { try { window.turnstile.reset(widget); } catch (e) {} }
    });
  }
  document.addEventListener('click', function (e) {
    if (!e.target.closest('[data-oa-saved-email-send]')) return;
    e.preventDefault();
    sendList();
  }, true);
  if (emailField) emailField.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); sendList(); }
  });

  // Share: the share sheet on touch, the clipboard elsewhere (with the label swapped to
  // say so). If the clipboard is refused, a prompt holds the link to copy by hand.
  let copiedTimer = null;
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-oa-saved-share]');
    if (!btn || shared) return;
    e.preventDefault();
    const url = location.origin + location.pathname + '?s=' + encodeShare(load());
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      navigator.share({ url: url }).catch(function () {});
      return;
    }
    const label = btn.querySelector('.button_main_text');
    if (!btn.hasAttribute('data-oa-saved-share-text') && label) btn.setAttribute('data-oa-saved-share-text', label.textContent);
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () {
      setLabel(btn, TEXT.copied);
      announce('Share link copied.');
      clearTimeout(copiedTimer);
      copiedTimer = setTimeout(function () { setLabel(btn, btn.getAttribute('data-oa-saved-share-text') || ''); }, 2500);
    }, function () {
      window.prompt('Copy this link to share your saved items:', url);
    });
  }, true);

  // Add a shared list to the visitor's own: skip configurations they already have, stop at
  // the cap, keep their project name if they have one. Then show their list, in place.
  document.addEventListener('click', function (e) {
    if (!shared || !e.target.closest('[data-oa-saved-import]')) return;
    e.preventDefault();
    const list = load();
    const have = list.items.map(idOf);
    let added = 0;
    let full = 0;
    shared.items.forEach(function (entry) {
      if (have.indexOf(idOf(entry)) > -1) return;
      if (list.items.length >= CAP) { full++; return; }
      list.items.push({ slug: entry.slug, options: entry.options, labels: entry.labels,
        price: entry.price, qty: entry.qty, savedAt: Date.now() });
      added++;
    });
    if (!list.project) list.project = shared.project;
    shared = null;
    dropped = 0;
    history.replaceState(history.state, '', location.pathname + location.hash);
    store(list);
    if (project) project.focus();
    announce('Added ' + added + (added === 1 ? ' piece' : ' pieces') + ' to your saved items.' +
      (full ? ' ' + full + ' didn’t fit — your list holds ' + CAP + '.' : ''));
  }, true);

  // A new configuration may or may not be saved already
  document.addEventListener('change', function (e) {
    if (e.target.type === 'radio' && SUMMARY[e.target.name]) paintButtons();
  });
  // Another tab changed the list, or this page came back from bfcache after an edit
  window.addEventListener('storage', function (e) { if (e.key === KEY) paint(); });
  window.addEventListener('pageshow', function (e) { if (e.persisted) paint(); });

  // Count and page render now: this is footer code, so the markup above it exists. Then
  // release the pre-hide in oa-styles.css. Save buttons wait for DOMContentLoaded — the
  // configurator (a later embed) restores ?cfg= radios first.
  paintCount();
  renderPage();
  document.documentElement.classList.add('oa-saved-ready');
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paintButtons);
  else paintButtons();
})();
