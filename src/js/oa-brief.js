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

(function () {
  const root = document.querySelector('[data-oa-brief]');
  if (!root) return;

  const CATALOGUE = ['ViewFinder Argent','ViewFinder Aurum','ViewFinder CR','ViewFinder Cuprum','ViewFinder Noir CR','ViewFinder Noir Nest','ViewFinder Noir S','ViewFinder Umbra','ViewFinder Xen','XO Sideboard','Sideboard 2','Interior Credenza','Console Table 1','Dining Table 1','Desk 1','Laptop Table','Bedside Table 1','Seat 1','Seat 2','Hemisphere','ViewFinder Series','Vesper Series','Terroir Series','Locus Series','Noir Series','Nested Tables','Edition Pieces','Custom Cabinetry'];
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
  const params = new URLSearchParams(location.search);
  if (params.get('piece')) { state.after = ['seen']; state.skipWhat = true; const p = params.get('piece'); if (state.pieces.indexOf(p) < 0) state.pieces.push(p); }
  const startedAt = Date.now();

  // ---- values (inner-group scoping only; a step being hidden never hides its answers)
  // Step blocks carry branch attributes too, and a step that isn't current is hidden — that
  // must never switch its answers off, only a scoped inner group (branch/when/unless) may.
  const off = el => {
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

  // ---- reveal (GSAP if present, respects reduced motion)
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Clear the transform too: a leftover identity matrix still makes the step a stacking
  // context, which trapped the piece list's z-index under .brief_nav's Back/Continue.
  function reveal(els) {
    if (reduce || !window.gsap) return;
    window.gsap.fromTo(els, { opacity: 0, y: 8, filter: 'blur(4px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.45, ease: window.CustomEase && window.gsap.parseEase('oa') ? 'oa' : 'power2.out', clearProps: 'filter,transform' });
  }

  let idx = 0;
  let first = true;
  function show(i, push) {
    const r = route(); idx = Math.max(0, Math.min(i, r.length - 1)); const st = r[idx];
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
    if (h && !first) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    reveal(st.els);
    if (push) history.pushState({ oaBrief: idx }, '');
    first = false;
    save();
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
    const s = {}; KEYS.forEach(k => { s[k] = val(k); }); s.pieces = state.pieces; s.skipWhat = state.skipWhat;
    try { sessionStorage.setItem(STORE, JSON.stringify(s)); } catch (e) {}
  }
  function restore() {
    Object.keys(state).forEach(k => {
      if (k === 'pieces' || k === 'skipWhat') return; const v = state[k];
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

  // ---- pieces: catalogue autocomplete + tags
  // A native <datalist> can't be styled, and Chrome only shows its arrow on hover, so
  // touch visitors never find the list. If the Designer builds one in the piece step, the
  // engine drives that instead: [data-oa-brief-piece-list] holding one
  // [data-oa-brief-piece-option] (cloned per match; the keyboard highlight gets .is-active),
  // plus an optional [data-oa-brief-piece-toggle] that opens it. Without them, datalist.
  const pieceInput = $('[data-oa-brief-piece-input]');
  const pieceList = $('[data-oa-brief-piece-list]');
  const pieceOptTpl = pieceList && $('[data-oa-brief-piece-option]', pieceList);
  if (pieceInput && pieceOptTpl) {
    const toggle = $('[data-oa-brief-piece-toggle]');
    const tpl = pieceOptTpl.cloneNode(true); tpl.removeAttribute('data-oa-brief-piece-option'); pieceOptTpl.remove();
    let active = -1;
    // Picking an option or pressing the toggle blurs the input first, and blur fires
    // `change`, which would add the half-typed text as a piece. pointerdown lands before both.
    let picking = false;
    pieceList.id = pieceList.id || 'oa-brief-catalogue';
    pieceList.setAttribute('role', 'listbox');
    pieceList.setAttribute('data-lenis-prevent', ''); // let a scrolling list scroll under Lenis
    pieceInput.setAttribute('role', 'combobox'); pieceInput.setAttribute('aria-autocomplete', 'list');
    pieceInput.setAttribute('aria-controls', pieceList.id); pieceInput.setAttribute('aria-expanded', 'false');
    setHidden(pieceList, true);
    const opts = () => $$('[role="option"]', pieceList);
    const isOpen = () => !pieceList.hidden;
    // Each option carries the nav's hover tile, because Brendan built the option
    // with .nav_dropdown_hover_tile. oa-global's initDirectionalHover() binds at
    // DOMContentLoaded and cannot see options that only exist once the list opens,
    // so bind per clone here instead of bumping the sitewide file. The list is
    // rebuilt on every open, so listeners never accumulate. Vertical axis and mouse
    // only, matching the stacked list on /about; the keyboard equivalent is the
    // .is-active class, which the site's State Manager already hands the Designer.
    function bindTile(opt) {
      const tile = opt.querySelector('.nav_dropdown_hover_tile');
      if (!tile) return;
      const exit = dir => dir === 'top' ? 'translateY(-100%)' : 'translateY(100%)';
      const edge = e => (e.clientY - opt.getBoundingClientRect().top) < opt.offsetHeight / 2 ? 'top' : 'bottom';
      const enter = dir => {
        tile.style.transition = 'none';
        tile.style.transform = exit(dir);
        void tile.offsetHeight;    // forced reflow to flush the jump
        tile.style.transition = '';  // back to the CSS transition
        tile.style.transform = 'translate(0%, 0%)';
      };
      const leave = dir => { tile.style.transform = exit(dir); };
      opt.oaTile = { enter, leave }; // highlight() drives the same fill from the keyboard
      opt.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') enter(edge(e)); });
      opt.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') leave(edge(e)); });
    }
    function openList() {
      const q = pieceInput.value.trim().toLowerCase();
      const top = pieceList.scrollTop; // a refresh after a pick keeps the visitor's place
      pieceList.innerHTML = ''; active = -1; pieceInput.removeAttribute('aria-activedescendant');
      CATALOGUE.filter(n => n.toLowerCase().indexOf(q) >= 0).forEach((n, i) => {
        const o = tpl.cloneNode(true); o.id = 'oa-brief-piece-' + i; o.dataset.value = n;
        o.setAttribute('role', 'option'); o.setAttribute('aria-selected', 'false');
        setText(o, n); bindTile(o); pieceList.appendChild(o);
      });
      const any = pieceList.children.length > 0;
      pieceList.scrollTop = top;
      setHidden(pieceList, !any); pieceInput.setAttribute('aria-expanded', String(any));
      setToggleOpen(any);
    }
    function closeList() {
      setHidden(pieceList, true); active = -1;
      pieceInput.setAttribute('aria-expanded', 'false'); pieceInput.removeAttribute('aria-activedescendant');
      setToggleOpen(false);
    }
    // The arrow rotates off the site's State Manager, the same machinery as the nav
    // dropdown caret: .brief_fields-toggle already carries the Designer's
    // rotate(calc(-180deg * var(--_state---false))) and its transition. The nav flips
    // that variable through [data-state~="expanded"] + aria-expanded; this toggle is a
    // plain div with no ARIA of its own — the combobox input owns aria-expanded — so
    // use .is-active, the State Manager's own class hook. It flips the same variable
    // and gives the Designer a real open state to style.
    function setToggleOpen(on) { if (toggle) toggle.classList.toggle('is-active', on); }
    // `down` is the arrow key's direction. A keyboard has no cursor to read an entry
    // edge from, so take it from the key: moving down the list, the fill enters from
    // the top and the row above empties upwards, so it reads as one continuous travel
    // down the column — the same motion a mouse gets, rather than a separate look the
    // Designer would have to style twice.
    function highlight(i, down) {
      const os = opts(); if (!os.length) return;
      const prev = os[active];
      active = (i + os.length) % os.length;
      os.forEach((o, j) => { o.classList.toggle('is-active', j === active); o.setAttribute('aria-selected', String(j === active)); });
      pieceInput.setAttribute('aria-activedescendant', os[active].id);
      os[active].scrollIntoView({ block: 'nearest' });
      if (prev && prev !== os[active] && prev.oaTile) prev.oaTile.leave(down ? 'top' : 'bottom');
      if (os[active].oaTile) os[active].oaTile.enter(down ? 'top' : 'bottom');
    }
    // The list stays open until the arrow toggle (or Escape) shuts it, so a visitor can
    // add several pieces in a row. Picking refreshes it against the now-empty input.
    function pick(n) { pieceInput.value = n; addPiece(); openList(); }
    pieceInput.addEventListener('input', () => { picking = false; openList(); });
    pieceInput.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); if (!isOpen()) openList();
        const down = e.key === 'ArrowDown';
        highlight(active < 0 ? (down ? 0 : -1) : active + (down ? 1 : -1), down);
      } else if (e.key === 'Enter') {
        e.preventDefault(); const o = opts()[active];
        if (isOpen() && o) pick(o.dataset.value); else { addPiece(); if (isOpen()) openList(); }
      } else if (e.key === 'Escape') closeList(); // the toggle is out of the tab order
    });
    pieceInput.addEventListener('change', () => { if (!picking) addPiece(); });
    [pieceList, toggle].forEach(el => {
      if (!el) return;
      el.addEventListener('pointerdown', () => { picking = true; });
      el.addEventListener('pointercancel', () => { picking = false; });
      el.addEventListener('mousedown', e => e.preventDefault()); // keep focus in the input
    });
    pieceList.addEventListener('click', e => {
      picking = false; const o = e.target.closest('[role="option"]'); if (o) pick(o.dataset.value);
    });
    if (toggle) {
      toggle.setAttribute('aria-label', 'Show pieces'); toggle.setAttribute('tabindex', '-1');
      toggle.addEventListener('click', e => { e.preventDefault(); picking = false; if (isOpen()) closeList(); else openList(); });
    }
  } else if (pieceInput) {
    const dl = document.createElement('datalist'); dl.id = 'oa-brief-catalogue';
    CATALOGUE.forEach(n => { const o = document.createElement('option'); o.value = n; dl.appendChild(o); });
    pieceInput.insertAdjacentElement('afterend', dl); pieceInput.setAttribute('list', dl.id);
    pieceInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addPiece(); } });
    pieceInput.addEventListener('change', addPiece);
  }
  function addPiece() { const v = pieceInput.value.trim(); if (v && state.pieces.indexOf(v) < 0) state.pieces.push(v); pieceInput.value = ''; renderPieces(); save(); }
  // Same template rule as the summary rows and the piece options: if the Designer
  // marks one tag inside [data-oa-brief-pieces], the engine clones it per piece and
  // the styling on the canvas is the styling that ships. Without one it falls back to
  // the bare generated button, which is why a Designer-built tag styled but never
  // attribute-marked lost its padding — innerHTML wipes it before it is ever seen.
  const tagWrap = $('[data-oa-brief-pieces]');
  const tagTplSrc = tagWrap && $('[data-oa-brief-piece-tag]', tagWrap);
  const tagTpl = tagTplSrc && tagTplSrc.cloneNode(true);
  if (tagTpl) tagTpl.removeAttribute('data-oa-brief-piece-tag');
  function renderPieces() {
    const w = tagWrap; if (!w) return; w.innerHTML = '';
    state.pieces.forEach((p, i) => {
      const remove = () => { state.pieces.splice(i, 1); renderPieces(); save(); };
      let b;
      if (tagTpl) {
        // The generated button carried the remove affordance; a cloned div has to be
        // given it back, or the tag is unremovable by keyboard and silent to a reader.
        b = tagTpl.cloneNode(true); setText(b, p);
        if (b.tagName !== 'BUTTON') { b.setAttribute('role', 'button'); b.setAttribute('tabindex', '0'); }
        b.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); remove(); }
        });
      } else {
        b = document.createElement('button'); b.type = 'button'; b.className = 'brief_tag'; b.textContent = p;
      }
      b.setAttribute('aria-label', 'Remove ' + p);
      b.addEventListener('click', remove); w.appendChild(b);
    });
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
      else setHidden(chg, true);
    }
    return row;
  }
  function renderSummary() {
    const dl = $('[data-oa-brief-summary]'); if (!dl) return; dl.innerHTML = '';
    const rows = [];
    const add = (step, k, text) => { if (text && text.length) rows.push([step, k, Array.isArray(text) ? text.join(', ') : text]); };
    add('who', 'For', label('audience', val('audience')));
    add('what', 'After', (val('after') || []).map(v => label('after', v)));
    add('piece', 'Pieces', state.pieces);
    add('bespoke', 'Bespoke', (val('bespoke') || []).map(v => label('bespoke', v)));
    add('where', 'Setting', (val('setting') || []).map(v => label('setting', v)));
    add(branch() === 'client' ? 'when' : 'where', 'How many', val('quantity') && label('quantity', val('quantity')));
    add('when', 'When', val('timing') && (val('timing') === 'date' ? 'By ' + val('timing_date') : label('timing', val('timing'))));
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
    try { sessionStorage.removeItem(STORE); } catch (e) {}
  }
  async function payload() {
    const p = {}; KEYS.forEach(k => { p[k] = val(k); });
    p.name = fullName(); delete p.first_name; delete p.last_name;
    p.email = val('email'); p.pieces = state.pieces; p.website = val('website') || '';
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
      if (status) status.textContent = copy('error-text', "That didn't send. Please try again, or email us directly.");
      console.error('oa-brief', e);
    }
  }
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
    if (!EMAIL_RE.test(addr)) { setHidden(err, false); if (field) field.focus(); if (status && err) status.textContent = err.textContent; return; }
    setHidden(err, true);
    send(sendBtn);
  });

  // ---- init
  setHidden($('[data-oa-brief-error]'), true);
  restore();
  history.replaceState({ oaBrief: 0 }, '');
  show(0, false);
  // Releases the pre-hide in oa-styles.css. From here the engine owns visibility.
  root.setAttribute('data-oa-brief-ready', '');
})();
