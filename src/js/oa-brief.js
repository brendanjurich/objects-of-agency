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
  function reveal(els) {
    if (reduce || !window.gsap) return;
    window.gsap.fromTo(els, { opacity: 0, y: 8, filter: 'blur(4px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.45, ease: window.CustomEase && window.gsap.parseEase('oa') ? 'oa' : 'power2.out', clearProps: 'filter' });
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
    if (progress) setText(progress, 'Question ' + n + ' of ' + N);
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
    $$('[data-oa-brief-sent-heading]').forEach(h => setText(h, 'Sent.' + (name ? ' Thank you, ' + name + '.' : ' Thank you.')));
    $$('[data-oa-brief-sent-body]').forEach(b => setText(b, SENT[branch()] || SENT.client));
    $$('[data-oa-brief-ref-line]').forEach(r => { setText(r, ref ? 'Your reference is ' + ref + '.' : ''); setHidden(r, !ref); });
    setHidden(nav, true); if (progress) setText(progress, ''); document.title = 'Sent — New Project Brief';
    if (status) status.textContent = 'Brief sent.';
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
      if (status) status.textContent = "That didn't send. Please try again, or email us directly.";
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
