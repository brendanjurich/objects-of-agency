// ============================================================
// OA PROJECT BRIEF — /contact step engine
// ============================================================
// Root: [data-oa-brief] (the content_group_layout grid). Each step is a pair of
// blocks, one per column, sharing data-oa-brief-step. Steps and inner groups are
// scoped by data-oa-brief-branch (audience list), data-oa-brief-when ("name=value")
// and data-oa-brief-unless. Chips are • oa Brief Chip / • oa Brief Chip Radio
// component instances — real inputs inside labels. No <form>: values are read
// from the root, and Send posts JSON to the brief-intake Edge Function.
//
// Designer knobs on the root:
//   data-oa-brief-endpoint       Edge Function URL (required to send)
//   data-oa-brief-turnstile-key  Cloudflare Turnstile site key (optional)
//   data-oa-brief-response       response promise text, default "two working days"
//   data-oa-brief-{error|limit|link}-text  send failure: generic, rate limit (429), link in a
//                                short field (400)
//
// Honeypot: [data-oa-brief-honeypot] (the input, or a wrapper holding it), falling back to
// name="website". Give it a name autofill doesn't know — autofill ignores autocomplete="off",
// and a field named "website" got filled from the visitor's contact card, so brief-intake
// silently dropped a real person as a bot. Still posted under the key `website`.
//
// ?from=saved-items (the Saved Items page's brief link): the visitor's saved pieces arrive
// as piece tags, the quantity question is pre-set from their total, and each saved
// configuration still tagged at send goes out as items[] — from window.oaSaved
// (oa-saved-items.js), which never hands over a price. The list's project name rides along as
// `project`, captured on arrival — removing piece tags never changes it.
//
// ?from=product (a product page's Create Brief link): that page's configuration arrives as
// a piece tag, handed over through window.oaSaved.forRequest('product'), and
// goes out in items[] the same way. Kept in the draft, so several pieces can gather.
//
// Edit configuration: [data-oa-brief-piece-edit] in the piece tag template — inside the tag, or
// beside it in a wrapper that is then cloned whole (optional) — is
// shown once per configuration that piece carries, linking to the product page on those
// options. Coming back through that page's Create Brief replaces the edited configuration
// (one from Saved Items is dropped from this brief only; the saved list is never touched).
// A second variant of a piece goes through Saved Items, not here.

