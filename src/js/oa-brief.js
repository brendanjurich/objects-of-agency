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
  const SENT = {
    client: "We'll read this properly and come back within " + RESPONSE + " with first thoughts and a time to talk. A copy is on its way to your inbox — it's written up so you can drop it straight into the project folder.",
    home: "We'll come back within " + RESPONSE + ". A copy is on its way to your inbox with a short note on how a commission works from here.",
    venue: "We'll come back within " + RESPONSE + " with first thoughts and a time to talk. A copy is on its way to your inbox.",
    looking: "Thanks for looking. If you left an email, you'll hear from us when there's something worth showing."
  };
  const STORE = 'oa-brief';
  const $ = (sel, el) => (el || root).querySelector(sel);
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
  const off = el => !!el.closest('[data-oa-brief-branch][hidden],[data-oa-brief-when][hidden],[data-oa-brief-unless][hidden]');
  const inputs = n => $$('[name="' + n + '"]');
  function val(n) {
    const els = inputs(n); if (!els.length) return null;
    if (els[0].type === 'checkbox') return els.filter(e => e.checked && !off(e)).map(e => e.value);
    if (els[0].type === 'radio') { const c = els.filter(e => e.checked && !off(e))[0]; return c ? c.value : null; }
    const e = els.filter(e => !off(e))[0] || els[0]; return e.value;
  }
  const has = cond => { const i = cond.indexOf('='); const k = cond.slice(0, i), v = cond.slice(i + 1); const x = val(k); return Array.isArray(x) ? x.indexOf(v) >= 0 : x === v; };
  const branch = () => val('audience');
  const inBranch = list => !list || list.split(' ').indexOf(branch()) >= 0;
  const visible = st => inBranch(st.branch) && (!st.when || has(st.when));
  const route = () => steps.filter(s => s.id !== 'sent' && !(s.id === 'what' && state.skipWhat) && (s.id === 'who' || (branch() && visible(s))));

  function scopeInner(st) {
    st.els.forEach(el => {
      $$('[data-oa-brief-branch]', el).forEach(g => { g.hidden = !inBranch(g.getAttribute('data-oa-brief-branch')); });
      $$('[data-oa-brief-when]', el).forEach(g => { g.hidden = !has(g.getAttribute('data-oa-brief-when')); });
      $$('[data-oa-brief-unless]', el).forEach(g => { g.hidden = has(g.getAttribute('data-oa-brief-unless')); });
    });
  }

  // ---- reveal (GSAP if present, respects reduced motion)
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function reveal(els) {
    if (reduce || !window.gsap) return;
    window.gsap.fromTo(els, { opacity: 0, y: 8, filter: 'blur(4px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.45, ease: window.CustomEase && window.gsap.parseEase('oa') ? 'oa' : 'power2.out', clearProps: 'filter' });
  }

  let idx = 0;
  function show(i, push) {
    const r = route(); idx = Math.max(0, Math.min(i, r.length - 1)); const st = r[idx];
    steps.forEach(s => s.els.forEach(el => { el.hidden = s !== st; }));
    scopeInner(st);
    if (st.id === 'you') { renderSummary(); mountTurnstile(); }
    if (st.id === 'piece') renderPieces();
    const n = idx + 1, N = branch() ? r.length : '…';
    if (progress) progress.textContent = 'Question ' + n + ' of ' + N;
    document.title = 'Question ' + n + ' of ' + N + ' — New Project Brief';
    const h = $('.brief_question_title', st.els[0]) || st.els[0].querySelector('h2');
    if (status && h) status.textContent = h.textContent;
    if (back) back.hidden = idx === 0;
    if (next) next.hidden = !!st.els.some(el => el.querySelector('[data-oa-brief-auto]')) || st.id === 'you' || st.id === 'looking';
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    reveal(st.els);
    if (push) history.pushState({ oaBrief: idx }, '');
    save();
  }
  const KEYS = ['audience','after','bespoke','setting','quantity','timing','timing_date','budget','materials','note','interest','name','practice'];
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
  if (next) next.addEventListener('click', () => show(idx + 1, true));
  if (back) back.addEventListener('click', () => history.back());
  window.addEventListener('popstate', e => { if (e.state && typeof e.state.oaBrief === 'number') show(e.state.oaBrief, false); else show(0, false); });

  // ---- pieces: catalogue autocomplete + tags
  const pieceInput = $('[data-oa-brief-piece-input]');
  if (pieceInput) {
    const dl = document.createElement('datalist'); dl.id = 'oa-brief-catalogue';
    CATALOGUE.forEach(n => { const o = document.createElement('option'); o.value = n; dl.appendChild(o); });
    pieceInput.insertAdjacentElement('afterend', dl); pieceInput.setAttribute('list', dl.id);
    pieceInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addPiece(); } });
    pieceInput.addEventListener('change', addPiece);
  }
  function addPiece() { const v = pieceInput.value.trim(); if (v && state.pieces.indexOf(v) < 0) state.pieces.push(v); pieceInput.value = ''; renderPieces(); save(); }
  function renderPieces() {
    const w = $('[data-oa-brief-pieces]'); if (!w) return; w.innerHTML = '';
    state.pieces.forEach((p, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'brief_tag'; b.textContent = p; b.setAttribute('aria-label', 'Remove ' + p);
      b.addEventListener('click', () => { state.pieces.splice(i, 1); renderPieces(); save(); }); w.appendChild(b);
    });
  }

  // ---- summary
  function label(name, v) { const el = inputs(name).filter(e => e.value === v)[0]; const l = el && el.closest('label'); return l ? l.textContent.trim() : v; }
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
      const row = document.createElement('div'); row.className = 'brief_summary_row';
      const dt = document.createElement('div'); dt.className = 'brief_summary_key'; dt.textContent = k;
      const dd = document.createElement('div'); dd.className = 'brief_summary_value'; dd.textContent = v;
      row.append(dt, dd);
      const at = r.findIndex(s => s.id === step);
      if (at >= 0) { const b = document.createElement('button'); b.type = 'button'; b.className = 'brief_summary_change'; b.textContent = 'Change'; b.addEventListener('click', () => show(at, true)); row.appendChild(b); }
      dl.appendChild(row);
    });
  }

  // ---- Turnstile (invisible), loaded only when the send screen is reached
  let widgetId = null, turnstileLoading = false;
  function mountTurnstile() {
    const host = $('[data-oa-brief-turnstile]'); if (!TURNSTILE_KEY || !host || widgetId !== null || turnstileLoading) return;
    turnstileLoading = true;
    const render = () => { widgetId = window.turnstile.render(host, { sitekey: TURNSTILE_KEY, size: 'invisible' }); };
    if (window.turnstile) return render();
    const s = document.createElement('script'); s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; s.async = true; s.onload = render; document.head.appendChild(s);
  }
  const turnstileToken = () => (window.turnstile && widgetId !== null) ? window.turnstile.getResponse(widgetId) : '';

  // ---- finish / send
  function finish(ref) {
    const st = steps.filter(s => s.id === 'sent')[0];
    steps.forEach(s => s.els.forEach(el => { el.hidden = s !== st; }));
    const name = (val('name') || '').split(' ')[0];
    const h = $('[data-oa-brief-sent-heading]'); if (h) h.textContent = 'Sent.' + (name ? ' Thank you, ' + name + '.' : ' Thank you.');
    const body = $('[data-oa-brief-sent-body]'); if (body) body.textContent = SENT[branch()] || SENT.client;
    const refLine = $('[data-oa-brief-ref-line]'); if (refLine) { refLine.textContent = ref ? 'Your reference is ' + ref + '.' : ''; refLine.hidden = !ref; }
    if (nav) nav.hidden = true; if (progress) progress.textContent = ''; document.title = 'Sent — New Project Brief';
    if (status) status.textContent = 'Brief sent.';
    reveal(st.els);
    try { sessionStorage.removeItem(STORE); } catch (e) {}
  }
  function payload() {
    const p = {}; KEYS.forEach(k => { p[k] = val(k); });
    p.email = val('email'); p.pieces = state.pieces; p.website = val('website') || '';
    p.referrer = document.referrer || ''; p.origin_url = location.href; p.started_at = startedAt; p.turnstile = turnstileToken();
    return p;
  }
  async function send(btn) {
    if (!ENDPOINT) { console.warn('oa-brief: no data-oa-brief-endpoint'); return finish(''); }
    btn.disabled = true; if (status) status.textContent = 'Sending…';
    try {
      const r = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload()) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || r.status);
      finish(j.ref || '');
    } catch (e) {
      btn.disabled = false;
      if (status) status.textContent = "That didn't send. Please try again, or email us directly.";
      console.error('oa-brief', e);
    }
  }
  const finishBtn = $('[data-oa-brief-finish]');
  if (finishBtn) finishBtn.addEventListener('click', e => { e.preventDefault(); send(finishBtn); });
  const sendBtn = $('[data-oa-brief-send]');
  if (sendBtn) sendBtn.addEventListener('click', e => {
    e.preventDefault();
    const youStep = steps.filter(s => s.id === 'you')[0];
    const email = youStep ? $('[name=email]', youStep.els[1] || youStep.els[0]) : null;
    const err = $('[data-oa-brief-error]');
    if (!email || !email.value || !email.checkValidity()) { if (err) err.hidden = false; if (email) email.focus(); if (status && err) status.textContent = err.textContent; return; }
    if (err) err.hidden = true;
    send(sendBtn);
  });

  // ---- init
  restore();
  history.replaceState({ oaBrief: 0 }, '');
  show(0, false);
})();
