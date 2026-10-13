// Contract check for the /contact project brief.
//
// The Designer and oa-brief.js agree on a set of hooks: step ids, input names,
// chip group names, and control attributes. Restyling in Webflow can silently
// break any of them — a renamed Form Input prop changes the `name` attribute,
// hiding an element drops it from the published markup entirely. Both happened.
//
// Run after any Designer change to /contact, before and after publishing:
//   node tools/brief-contract.mjs [url]
// Exits non-zero and lists exactly which hooks the engine can no longer find.
// Dev-only; nothing here is served.

// Feedback loop for the /contact brief wiring.
// Fetches the published page and asserts every hook oa-brief.js depends on.
// Red when a hook the engine reads is missing from the served DOM.
const URL_ = process.argv[2] || 'https://oa-v5.webflow.io/contact';
const html = await (await fetch(URL_ + '?_=' + Date.now())).text();

const has = re => re.test(html);
const count = re => (html.match(re) || []).length;
const names = new Set([...html.matchAll(/<(?:input|textarea)[^>]*\bname="([^"]+)"/g)].map(m => m[1]));

const fail = [];
const ok = [];
const check = (label, cond, detail = '') => (cond ? ok : fail).push(label + (detail ? ' — ' + detail : ''));

// 1. engine present and single root
const ver = Number(((html.match(/v1\.0\.(\d+)\/src\/js\/oa-brief\.js/) || [])[1]) || 0);
check('engine >= v1.0.190 (Designer-reachable copy knobs)', ver >= 190, 'page loads v1.0.' + ver);
check('exactly one [data-oa-brief] root', count(/data-oa-brief=""/g) === 1, count(/data-oa-brief=""/g) + ' found');
check('endpoint knob', has(/data-oa-brief-endpoint="https/));

// 2. step pairs — every step id must appear twice (question + answers)
const stepIds = [...html.matchAll(/data-oa-brief-step="([a-z]+)"/g)].map(m => m[1]);
const byStep = {};
stepIds.forEach(id => byStep[id] = (byStep[id] || 0) + 1);
for (const id of ['who','looking','what','piece','bespoke','where','when','you','sent'])
  check('step pair: ' + id, byStep[id] === 2, (byStep[id] || 0) + ' block(s)');

// 3. named inputs the engine reads
for (const n of ['audience','after','bespoke','setting','quantity','timing','timing_date','budget','materials','interest','note','email','practice'])
  check('input name="' + n + '"', names.has(n), names.has(n) ? '' : 'ABSENT from served DOM');

// Honeypot: must exist, and must not carry a name browser autofill recognises — a field
// named "website" was filled from the visitor's contact card and real briefs were dropped
// as spam (04-10-2026). autocomplete="off" does not stop autofill.
const hp = (html.match(/<input[^>]*data-oa-brief-honeypot[^>]*>/) || html.match(/<input[^>]*class="brief_honeypot"[^>]*>/) || [''])[0];
const hpOk = /data-oa-brief-honeypot/.test(hp);
check('honeypot input [data-oa-brief-honeypot]', hpOk, hpOk ? '' : hp ? 'found by class only — add the attribute' : 'ABSENT');
const hpName = (hp.match(/\bname="([^"]*)"/) || [])[1] || '';
check('honeypot name autofill ignores', !/^(website|url|homepage|name|email|phone|tel|company|organi[sz]ation|address|fax)$/i.test(hpName), 'name="' + hpName + '"');

// Name is one field or a first/last pair; the engine composes either into `name`.
check('name field (name, or first_name + last_name)', names.has('name') || (names.has('first_name') && names.has('last_name')));

// 4. controls and regions
for (const [label, attr] of [
  ['Continue','data-oa-brief-next'], ['Back','data-oa-brief-back'],
  ['Send','data-oa-brief-send'], ['Done (looking)','data-oa-brief-finish'],
  ['progress','data-oa-brief-progress'], ['status live region','data-oa-brief-status'],
  ['email error','data-oa-brief-error'], ['summary target','data-oa-brief-summary'],
  ['piece tags','data-oa-brief-pieces'], ['piece drawer opener','data-oa-brief-piece-open'],
  ['sent heading','data-oa-brief-sent-heading'], ['sent body','data-oa-brief-sent-body'],
  ['ref line','data-oa-brief-ref-line'],
]) check(label, has(new RegExp(attr + '="')), '');

// 4b. the piece drawer. Every part is a hook the engine walks; a missing one makes it
// warn and skip, and the visitor has no way to name a piece.
for (const [label, attr] of [
  ['drawer <dialog>', 'data-oa-brief-drawer'], ['drawer backdrop', 'data-oa-brief-drawer-backdrop'],
  ['drawer panel', 'data-oa-brief-drawer-panel'], ['series list', 'data-oa-brief-drawer-list'],
  ['sheet template', 'data-oa-brief-drawer-sheet'], ['series row template', 'data-oa-brief-drawer-series-row'],
  ['piece row template', 'data-oa-brief-drawer-piece-row'], ['row text slot', 'data-oa-brief-drawer-text'],
  ['Done bar', 'data-oa-brief-drawer-done'], ['"Something else" row', 'data-oa-brief-drawer-other-toggle'],
  ['drawer anchor (the box it opens over)', 'data-oa-brief-drawer-anchor'],
]) check(label, has(new RegExp(attr + '="')), '');
check('drawer root is a <dialog>', /<dialog[^>]*data-oa-brief-drawer=""/.test(html), 'showModal() needs a real dialog');
// Webflow turns a custom-tag button into a Link (<a>), which can't be disabled or pressed.
check('drawer rows are real <button>s', !/<a[^>]*data-oa-brief-drawer-(?:pick|done|back|edge|other)/.test(html));
// The CMS list is the catalogue. Unbound text slots publish empty, and the drawer has no series.
const items = [...html.matchAll(/data-oa-brief-drawer-item="[\s\S]{0,400}?data-oa-brief-drawer-name="[^>]*>([^<]*)<[\s\S]{0,200}?data-oa-brief-drawer-series="[^>]*>([^<]*)</g)];
check('CMS items carry a name and a series', items.length > 0 && items.every(m => m[1].trim() && m[2].trim()),
  items.length + ' item(s)' + (items.some(m => !m[1].trim() || !m[2].trim()) ? ', some unbound' : ''));
check('Residential filtered out of the drawer', !items.some(m => m[2].trim() === 'Residential'));

// The piece tag has the same template rule, and the same silent failure: renderPieces()
// clears [data-oa-brief-pieces] on every change, so a tag built and styled in the
// Designer but never attribute-marked is wiped before anyone sees it. Its styling just
// never appears, which reads as a CSS problem rather than a missing hook.
if (has(/data-oa-brief-pieces="/) && !has(/data-oa-brief-piece-tag="/))
  console.log('  note  no [data-oa-brief-piece-tag] — engine generates a bare button.brief_tag; any Designer-built tag inside [data-oa-brief-pieces] is wiped unmarked');

// 5. sent-state elements must live inside the sent step, not another step
const sentBlock = (html.match(/data-oa-brief-step="sent"[^>]*class="brief_answers_step"[\s\S]{0,4000}/) || [''])[0];
check('sent body inside sent step', /data-oa-brief-sent-body/.test(sentBlock));
check('ref line inside sent step', /data-oa-brief-ref-line/.test(sentBlock));

// 6. chip groups
const chipGroups = [...html.matchAll(/data-oa-brief-chips="([a-z-]+)"/g)].map(m => m[1]);
for (const g of ['audience','after','bespoke','setting-res','setting-com','quantity-where','quantity-when','timing','budget','materials','interest'])
  check('chip group: ' + g, chipGroups.includes(g));
check('every checkbox/radio carries a value', !/(type="(?:checkbox|radio)"[^>]*value="")/.test(html),
  count(/type="(?:checkbox|radio)"[^>]*value=""/g) + ' empty');

// 7. conditional groups
check('month reveal group (timing=date)', has(/data-oa-brief-when="timing=date"/));
check('note suppression (unless after=bespoke)', has(/data-oa-brief-unless="after=bespoke"/));

// Informational: a class that sets `display` on a step block outranks the UA
// [hidden] rule. The engine forces display inline now, but knowing is useful.
try {
  const cssHref = (html.match(/https:\/\/cdn\.prod\.website-files\.com\/[^"']+\.css/) || [])[0];
  if (cssHref) {
    const css = await (await fetch(cssHref)).text();
    for (const cls of ['brief_answers_step', 'brief_question']) {
      const rule = new RegExp('\\.' + cls + '[^{]*\\{[^}]*display\\s*:', 'i');
      if (rule.test(css)) console.log('  note  .' + cls + ' sets `display` — engine overrides it inline; do not rely on [hidden] alone');
    }
  }
} catch {}

console.log('PASS (' + ok.length + ')');
ok.forEach(l => console.log('  ok   ' + l));
console.log('\nFAIL (' + fail.length + ')');
fail.forEach(l => console.log('  FAIL ' + l));
process.exit(fail.length ? 1 : 0);