(function () {
  const root = document.querySelector('[data-oa-brief]');
  if (!root) return;

  const ENDPOINT = root.getAttribute('data-oa-brief-endpoint') || '';
  const TURNSTILE_KEY = root.getAttribute('data-oa-brief-turnstile-key') || '';
  const RESPONSE = root.getAttribute('data-oa-brief-response') || 'two working days';
  // ---- copy knobs. Every user-visible string the engine writes is reachable from the
  // Designer as a root attribute, and each falls back to the string shipped here, so
  // nothing changes until a knob is set. `{name}`, `{n}` and `{N}` are substituted.
  // A knob may be suffixed with the branch — data-oa-brief-sent-text-looking — and that
  // wins over the generic one, which is how the just-looking Done screen stops saying
  // "Sent." when nothing was really sent on that path.
  const copy = (key, fallback) => root.getAttribute('data-oa-brief-' + key) || fallback;
  const copyFor = (key, fallback) => root.getAttribute('data-oa-brief-' + key + '-' + branch()) || copy(key, fallback);
  // An empty value takes any separator in front of its token with it, so
  // "Thank you, {name}." reads "Thank you." rather than "Thank you, ."
  function fill(tpl, vars) {
    return Object.keys(vars).reduce((out, k) => vars[k] === ''
      ? out.replace(new RegExp('[,;:\\u2013\\u2014-]?\\s*\\{' + k + '\\}', 'g'), '')
      : out.split('{' + k + '}').join(vars[k]), tpl);
  }
  const SENT = {
    client: "We'll read this properly and come back within " + RESPONSE + " with first thoughts and a time to talk. A copy is on its way to your inbox — it's written up so you can drop it straight into the project folder.",
    home: "We'll come back within " + RESPONSE + ". A copy is on its way to your inbox with a short note on how a commission works from here.",
    venue: "We'll come back within " + RESPONSE + " with first thoughts and a time to talk. A copy is on its way to your inbox.",
    looking: "Thanks for looking. If you left an email, you'll hear from us when there's something worth showing."
  };
  const STORE = 'oa-brief';
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const $ = (sel, el) => (el || root).querySelector(sel);
  // `el.hidden` alone is not enough: the UA rule [hidden]{display:none} loses to any
  // author rule that sets display (.brief_answers_step is display:flex), which left
  // every step rendered at once. Drive display inline too; clearing it hands the
  // visible value back to the Designer's class.
  function setHidden(el, on) {
    if (!el) return;
    el.hidden = !!on;
    if (on) el.style.setProperty('display', 'none', 'important');
    else el.style.removeProperty('display');
  }
  // Webflow renders a Rich Text block as <div class="w-richtext"><p>…</p></div>.
  // Setting textContent on the wrapper destroys the <p> and the Designer styling
  // that hangs off it, so write into the leaf when there is one.
  function setText(el, text) {
    if (!el) return;
    const leaf = el.querySelector('p, h1, h2, h3, h4, h5, h6');
    (leaf || el).textContent = text;
  }
  const $$ = (sel, el) => Array.prototype.slice.call((el || root).querySelectorAll(sel));

  // ---- steps: pair the two columns by step id, in DOM order of the question column
  const qBlocks = $$('[data-oa-brief-step]').filter(el => !el.closest('[data-oa-brief-step] [data-oa-brief-step]'));
  const byId = {};
  qBlocks.forEach(el => { const id = el.getAttribute('data-oa-brief-step'); (byId[id] = byId[id] || []).push(el); });
  const order = []; qBlocks.forEach(el => { const id = el.getAttribute('data-oa-brief-step'); if (order.indexOf(id) < 0) order.push(id); });
  const steps = order.map(id => ({
    id, els: byId[id],
    branch: byId[id][0].getAttribute('data-oa-brief-branch'),
    when: byId[id][0].getAttribute('data-oa-brief-when')
  }));
  const wrap = document.querySelector('.content_group_heading-wrap') || document;
  const progress = document.querySelector('[data-oa-brief-progress]');
  const status = document.querySelector('[data-oa-brief-status]');
  const back = document.querySelector('[data-oa-brief-back]');
  const next = document.querySelector('[data-oa-brief-next]');
  const nav = back && back.parentElement;

  // ---- state
  let state; try { state = JSON.parse(sessionStorage.getItem(STORE) || '{}'); } catch (e) { state = {}; }
  state.pieces = state.pieces || [];
  // A draft from an older oa-brief.js may hold configurations in an older shape
  state.configs = (state.configs || []).filter(e => e && e.slug && e.name && e.options && e.labels);
  const params = new URLSearchParams(location.search);
  if (params.get('piece')) { state.after = ['seen']; state.skipWhat = true; const p = params.get('piece'); if (state.pieces.indexOf(p) < 0) state.pieces.push(p); }
  // Saved configurations come through oa-saved-items.js (sitewide, loaded first). Without
  // it the brief still works, just with nothing carried over.
  const saved = window.oaSaved;
  const forRequest = source => saved ? saved.forRequest(source) : { project: '', items: [] };
  const sameConfig = (a, b) => saved ? saved.sameConfig(a, b) : a === b;
  const savedItems = () => forRequest('saved').items;
  if (params.get('from') === 'saved-items') {
    const list = forRequest('saved');
    if (list.items.length) {
      state.fromSaved = true; state.after = ['seen']; state.skipWhat = true;
      state.project = list.project.trim().slice(0, 120);
      list.items.forEach(e => { if (state.pieces.indexOf(e.name) < 0) state.pieces.push(e.name); });
      state.dropped = (state.dropped || []).filter(d => !list.items.some(e => sameConfig(d, e)));
      const n = list.items.reduce((sum, e) => sum + e.qty, 0);
      if (!state.quantity) state.quantity = n >= 10 ? 'ten-plus' : n > 1 ? 'few' : 'one';
    }
  }
  let resumeAt = null;
  if (params.get('from') === 'product') {
    const piece = forRequest('product').items[0];
    if (piece) {
      // Back from a tag's Edit configuration link: the new configuration replaces the edited one,
      // and the brief reopens on the step the link was clicked from
      const was = state.editing;
      if (was && was.slug === piece.slug) {
        state.configs = state.configs.filter(e => !sameConfig(e, was));
        state.dropped = (state.dropped || []).concat([{ slug: was.slug, options: was.options }]);
        resumeAt = was.step;
      }
      state.dropped = (state.dropped || []).filter(d => !sameConfig(d, piece));
      state.after = ['seen']; state.skipWhat = true;
      if (state.pieces.indexOf(piece.name) < 0) state.pieces.push(piece.name);
      state.configs = (state.configs || []).filter(e => !sameConfig(e, piece)).concat([piece]).slice(-12);
      if (!state.quantity) state.quantity = 'one';
    }
  }
  delete state.editing;
  // Removing a piece's tag drops its configurations too
  const items = () => (state.fromSaved ? savedItems() : []).concat(state.configs || [])
    .filter((e, i, all) => state.pieces.indexOf(e.name) >= 0 && all.findIndex(x => sameConfig(x, e)) === i &&
      !(state.dropped || []).some(d => sameConfig(d, e))).slice(0, 12);
  const startedAt = Date.now();

  // ---- values (inner-group scoping only; a step being hidden never hides its answers)
  // Step blocks carry branch attributes too, and a step that isn't current is hidden — that
  // must never switch its answers off, only a scoped inner group (branch/when/unless) may.
  // An answer on a step the current route skips is off too: going Back and switching
  // audience leaves the old branch's chips checked (a client never sees `where`, yet its
  // setting and quantity still counted). Liveness uses the step's own scope, not route():
  // skipWhat must not void the `after` it pre-fills.
  const stepOf = {}; steps.forEach(s => { stepOf[s.id] = s; });
  const off = el => {
    const q = el.closest('[data-oa-brief-step]'); const s = q && stepOf[q.getAttribute('data-oa-brief-step')];
    if (s && s.id !== 'who' && !(branch() && visible(s))) return true;
    let n = el.parentElement;
    while (n && n !== root) {
      if (n.hidden && !n.hasAttribute('data-oa-brief-step') &&
          (n.hasAttribute('data-oa-brief-branch') || n.hasAttribute('data-oa-brief-when') || n.hasAttribute('data-oa-brief-unless'))) return true;
      n = n.parentElement;
    }
    return false;
  };
  const inputs = n => $$('[name="' + n + '"]');
  function val(n) {
    const els = inputs(n); if (!els.length) return null;
    if (els[0].type === 'checkbox') return els.filter(e => e.checked && !off(e)).map(e => e.value);
    if (els[0].type === 'radio') { const c = els.filter(e => e.checked && !off(e))[0]; return c ? c.value : null; }
    // Text fields can exist on more than one step (email on looking + you, note on bespoke +
    // when): prefer the one on the step currently shown, then any that holds a value.
    const cand = els.filter(e => !off(e));
    const vis = cand.filter(e => { const st = e.closest('[data-oa-brief-step]'); return st && !st.hidden; })[0];
    if (vis) return vis.value;
    const filled = cand.filter(e => e.value)[0];
    return (filled || cand[0] || els[0]).value;
  }
  const has = cond => { const i = cond.indexOf('='); const k = cond.slice(0, i), v = cond.slice(i + 1); const x = val(k); return Array.isArray(x) ? x.indexOf(v) >= 0 : x === v; };
  const branch = () => val('audience');
  const inBranch = list => !list || list.split(' ').indexOf(branch()) >= 0;
  const visible = st => inBranch(st.branch) && (!st.when || has(st.when));
  const route = () => steps.filter(s => s.id !== 'sent' && !(s.id === 'what' && state.skipWhat) && (s.id === 'who' || (branch() && visible(s))));

  function scopeInner(st) {
    st.els.forEach(el => {
      $$('[data-oa-brief-branch]', el).forEach(g => setHidden(g, !inBranch(g.getAttribute('data-oa-brief-branch'))));
      $$('[data-oa-brief-when]', el).forEach(g => setHidden(g, !has(g.getAttribute('data-oa-brief-when'))));
      $$('[data-oa-brief-unless]', el).forEach(g => setHidden(g, has(g.getAttribute('data-oa-brief-unless'))));
    });
  }

  // ---- transition (GSAP if present, respects reduced motion)
  // The step on screen fades out, the swap happens, then the new step fades in place
  // while its items land in reading order — question heading, sub-text, then each
  // answer (legend, chip, field, summary) — and the root eases from the old height to
  // the new one. The block itself never moves: moving it and its items stacked the two
  // shifts. Cascading the whole step, not just the chips, gives a 3-chip panel enough
  // to compose with. Back reverses the rise. No blur. Timings are Designer knobs on
  // the root, in seconds: data-oa-brief-exit (0.16), data-oa-brief-enter (0.4),
  // data-oa-brief-stagger (0.04, per item, total capped at STAGGER_CAP so an 18-chip
  // step doesn't drag; 0 turns it off); data-oa-brief-shift is the rise in px (6; 0 = off).
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const knob = (k, d) => { const v = parseFloat(root.getAttribute('data-oa-brief-' + k)); return isNaN(v) ? d : v; };
  const EXIT = knob('exit', 0.16), ENTER = knob('enter', 0.4), STAGGER = knob('stagger', 0.04), SHIFT = knob('shift', 6);
  const STAGGER_CAP = 0.24;
  // An item nested in another item is dropped, so nothing moves twice.
  const ITEM = '.w-richtext, legend, label, .brief_summary';
  const itemsIn = els => els.reduce((a, el) => a.concat($$(ITEM, el)), [])
    .filter((el, i, all) => !all.some(o => o !== el && o.contains(el)));
  // Enter: power3.out — answers the click at once and lands softly. `dir` is -1 on Back,
  // so the items come from above. Clear the items' transform when done: a leftover
  // identity matrix makes a stacking context, which trapped the piece list's z-index
  // under .brief_nav's Back/Continue. The chip's own CSS transition (.form_ui_label is
  // `all 0.2s`) chases every frame GSAP writes, so the chip dipped the wrong way before
  // rising: switch it off for the tween and hand it back after.
  function reveal(els, dir) {
    if (reduce || !window.gsap) return;
    window.gsap.fromTo(els, { opacity: 0 }, { opacity: 1, duration: ENTER, ease: 'power3.out', clearProps: 'opacity' });
    const items = itemsIn(els).filter(l => l.getClientRects().length);
    if (items.length > 1 && STAGGER > 0) window.gsap.fromTo(items, { opacity: 0, y: SHIFT * (dir || 1), transition: 'none' }, { opacity: 1, y: 0, duration: ENTER, ease: 'power3.out', stagger: { each: Math.min(STAGGER, STAGGER_CAP / (items.length - 1)) }, clearProps: 'opacity,transform,transition' });
  }
  // `apply` hides the old step, shows the new one and calls reveal(). A second call while
  // an exit is running (a fast Back, a double Continue) drops the first one's apply —
  // the newer call sets the whole screen anyway.
  let leaving = null;
  function swap(apply, instant) {
    const g = window.gsap;
    if (leaving) { leaving.kill(); leaving = null; }
    const out = steps.reduce((a, s) => a.concat(s.els), []).filter(el => !el.hidden);
    if (reduce || !g || instant || !out.length) { apply(); return; }
    const h0 = root.offsetHeight;
    g.killTweensOf(out); const items = itemsIn(out); g.killTweensOf(items); g.set(items, { clearProps: 'opacity,transform,transition' });
    // Exit: power2.in, opacity only — it gets out of the way and nobody watches it leave.
    leaving = g.to(out, { opacity: 0, duration: EXIT, ease: 'power2.in', onComplete: () => {
      leaving = null;
      g.set(out, { clearProps: 'opacity' });
      g.killTweensOf(root); root.style.height = '';
      apply();
      const h1 = root.offsetHeight;
      if (h1 !== h0) g.fromTo(root, { height: h0 }, { height: h1, duration: ENTER, ease: 'power3.out', clearProps: 'height' });
    } });
  }

  let idx = 0;
  let first = true;
  function show(i, push) {
    const dir = i < idx ? -1 : 1;
    const r = route(); idx = Math.max(0, Math.min(i, r.length - 1)); const st = r[idx];
    const moved = !first;
    swap(() => {
      steps.forEach(s => s.els.forEach(el => setHidden(el, s !== st)));
      scopeInner(st);
      if (st.id === 'you') renderSummary();
      if (st.id === 'you' || st.id === 'looking') mountTurnstile();
      if (st.id === 'piece') renderPieces();
      const n = idx + 1, N = branch() ? r.length : '…';
      if (progress) setText(progress, fill(copy('progress-text', 'Question {n} of {N}'), { n: n, N: N }));
      document.title = 'Question ' + n + ' of ' + N + ' — New Project Brief';
      const h = $('.brief_question_title', st.els[0]) || st.els[0].querySelector('h2');
      if (status && h) status.textContent = h.textContent;
      setHidden(back, idx === 0);
      // Auto-advance groups hide Continue only until they hold an answer — a restored draft
      // re-checks the radio, and a re-click fires no change event, so the visitor would be stuck.
      const auto = st.els.some(el => el.querySelector('[data-oa-brief-auto]'));
      const autoAnswered = auto && st.els.some(el => el.querySelector('[data-oa-brief-auto] input:checked'));
      setHidden(next, (auto && !autoAnswered) || st.id === 'you' || st.id === 'looking');
      // Focus the heading only when the visitor moves between steps. Doing it on the
      // first render puts a focus ring on the opening question before anyone has acted.
      if (h && moved) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
      reveal(st.els, dir);
      save();
    }, !moved);
    if (push) history.pushState({ oaBrief: idx }, '');
    first = false;
  }
  const KEYS = ['audience','after','bespoke','setting','quantity','timing','timing_date','budget','materials','note','interest','name','first_name','last_name','practice'];
  // The Designer splits the name into two fields. Compose the single `name` the
  // Edge Function stores; fall back to a lone `name` input if one ever returns.
  function fullName() {
    const whole = val('name');
    if (whole) return whole;
    return [val('first_name'), val('last_name')].filter(Boolean).join(' ') || null;
  }
  const firstName = () => (val('first_name') || val('name') || '').trim().split(' ')[0];
  function save() {
    const s = {}; KEYS.forEach(k => { s[k] = val(k); }); s.pieces = state.pieces; s.skipWhat = state.skipWhat; s.fromSaved = state.fromSaved; s.configs = state.configs; s.project = state.project; s.editing = state.editing; s.dropped = state.dropped;
    try { sessionStorage.setItem(STORE, JSON.stringify(s)); } catch (e) {}
  }
  function restore() {
    Object.keys(state).forEach(k => {
      if (['pieces', 'skipWhat', 'fromSaved', 'configs', 'project', 'editing', 'dropped'].indexOf(k) >= 0) return; const v = state[k];
      inputs(k).forEach(e => { if (e.type === 'checkbox') e.checked = Array.isArray(v) && v.indexOf(e.value) >= 0; else if (e.type === 'radio') e.checked = e.value === v; else if (typeof v === 'string') e.value = v; });
    });
  }

  // ---- chip behaviour: exclusive chips, auto-advance on single-select groups
  root.addEventListener('change', e => {
    const t = e.target; if (!t.name) return;
    const exclusive = t.closest('[data-oa-brief-exclusive]');
    if (t.type === 'checkbox' && t.checked) {
      if (exclusive) inputs(t.name).forEach(o => { if (o !== t) o.checked = false; });
      else inputs(t.name).forEach(o => { if (o !== t && o.closest('[data-oa-brief-exclusive]')) o.checked = false; });
    }
    const st = route()[idx]; if (st) scopeInner(st);
    if (t.closest('[data-oa-brief-auto]')) setTimeout(() => show(idx + 1, true), 160);
    save();
  });
  // Webflow renders custom-tag buttons as <a href="#">: swallow the default or the hash
  // navigation fires popstate and drops the visitor back to screen one.
  if (next) next.addEventListener('click', e => { e.preventDefault(); show(idx + 1, true); });
  if (back) back.addEventListener('click', e => { e.preventDefault(); history.back(); });
  window.addEventListener('popstate', e => { if (e.state && typeof e.state.oaBrief === 'number') show(e.state.oaBrief, false); });

  // ---- pieces: drill-down drawer + tags
  /* ============================================================
     OSMO — Stacked Drawer Navigation (brief piece picker)
     ------------------------------------------------------------
     Adapted for Objects of Agency from osmo.supply's "Stacked
     Drawer Navigation". Differences from the stock resource:
       • A picker, not a nav — rows toggle pieces into state.pieces
         (aria-pressed) instead of linking; the drawer stays open
         until Done, Esc or the backdrop. Capped at MAX_PIECES.
       • Rows come from the CMS — a flat Products Collection List in
         the drawer, grouped into one sheet per Series (A–Z) here, cloned
         from one sheet template. Each sheet opens with a "whole
         series" row that submits the series name.
       • The root is a <dialog> opened with showModal(): the step
         tween leaves a transform on the step, which would trap a
         position:fixed drawer, and the top layer makes the page
         behind inert (the focus trap). Esc and the cancel event step
         back one level before closing. The dialog is then sized onto
         an anchor in the card and clips, so the menu reads as part of
         the card, not a page overlay.
       • No CDN GSAP, no CustomEase — window.gsap only; without it the
         drawer still opens, steps and closes, it just doesn't move.
       • Easing per motion, not Osmo's one curve: enters power3.out,
         leaves power2.in, rows power2.out, edge strip power1.out.
         Durations are Designer knobs on the brief root.
       • Reduced motion via gsap.matchMedia(), read at each open.
       • Page scroll locked while open — window.lenis, or the root's
         overflow where Lenis isn't running (reduced motion).
       • Nav furniture dropped: bar, logo, bag, menu toggle, promo,
         footer, featured group, "shop all" links, status attribute.
     Page-level (/contact), part of oa-brief.js. Raw-served (no build).
     ============================================================ */
  // Hooks, all inside [data-oa-brief]:
  //   [data-oa-brief-piece-open]          the field-styled button that opens the drawer
  //   [data-oa-brief-drawer]              the <dialog>
  //   [data-oa-brief-drawer-anchor]       the box the drawer opens over (above 767px; below, the card)
  //   [data-oa-brief-drawer-box]          the image box holding the anchor (above 767px it grows to
  //                                       fit the open level; optional)
  //   [data-oa-brief-drawer-backdrop]     the dim layer, anywhere in the brief (inside the box, it
  //                                       dims the whole image); a tap closes
  //   [data-oa-brief-drawer-panel]        level one: the series rows
  //   [data-oa-brief-drawer-list="series"] where the series rows go
  //   [data-oa-brief-drawer-pick="value"] a row that toggles that value (Custom Cabinetry is one)
  //   [data-oa-brief-drawer-other-toggle] the "Something else" row; [data-oa-brief-drawer-other] holds
  //                                       its field and [data-oa-brief-drawer-other-add]
  //   [data-oa-brief-drawer-done]         the Done bar; [data-oa-brief-drawer-done-text] its label
  //   Per level: [data-oa-brief-drawer-edge], [data-oa-brief-drawer-back],
  //   [data-oa-brief-drawer-title], [data-oa-brief-drawer-list]
  //   Templates (inside a u-display-none wrapper, so they still publish):
  //   [data-oa-brief-drawer-sheet], [data-oa-brief-drawer-series-row], [data-oa-brief-drawer-piece-row],
  //   each row holding a [data-oa-brief-drawer-text] slot
  //   CMS source: [data-oa-brief-drawer-item], holding [data-oa-brief-drawer-name] and
  //   [data-oa-brief-drawer-series]
  // Knobs on the root, in seconds: data-oa-brief-drawer-enter (0.5), -exit (0.35), -stagger (0.03).
  // Copy knobs: data-oa-brief-whole-series-text, -drawer-done-text, -drawer-count-text, -drawer-full-text.
  const MAX_PIECES = 12; // brief-intake keeps the first 12
  function addPiece(v) {
    v = (v || '').trim();
    if (!v || state.pieces.indexOf(v) >= 0 || state.pieces.length >= MAX_PIECES) return;
    state.pieces.push(v); renderPieces(); save();
  }
  function togglePiece(v) {
    const i = state.pieces.indexOf(v);
    if (i >= 0) state.pieces.splice(i, 1); else if (state.pieces.length < MAX_PIECES) state.pieces.push(v);
    renderPieces(); save();
  }
  let syncDrawer = () => {};
  (function initDrawer() {
    const opener = $('[data-oa-brief-piece-open]');
    if (!opener) return;
    const D = 'data-oa-brief-drawer';
    const dlg = $('[' + D + ']');
    const panel = dlg && $('[' + D + '-panel]', dlg);
    const sheetTpl = dlg && $('[' + D + '-sheet]', dlg);
    const seriesTpl = dlg && $('[' + D + '-series-row]', dlg);
    const pieceTpl = dlg && $('[' + D + '-piece-row]', dlg);
    const seriesList = panel && $('[' + D + '-list="series"]', panel);
    if (!dlg || typeof dlg.showModal !== 'function' || !panel || !sheetTpl || !seriesTpl || !pieceTpl || !seriesList) {
      console.warn('[oa-brief] piece drawer markup incomplete — skipping'); return;
    }
    const backdrop = $('[' + D + '-backdrop]');
    const doneText = $('[' + D + '-done-text]', dlg);
    // The count is the only feedback a reader gets that a tap landed, and the only word on why
    // rows went disabled at the cap, so it announces.
    if (doneText) doneText.setAttribute('aria-live', 'polite');
    const ENTER_D = knob('drawer-enter', 0.5), EXIT_D = knob('drawer-exit', 0.35), STAGGER_D = knob('drawer-stagger', 0.03);
    const g = window.gsap;
    let still = false;
    if (g) g.matchMedia().add('(prefers-reduced-motion: reduce)', () => { still = true; return () => { still = false; }; });
    const animate = () => !!g && !still;
    // Shown/hidden without GSAP too: inline visibility + opacity, the same props autoAlpha writes.
    const vis = (els, on) => [].concat(els).forEach(el => {
      if (!el) return; if (g) g.killTweensOf(el);
      el.style.visibility = on ? 'visible' : 'hidden'; el.style.opacity = on ? '1' : '0';
    });
    const clone = (tpl, attr) => { const c = tpl.cloneNode(true); c.removeAttribute(attr); return c; };
    const text = (el, sel) => { const t = el.querySelector(sel); return t ? t.textContent.trim() : ''; };
    const slot = (row, s) => setText($('[' + D + '-text]', row) || row, s);
    const button = row => row.matches('button, a') ? row : $('button, a', row);

    // ---- build: CMS items → series → one sheet each. Series run A–Z (Webflow can't sort a
    // Collection List by a referenced item's name); pieces keep the list's own sort.
    const groups = new Map();
    $$('[' + D + '-item]', dlg).forEach(it => {
      const name = text(it, '[' + D + '-name]'), series = text(it, '[' + D + '-series]');
      if (!name || !series) return;
      if (!groups.has(series)) groups.set(series, []);
      if (groups.get(series).indexOf(name) < 0) groups.get(series).push(name);
    });
    const LEVEL = '[' + D + '-level]';
    panel.setAttribute(D + '-level', '');
    const sheets = [], parentOf = new Map(), triggerOf = new Map();
    const pieceRow = (label, value) => {
      const row = clone(pieceTpl, D + '-piece-row'); slot(row, label);
      const b = button(row); b.setAttribute(D + '-pick', value);
      if (label !== value) b.setAttribute('aria-label', label + ': ' + value);
      return row;
    };
    Array.from(groups.keys()).sort((a, b) => a.localeCompare(b)).forEach(series => {
      const names = groups.get(series);
      const sheet = clone(sheetTpl, D + '-sheet');
      sheet.setAttribute(D + '-level', '');
      sheet.id = 'oa-brief-drawer-sheet-' + sheets.length;
      setText($('[' + D + '-title]', sheet), series);
      const list = $('[' + D + '-list]', sheet);
      list.appendChild(pieceRow(copy('whole-series-text', 'The whole series'), series));
      names.forEach(n => list.appendChild(pieceRow(n, n)));
      const row = clone(seriesTpl, D + '-series-row'); slot(row, series);
      const trigger = button(row);
      trigger.setAttribute('aria-controls', sheet.id); trigger.setAttribute('aria-expanded', 'false');
      trigger.addEventListener('click', e => { e.preventDefault(); openSheet(sheet); });
      seriesList.appendChild(row);
      panel.appendChild(sheet);
      sheets.push(sheet); parentOf.set(sheet, panel); triggerOf.set(sheet, trigger);
    });
    const levels = [panel].concat(sheets);
    const own = (level, sel) => $$(sel, level).filter(el => el.closest(LEVEL) === level);
    const edges = levels.reduce((a, l) => a.concat(own(l, '[' + D + '-edge]')), []);
    const doneBar = $('[' + D + '-done]', dlg);
    const stack = [panel];

    // ---- levels: the one on top is live, the ones under it are inert apart from their edge strip
    function updateLevels() {
      const top = stack[stack.length - 1];
      levels.forEach(level => {
        const behind = level !== top && stack.indexOf(level) >= 0;
        Array.prototype.forEach.call(level.children, c => {
          if (!c.matches('[' + D + '-edge], ' + LEVEL + ', [' + D + '-done]')) c.inert = behind;
        });
      });
      sheets.forEach(s => triggerOf.get(s).setAttribute('aria-expanded', String(stack.indexOf(s) >= 0)));
    }
    function resetLevels() {
      stack.splice(1);
      if (g) g.set(sheets, { clearProps: 'transform' });
      vis(sheets, false); vis(edges, false);
      updateLevels();
    }
    // Rows land in reading order: back, title, then each row. Enters → power2.out.
    function reveal(level, delay) {
      if (!animate()) return;
      const els = own(level, '[' + D + '-back], [' + D + '-title], [' + D + '-list] > *').filter(el => el.getClientRects().length);
      if (!els.length) return;
      g.fromTo(els, { opacity: 0, x: 24 }, {
        opacity: 1, x: 0, duration: ENTER_D, ease: 'power2.out', delay: delay || 0,
        stagger: Math.min(STAGGER_D, STAGGER_CAP / Math.max(els.length - 1, 1)), clearProps: 'opacity,transform'
      });
    }
    // The title takes focus, so a reader hears where they are, as the brief's step headings do.
    function focusLevel(level) {
      const t = own(level, '[' + D + '-title]')[0] || own(level, 'button, a[href]')[0];
      if (!t) return;
      if (!t.matches('button, a[href], input')) t.setAttribute('tabindex', '-1');
      t.focus({ preventScroll: true });
    }
    function openSheet(sheet) {
      if (stack.indexOf(sheet) >= 0) return;
      const parent = parentOf.get(sheet);
      stack.push(sheet); updateLevels();
      vis(sheet, true);
      const edge = own(parent, '[' + D + '-edge]');
      vis(edge, true);
      fit(sheet, ENTER_D, 'power3.out');
      if (animate()) {
        // Enters: power3.out — a full-height panel crossing the drawer, settling softly.
        g.fromTo(sheet, { xPercent: 100 }, { xPercent: 0, duration: ENTER_D, ease: 'power3.out' });
        // State feedback: the strip underneath fades up once the sheet has cleared it.
        g.fromTo(edge, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'power1.out', delay: ENTER_D * 0.4 });
        reveal(sheet);
      }
      focusLevel(sheet);
    }
    function closeTo(level) {
      const i = stack.indexOf(level);
      if (i < 0 || i === stack.length - 1) return;
      const closing = stack.splice(i + 1); updateLevels();
      fit(level, EXIT_D, 'power2.in');
      const edge = own(level, '[' + D + '-edge]');
      const done = () => { const gone = closing.filter(s => stack.indexOf(s) < 0); vis(gone, false); if (g) g.set(gone, { clearProps: 'transform' }); };
      if (animate()) {
        // Leaves: power2.in, shorter than the entrance — nobody watches it go.
        g.to(closing[0], { xPercent: 100, duration: EXIT_D, ease: 'power2.in', onComplete: done });
        g.to(edge, { opacity: 0, duration: 0.2, ease: 'power1.out', onComplete: () => vis(edge, false) });
      } else { done(); vis(edge, false); }
      triggerOf.get(closing[0]).focus({ preventScroll: true });
    }

    // ---- placement: the modal dialog is sized onto its anchor, so the menu belongs to the
    // card — [data-oa-brief-drawer-anchor] (the image panel's right-hand column) above Webflow's small breakpoint,
    // the whole brief card at and below it, where the panel is too short to scan. The dialog
    // clips (oa-brief.css), so the panel slides out of the anchor's right edge and the
    // backdrop, in the image box, dims only that box. Measured with the page scroll locked, so the box holds;
    // re-measured on resize. No anchor: the dialog keeps its full-viewport fallback.
    const anchor = $('[' + D + '-anchor]');
    const small = window.matchMedia('(max-width: 767px)');
    const anchorEl = () => small.matches ? root : anchor;
    function bringIntoView() {
      const el = anchorEl(); if (!el) return;
      const r = el.getBoundingClientRect();
      const by = r.bottom > innerHeight ? Math.min(r.bottom - innerHeight + 16, r.top) : r.top < 0 ? r.top : 0;
      if (!by) return;
      if (window.lenis) window.lenis.scrollTo(scrollY + by, { immediate: true, force: true });
      else window.scrollTo(0, scrollY + by);
    }
    function place() {
      const el = anchorEl();
      ['top', 'left', 'width', 'height'].forEach(k => dlg.style.removeProperty('--oa-drawer-' + k));
      if (!el) return;
      const r = el.getBoundingClientRect();
      const top = Math.max(r.top, 0), bottom = Math.min(r.bottom, innerHeight);
      dlg.style.setProperty('--oa-drawer-top', top + 'px');
      dlg.style.setProperty('--oa-drawer-left', r.left + 'px');
      dlg.style.setProperty('--oa-drawer-width', r.width + 'px');
      dlg.style.setProperty('--oa-drawer-height', Math.max(bottom - top, 0) + 'px');
      // The Done bar rides over the bottom of every level; oa-brief.css ends each level's
      // content this much lower, so the last row scrolls clear of it.
      if (doneBar) dlg.style.setProperty('--oa-drawer-done', doneBar.offsetHeight + 'px');
    }
    window.addEventListener('resize', () => { if (open) { fit(stack[stack.length - 1], 0); place(); } });

    // ---- fit: above 767px the box ([data-oa-brief-drawer-box]) grows to the open level, so the
    // list never scrolls. Its aspect-ratio (Designer) is the landing height and the floor; the
    // engine only sets min-height, capped at the viewport less 16px each side, and past the cap
    // the level scrolls in itself. Each change runs with the slide it belongs to, re-placing the
    // dialog every frame and scrolling the page along when the box grows past the screen.
    const box = $('[' + D + '-box]');
    const MARGIN = 16;
    const fitTo = { h: 0 };
    // The level's own height: its content unclamped (Designer's height: 100% set aside for one
    // read; it already ends in the Done bar's clearance), plus whatever the box adds round the anchor.
    function natural(level) {
      const content = level && Array.prototype.find.call(level.children, c => !c.matches('[' + D + '-edge], ' + LEVEL + ', [' + D + '-done]'));
      if (!content || !anchor) return 0;
      const was = content.style.height;
      content.style.height = 'auto';
      const h = content.getBoundingClientRect().height;
      content.style.height = was;
      return h + box.getBoundingClientRect().height - anchor.getBoundingClientRect().height;
    }
    function landing() {
      const was = box.style.minHeight;
      box.style.minHeight = '';
      const h = box.getBoundingClientRect().height;
      box.style.minHeight = was;
      return h;
    }
    function follow() {
      const r = box.getBoundingClientRect();
      const by = Math.min(r.bottom - (innerHeight - MARGIN), r.top - MARGIN);
      if (by <= 0) return;
      if (window.lenis) window.lenis.scrollTo(scrollY + by, { immediate: true, force: true });
      else window.scrollTo(0, scrollY + by);
    }
    // level: the one to fit, or null for the landing height. dur 0 (or no motion): at once.
    function fit(level, dur, ease) {
      if (!box) return;
      if (g) g.killTweensOf(fitTo);
      const floor = landing();
      const to = small.matches || !level ? floor : Math.max(floor, Math.min(Math.ceil(natural(level)), innerHeight - 2 * MARGIN));
      const set = () => {
        if (fitTo.h <= floor + 0.5) box.style.removeProperty('min-height');
        else box.style.minHeight = fitTo.h + 'px';
        if (dlg.open) { follow(); place(); } // the dialog follows the box out on close too
      };
      fitTo.h = box.getBoundingClientRect().height;
      if (Math.abs(to - fitTo.h) < 1) return;
      if (!dur || !animate()) { fitTo.h = to; return set(); }
      g.to(fitTo, { h: to, duration: dur, ease: ease, onUpdate: set });
    }
    const refit = (dur, ease) => { if (open) fit(stack[stack.length - 1], dur, ease); };
    // The box is fixed where the card was, so the page must not scroll under it. Lenis when it
    // runs; without it (reduced motion skips Lenis, or its CDN failed) the root's overflow.
    function lockScroll(on) {
      if (window.lenis) return on ? window.lenis.stop() : window.lenis.start();
      document.documentElement.style.overflow = on ? 'hidden' : '';
    }

    // ---- open / close
    let open = false;
    function openDrawer() {
      if (open) return; open = true;
      if (g) g.killTweensOf([panel, backdrop]);
      resetLevels(); syncDrawer();
      bringIntoView();
      if (!dlg.open) dlg.showModal();
      controls.forEach(c => c.setAttribute('aria-expanded', 'true'));
      lockScroll(true);
      place();
      // The backdrop fades to its own opacity (Designer), read with the inline one cleared.
      if (backdrop) backdrop.style.removeProperty('opacity');
      const dim = backdrop ? parseFloat(getComputedStyle(backdrop).opacity) : 1;
      vis([panel, backdrop], true);
      if (backdrop) backdrop.style.opacity = String(dim);
      fit(panel, ENTER_D, 'power3.out');
      if (animate()) {
        // Enters: power3.out — answers the tap at once, lands softly.
        g.fromTo(panel, { xPercent: 100 }, { xPercent: 0, duration: ENTER_D, ease: 'power3.out' });
        if (backdrop) g.fromTo(backdrop, { opacity: 0 }, { opacity: dim, duration: ENTER_D, ease: 'power2.out' });
        reveal(panel, 0.1);
      }
      focusLevel(panel);
    }
    function closeDrawer() {
      if (!open) return; open = false;
      controls.forEach(c => c.setAttribute('aria-expanded', 'false'));
      const done = () => {
        if (open) return; // reopened mid-exit
        dlg.close(); resetLevels();
        if (g) g.set(panel, { clearProps: 'transform' });
        vis(backdrop, false); fit(null, 0);
        lockScroll(false);
        control().focus({ preventScroll: true });
      };
      fit(null, EXIT_D, 'power2.in');
      if (!animate()) return done();
      // Leaves: power2.in, ~0.7× the entrance.
      g.to(panel, { xPercent: 100, duration: EXIT_D, ease: 'power2.in' });
      g.to(backdrop || {}, { opacity: 0, duration: EXIT_D, ease: 'power2.in', onComplete: done });
    }
    function stepBack() { if (stack.length > 1) closeTo(stack[stack.length - 2]); else closeDrawer(); }

    // ---- ticks, the cap and the Done label follow state.pieces
    syncDrawer = () => {
      const n = state.pieces.length, full = n >= MAX_PIECES;
      $$('[' + D + '-pick]', dlg).forEach(b => {
        const on = state.pieces.indexOf(b.getAttribute(D + '-pick')) >= 0;
        b.setAttribute('aria-pressed', String(on));
        b.disabled = full && !on;
      });
      const other = $('[' + D + '-other-toggle]', dlg); if (other) other.disabled = full;
      if (doneText) setText(doneText, full ? fill(copy('drawer-full-text', 'Done · {n} max'), { n: MAX_PIECES })
        : n ? fill(copy('drawer-count-text', 'Done · {n}'), { n: n }) : copy('drawer-done-text', 'Done'));
    };

    // ---- "Something else": a field shown in place, so the keyboard only comes when asked for
    const otherToggle = $('[' + D + '-other-toggle]', dlg);
    const other = $('[' + D + '-other]', dlg);
    const otherInput = other && $('input', other);
    if (otherToggle && otherInput) {
      setHidden(other, true);
      otherToggle.setAttribute('aria-expanded', 'false');
      const shut = () => { setHidden(other, true); otherToggle.setAttribute('aria-expanded', 'false'); refit(EXIT_D, 'power2.in'); };
      const add = () => { addPiece(otherInput.value); otherInput.value = ''; shut(); otherToggle.focus({ preventScroll: true }); };
      otherToggle.addEventListener('click', e => {
        e.preventDefault();
        if (!other.hidden) return shut();
        setHidden(other, false); otherToggle.setAttribute('aria-expanded', 'true'); otherInput.focus();
        refit(ENTER_D, 'power3.out');
      });
      otherInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
      const addBtn = $('[' + D + '-other-add]', other);
      if (addBtn) addBtn.addEventListener('click', e => { e.preventDefault(); add(); });
    }

    // ---- input
    // The opener hook may sit on a component wrapper (oa Button Menu: a div holding a Lumos
    // Clickable's <a> and <button>), so ARIA and focus go to the real controls inside it, and
    // focus returns to whichever one is rendered.
    const controls = (opener.matches('button, a[href]') ? [opener] : []).concat($$('button, a[href]', opener));
    const control = () => controls.filter(el => el.getClientRects().length)[0] || controls[0] || opener;
    controls.forEach(c => { c.setAttribute('aria-haspopup', 'dialog'); c.setAttribute('aria-expanded', 'false'); });
    opener.addEventListener('click', e => { e.preventDefault(); openDrawer(); });
    // The opener sits outside the modal, so it is inert while the drawer is open and never
    // matches Lumos's [data-trigger~="hover"]:hover, though a tap on it still closes (a
    // ::backdrop click). Mirror the hover: a pointer over it flips the same trigger variables,
    // and data-oa-brief-drawer-opener-hover gives the ::backdrop a pointer cursor (oa-brief.css).
    const trig = opener.closest('[data-trigger~="hover"]') || $('[data-trigger~="hover"]', opener);
    const hoverable = window.matchMedia('(hover: hover)');
    const mirrorHover = on => {
      dlg.toggleAttribute(D + '-opener-hover', !!on);
      if (trig) ['on', 'off'].forEach((k, i) => on
        ? trig.style.setProperty('--_trigger---' + k, String(i)) : trig.style.removeProperty('--_trigger---' + k));
    };
    dlg.addEventListener('pointermove', e => {
      const r = trig && trig.getBoundingClientRect();
      mirrorHover(r && dlg.open && hoverable.matches && e.target === dlg &&
        e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom);
    });
    dlg.addEventListener('pointerleave', () => mirrorHover(false));
    dlg.addEventListener('close', () => mirrorHover(false));
    dlg.setAttribute('data-lenis-prevent', ''); // the levels scroll under Lenis
    dlg.addEventListener('click', e => {
      const t = e.target;
      const pick = t.closest('[' + D + '-pick]');
      if (pick) { e.preventDefault(); if (!pick.disabled) togglePiece(pick.getAttribute(D + '-pick')); return; }
      if (t.closest('[' + D + '-done]')) { e.preventDefault(); return closeDrawer(); }
      // Outside the box: a modal dialog's ::backdrop click targets the dialog itself.
      if (t === dlg) return closeDrawer();
      if (backdrop && backdrop.contains(t)) return closeDrawer();
      const nav = t.closest('[' + D + '-back], [' + D + '-edge]');
      if (!nav) return;
      e.preventDefault();
      const level = nav.closest(LEVEL);
      if (nav.hasAttribute(D + '-edge')) closeTo(level);
      else if (level === panel) closeDrawer();
      else closeTo(parentOf.get(level));
    });
    // Esc steps back a level. Handled on keydown; `cancel` covers the platform's own close
    // request (Android back), and is skipped when the keydown already took this Esc.
    let escTaken = false;
    dlg.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      e.preventDefault(); escTaken = true; setTimeout(() => { escTaken = false; }, 0);
      stepBack();
    });
    dlg.addEventListener('cancel', e => { e.preventDefault(); if (!escTaken) stepBack(); });
    resetLevels(); vis(backdrop, false);
  })();
  // Same template rule as the summary rows and the piece options: if the Designer
  // marks one tag inside [data-oa-brief-pieces], the engine clones it per piece and
  // the styling on the canvas is the styling that ships. Without one it falls back to
  // the bare generated button, which is why a Designer-built tag styled but never
  // attribute-marked lost its padding — innerHTML wipes it before it is ever seen.
  // The template is the whole per-piece unit: the tag itself, or the wrapper around it when the
  // Designer pairs the tag with its Edit configuration link as siblings (no link inside the
  // tag's button) — the child of [data-oa-brief-pieces] that holds the tag.
  const tagWrap = $('[data-oa-brief-pieces]');
  let tagTplSrc = tagWrap && $('[data-oa-brief-piece-tag]', tagWrap);
  while (tagTplSrc && tagTplSrc.parentElement !== tagWrap) tagTplSrc = tagTplSrc.parentElement;
  const tagTpl = tagTplSrc && tagTplSrc.cloneNode(true);
  // [data-oa-brief-pieces-label] ("Selections:") shows only while there are tags. It may
  // sit inside [data-oa-brief-pieces]; the wipe below detaches it, so it goes back first.
  const tagLabel = $('[data-oa-brief-pieces-label]');
  // Every render rebuilds every tag, so only a piece that wasn't shown last time fades in
  // (and the whole box, when the first one lands). data-oa-brief-tag-fade (0.25; 0 = off).
  // Enters: power2.out. Removal pops: fading out would hold the rebuild until it ends.
  const TAG_FADE = knob('tag-fade', 0.25);
  let shownTags = [];
  const fadeIn = el => {
    if (reduce || !window.gsap || TAG_FADE <= 0) return;
    window.gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: TAG_FADE, ease: 'power2.out', clearProps: 'opacity' });
  };
  // One Edit configuration link per configuration the piece carries; none without one. The
  // Designer's copy stays; the accessible name says which configuration. The click records
  // which one is being edited, so Create Brief on the product page replaces it.
  function editLinks(tpl, piece) {
    if (!saved) return [];
    return items().filter(c => c.name === piece).map(c => {
      const el = tpl.cloneNode(true);
      const href = saved.editHref(c);
      const links = el.matches('a') ? [el] : $$('a', el);
      links.forEach(a => a.setAttribute('href', href));
      const config = Object.keys(c.labels).map(k => c.labels[k]).join(' · ');
      // On the links: a label on a plain wrapper div is ignored by most screen readers
      (links.length ? links : [el]).forEach(a => a.setAttribute('aria-label', 'Edit configuration: ' + (config ? piece + ' — ' + config : piece)));
      el.addEventListener('click', () => {
        state.editing = { slug: c.slug, options: c.options, step: route()[idx].id }; save();
        if (!links.length) location.href = href;
      });
      return el;
    });
  }
  // Back to the brief without Create Brief (the back button): nothing was edited
  window.addEventListener('pageshow', e => { if (e.persisted && state.editing) { delete state.editing; save(); } });
  function renderPieces() {
    syncDrawer();
    const w = tagWrap;
    // The tags box is hidden while empty too, or its Designer background shows as a bare strip.
    // When the first piece lands the box fades in whole, so its tags and label don't fade again.
    const appearing = state.pieces.length && [w, tagLabel].filter(el => el && el.hidden)
      .filter((el, i, all) => !all.some(o => o !== el && o.contains(el)));
    setHidden(w, !state.pieces.length);
    setHidden(tagLabel, !state.pieces.length);
    (appearing || []).forEach(fadeIn);
    if (!w) return; w.innerHTML = '';
    const boxFading = !!appearing && appearing.indexOf(w) >= 0;
    if (tagLabel && !tagLabel.isConnected) w.appendChild(tagLabel);
    state.pieces.forEach((p, i) => {
      const remove = e => {
        if (e && e.target.closest('[data-oa-brief-piece-edit]')) return; // the edit link navigates instead
        // Its configurations go with it, or picking the piece again from the drawer revives them
        state.dropped = (state.dropped || []).concat(items().filter(c => c.name === p).map(c => ({ slug: c.slug, options: c.options })));
        state.configs = (state.configs || []).filter(c => c.name !== p);
        state.pieces.splice(i, 1); renderPieces(); save();
      };
      let b;
      if (tagTpl) {
        // The generated button carried the remove affordance; a cloned div has to be
        // given it back, or the tag is unremovable by keyboard and silent to a reader.
        const unit = tagTpl.cloneNode(true);
        b = unit.matches('[data-oa-brief-piece-tag]') ? unit : $('[data-oa-brief-piece-tag]', unit);
        b.removeAttribute('data-oa-brief-piece-tag');
        const edit = $('[data-oa-brief-piece-edit]', unit);
        const mark = edit && document.createComment('');
        if (edit) edit.replaceWith(mark); // out of the way of setText, which takes the first <p>
        // [data-oa-brief-piece-name] is the text slot; without one the tag's own text is replaced
        setText($('[data-oa-brief-piece-name]', b) || b, p);
        if (mark) mark.replaceWith(...editLinks(edit, p));
        if (b.tagName !== 'BUTTON') { b.setAttribute('role', 'button'); b.setAttribute('tabindex', '0'); }
        b.addEventListener('keydown', e => {
          if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('[data-oa-brief-piece-edit]')) { e.preventDefault(); remove(); }
        });
        w.appendChild(unit);
        if (shownTags.indexOf(p) < 0 && !boxFading) fadeIn(unit);
      } else {
        b = document.createElement('button'); b.type = 'button'; b.className = 'brief_tag'; b.textContent = p;
        w.appendChild(b);
        if (shownTags.indexOf(p) < 0 && !boxFading) fadeIn(b);
      }
      b.setAttribute('aria-label', 'Remove ' + p);
      b.addEventListener('click', remove);
    });
    shownTags = state.pieces.slice();
  }

  // ---- summary
  function label(name, v) { const el = inputs(name).filter(e => e.value === v)[0]; const l = el && el.closest('label'); return l ? l.textContent.trim() : v; }
  // If the Designer provides a row template inside [data-oa-brief-summary], clone it
  // per answer and fill its key / value / change slots. That way the summary is built
  // and styled in the Designer — visible on the canvas — instead of from class names
  // invented here. Without a template we fall back to plain generated markup.
  const summaryTpl = (() => {
    const t = $('[data-oa-brief-summary-row]');
    if (!t) return null;
    const clone = t.cloneNode(true);
    clone.removeAttribute('data-oa-brief-summary-row');
    setHidden(t, true);
    return clone;
  })();
  function rowFromTemplate(k, v, onChange) {
    const row = summaryTpl.cloneNode(true);
    const key = row.querySelector('[data-oa-brief-summary-key]');
    const val = row.querySelector('[data-oa-brief-summary-value]');
    const chg = row.querySelector('[data-oa-brief-summary-change]');
    setText(key, k); setText(val, v);
    if (chg) {
      if (onChange) chg.addEventListener('click', e => { e.preventDefault(); onChange(); });
      // Hidden, not removed: the row is flex, so dropping a cell re-shrinks the label and the answer shifts
      else chg.style.visibility = 'hidden';
    }
    return row;
  }
  // The month input's value is "2027-02"; the summary reads "February 2027". The payload
  // keeps the ISO value — the Edge Function stores it as a date.
  function monthName(v) {
    const m = /^(\d{4})-(\d{2})$/.exec(v || ''); if (!m) return v;
    return new Date(+m[1], +m[2] - 1, 1).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
  }
  function renderSummary() {
    const dl = $('[data-oa-brief-summary]'); if (!dl) return; dl.innerHTML = '';
    const rows = [];
    const add = (step, k, text) => { if (text && text.length) rows.push([step, k, Array.isArray(text) ? text.join(', ') : text]); };
    add('project', 'Project', state.project); // no step, so no Change button: the name is edited on /saved-items
    add('who', 'For', label('audience', val('audience')));
    add('what', 'After', (val('after') || []).map(v => label('after', v)));
    add('piece', 'Pieces', state.pieces);
    add('piece', 'Configurations', items().map(i => {
      const config = Object.keys(i.labels).map(k => i.labels[k]).join(' · ');
      return (config ? i.name + ' — ' + config : i.name) + (i.qty > 1 ? ' ×' + i.qty : '');
    }).join('; '));
    add('bespoke', 'Bespoke', (val('bespoke') || []).map(v => label('bespoke', v)));
    add('where', 'Setting', (val('setting') || []).map(v => label('setting', v)));
    add(branch() === 'client' ? 'when' : 'where', 'How many', val('quantity') && label('quantity', val('quantity')));
    add('when', 'When', val('timing') && (val('timing') === 'date' ? 'By ' + monthName(val('timing_date')) : label('timing', val('timing'))));
    add('when', 'Budget', val('budget') && label('budget', val('budget')));
    add('when', 'Materials', (val('materials') || []).map(v => label('materials', v)));
    add(has('after=bespoke') ? 'bespoke' : 'when', 'Note', val('note'));
    const r = route();
    rows.forEach(([step, k, v]) => {
      const at = r.findIndex(s => s.id === step);
      const jump = at >= 0 ? () => show(at, true) : null;
      if (summaryTpl) { dl.appendChild(rowFromTemplate(k, v, jump)); return; }
      const row = document.createElement('div'); row.className = 'brief_summary_row';
      const dt = document.createElement('div'); dt.className = 'brief_summary_key'; dt.textContent = k;
      const dd = document.createElement('div'); dd.className = 'brief_summary_value'; dd.textContent = v;
      row.append(dt, dd);
      if (jump) { const b = document.createElement('button'); b.type = 'button'; b.className = 'brief_summary_change'; b.textContent = 'Change'; b.addEventListener('click', jump); row.appendChild(b); }
      dl.appendChild(row);
    });
  }

  // ---- Turnstile (invisible). Host is a JS-made div on the root, outside any step, so it
  // renders whether the send screen is 'looking' or 'you'. Tokens are single-use: reset after
  // a failed send. Mount is lazy — first time a send screen shows.
  let widgetId = null, turnstileLoading = false, token = '', tokenResolve = null;
  const tokenReady = () => new Promise(res => { if (token) return res(token); tokenResolve = res; });
  function mountTurnstile() {
    if (!TURNSTILE_KEY || widgetId !== null || turnstileLoading) return;
    turnstileLoading = true;
    let host = $('[data-oa-brief-turnstile-host]');
    if (!host) { host = document.createElement('div'); host.setAttribute('data-oa-brief-turnstile-host', ''); root.appendChild(host); }
    const render = () => {
      widgetId = window.turnstile.render(host, {
        sitekey: TURNSTILE_KEY, size: 'invisible',
        callback: t => { token = t; if (tokenResolve) { tokenResolve(t); tokenResolve = null; } },
        'error-callback': () => { token = ''; if (tokenResolve) { tokenResolve(''); tokenResolve = null; } },
        'expired-callback': () => { token = ''; }
      });
    };
    if (window.turnstile) return render();
    const s = document.createElement('script'); s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; s.async = true; s.onload = render; document.head.appendChild(s);
  }
  async function turnstileToken() {
    if (!TURNSTILE_KEY) return '';
    mountTurnstile();
    if (token) return token;
    return Promise.race([tokenReady(), new Promise(res => setTimeout(() => res(token), 10000))]);
  }
  function turnstileReset() { token = ''; if (window.turnstile && widgetId !== null) { try { window.turnstile.reset(widgetId); } catch (e) {} } }

  // ---- finish / send
  function finish(ref) {
    const st = steps.filter(s => s.id === 'sent')[0];
    swap(() => {
      steps.forEach(s => s.els.forEach(el => setHidden(el, s !== st)));
      const name = firstName();
      $$('[data-oa-brief-sent-heading]').forEach(h =>
        setText(h, fill(copyFor('sent-text', 'Sent. Thank you, {name}.'), { name: name })));
      $$('[data-oa-brief-sent-body]').forEach(b =>
        setText(b, fill(copyFor('sent-body-text', SENT[branch()] || SENT.client), { name: name })));
      // A reference is only useful to someone we emailed it to, and lookingEmail() never
      // quotes one — so the just-looking screen shows no ref, email left or not.
      const showRef = !!ref && branch() !== 'looking';
      $$('[data-oa-brief-ref-line]').forEach(r => {
        setText(r, showRef ? fill(copyFor('ref-text', 'Your reference is {ref}.'), { ref: ref }) : '');
        setHidden(r, !showRef);
      });
      setHidden(nav, true); if (progress) setText(progress, ''); document.title = copyFor('sent-title', 'Sent — New Project Brief');
      if (status) status.textContent = copyFor('sent-status-text', 'Brief sent.');
      reveal(st.els);
    });
    try { sessionStorage.removeItem(STORE); } catch (e) {}
  }
  async function payload() {
    const p = {}; KEYS.forEach(k => { p[k] = val(k); });
    p.name = fullName(); delete p.first_name; delete p.last_name;
    p.email = val('email'); p.pieces = state.pieces; p.items = items(); p.project = state.project || ''; p.website = honeypot ? honeypot.value : '';
    p.referrer = document.referrer || ''; p.origin_url = location.href; p.started_at = startedAt; p.turnstile = await turnstileToken();
    return p;
  }
  async function send(btn) {
    if (!ENDPOINT) { console.warn('oa-brief: no data-oa-brief-endpoint'); return finish(''); }
    btn.disabled = true; if (status) status.textContent = 'Sending…';
    try {
      const body = JSON.stringify(await payload());
      const r = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || r.status);
      finish(j.ref || '');
    } catch (e) {
      btn.disabled = false; turnstileReset();
      if (status) status.textContent = e.message === 'limit'
        ? copy('limit-text', "You've sent a few of these already. Please try again later, or email us directly.")
        : e.message === 'link'
          ? copy('link-text', "Please take the web link out of your name, pieces or project name and try again. Links are fine in the note.")
          : copy('error-text', "That didn't send. Please try again, or email us directly.");
      console.error('oa-brief', e);
    }
  }
  const hpHook = document.querySelector('[data-oa-brief-honeypot]') || document.querySelector('input[name="website"]');
  const honeypot = hpHook && (hpHook.matches('input') ? hpHook : hpHook.querySelector('input'));
  const finishBtn = $('[data-oa-brief-finish]');
  if (finishBtn) finishBtn.addEventListener('click', e => { e.preventDefault(); send(finishBtn); });
  const sendBtn = $('[data-oa-brief-send]');
  if (sendBtn) sendBtn.addEventListener('click', e => {
    e.preventDefault();
    const err = $('[data-oa-brief-error]');
    const addr = (val('email') || '').trim();
    const field = inputs('email').filter(e => { const st = e.closest('[data-oa-brief-step]'); return st && !st.hidden; })[0];
    // Never use checkValidity() here. Lumos's Form Input emits pattern="" when its
    // Pattern prop is blank, and an empty pattern matches only the empty string, so
    // every real address reports invalid. Validate the shape ourselves — same rule
    // the Edge Function applies server-side.
    // The status line announces the error once; aria-invalid + aria-describedby keep it
    // tied to the field, so a screen reader returning to it still hears what's wrong.
    // Link the error only while it shows: a hidden element's text still describes.
    const bad = !EMAIL_RE.test(addr);
    if (field) {
      field.setAttribute('aria-invalid', String(bad));
      if (bad && err) { err.id = err.id || 'oa-brief-email-error'; field.setAttribute('aria-describedby', err.id); }
      else field.removeAttribute('aria-describedby');
    }
    if (bad) { setHidden(err, false); if (field) field.focus(); if (status && err) status.textContent = err.textContent; return; }
    setHidden(err, true);
    send(sendBtn);
  });

  // ---- init
  setHidden($('[data-oa-brief-error]'), true);
  restore();
  history.replaceState({ oaBrief: 0 }, '');
  // Resuming after an edit: one history entry per step before it, so Back walks the route as usual
  const at = resumeAt ? route().findIndex(s => s.id === resumeAt) : -1;
  for (let i = 1; i <= at; i++) history.pushState({ oaBrief: i }, '');
  show(Math.max(at, 0), false);
  // Releases the pre-hide in oa-styles.css. From here the engine owns visibility.
  root.setAttribute('data-oa-brief-ready', '');
})();
