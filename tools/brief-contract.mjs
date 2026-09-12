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
check('engine >= v1.0.183 (split-name support)', ver >= 183, 'page loads v1.0.' + ver);
check('exactly one [data-oa-brief] root', count(/data-oa-brief=""/g) === 1, count(/data-oa-brief=""/g) + ' found');
check('endpoint knob', has(/data-oa-brief-endpoint="https/));

// 2. step pairs — every step id must appear twice (question + answers)
const stepIds = [...html.matchAll(/data-oa-brief-step="([a-z]+)"/g)].map(m => m[1]);
const byStep = {};
stepIds.forEach(id => byStep[id] = (byStep[id] || 0) + 1);
for (const id of ['who','looking','what','piece','bespoke','where','when','you','sent'])
  check('step pair: ' + id, byStep[id] === 2, (byStep[id] || 0) + ' block(s)');

// 3. named inputs the engine reads
for (const n of ['audience','after','bespoke','setting','quantity','timing','timing_date','budget','materials','interest','note','first_name','last_name','email','practice','piece_input','website'])
  check('input name="' + n + '"', names.has(n), names.has(n) ? '' : 'ABSENT from served DOM');

// 4. controls and regions
for (const [label, attr] of [
  ['Continue','data-oa-brief-next'], ['Back','data-oa-brief-back'],
  ['Send','data-oa-brief-send'], ['Done (looking)','data-oa-brief-finish'],
  ['progress','data-oa-brief-progress'], ['status live region','data-oa-brief-status'],
  ['email error','data-oa-brief-error'], ['summary target','data-oa-brief-summary'],
  ['piece tags','data-oa-brief-pieces'], ['piece input','data-oa-brief-piece-input'],
  ['sent heading','data-oa-brief-sent-heading'], ['sent body','data-oa-brief-sent-body'],
  ['ref line','data-oa-brief-ref-line'],
]) check(label, has(new RegExp(attr + '="')), '');

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

console.log('PASS (' + ok.length + ')');
ok.forEach(l => console.log('  ok   ' + l));
console.log('\nFAIL (' + fail.length + ')');
fail.forEach(l => console.log('  FAIL ' + l));
process.exit(fail.length ? 1 : 0);
