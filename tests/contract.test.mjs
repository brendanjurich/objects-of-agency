// The Designer hook contract check (tools/contract.mjs) against captured staging pages:
// a capture gives its known result, and removing any one hook fails, naming that hook.
// Recapture a fixture after a deliberate Designer change (see the header of each).
//   node --test tests/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkPage, loadManifest, PAGES } from '../tools/contract.mjs';

const fixture = page => readFileSync(new URL(`./fixtures/contract/${page}.html`, import.meta.url), 'utf8');
const failed = r => r.fail.map(l => l.replace(/ — .*/, ''));

// What each capture fails today.
const KNOWN = { contact: [], 'saved-items': [], product: [], legal: [] };

for (const page of PAGES) {
  test(`${page}: the capture gives its known result`, async () => {
    const r = await checkPage(await loadManifest(page), fixture(page));
    assert.deepEqual(failed(r), KNOWN[page]);
    assert.ok(r.ok.length > 5);
  });

  test(`${page}: removing any one declared hook fails, naming it`, async () => {
    const m = await loadManifest(page);
    const html = fixture(page);
    for (const [label, attr] of m.attrs) {
      if (KNOWN[page].includes(label)) continue;
      const r = await checkPage(m, html.replaceAll(attr + '="', 'data-removed="'));
      assert.ok(failed(r).includes(label), `${page}: removing [${attr}] should fail "${label}"`);
    }
    for (const n of m.inputs || []) {
      const r = await checkPage(m, html.replaceAll(`name="${n}"`, 'name="renamed"'));
      assert.ok(failed(r).includes(`input name="${n}"`), `${page}: renaming input ${n} should fail`);
    }
  });

  test(`${page}: an older engine tag fails`, async () => {
    const m = await loadManifest(page);
    const r = await checkPage(m, fixture(page).replace(/v1\.0\.\d+(\/src\/js\/)/g, 'v1.0.1$1'));
    for (const file of Object.keys(m.engines)) assert.ok(failed(r).includes(`${file} >= v1.0.${m.engines[file]}`));
  });
}

test('a pending hook is a note while absent and fails once published', async () => {
  const m = { ...(await loadManifest('contact')), pending: [['future hook', 'data-oa-brief-future']] };
  const html = fixture('contact');
  const absent = await checkPage(m, html);
  assert.deepEqual(failed(absent), []);
  assert.ok(absent.notes.some(n => n.includes('[data-oa-brief-future]')));
  const published = await checkPage(m, html.replace('<body', '<body data-oa-brief-future=""'));
  assert.ok(failed(published).includes('future hook (pending)'));
});

test('contact: a single-read hook duplicated by the Designer fails', async () => {
  const m = await loadManifest('contact');
  const html = fixture('contact').replace('data-oa-brief-drawer-done-max=""', 'data-oa-brief-drawer-done-max="" data-oa-brief-drawer-done-text=""');
  assert.ok(failed(await checkPage(m, html)).includes('[data-oa-brief-drawer-done-text] exactly once'));
});

test('saved-items: one row missing its config line fails', async () => {
  const m = await loadManifest('saved-items');
  const r = await checkPage(m, fixture('saved-items').replace('data-oa-saved-line="Timber"', 'data-removed="Timber"'));
  assert.ok(failed(r).includes('every row has a Timber line'));
});

test('contact: a honeypot named "website" fails', async () => {
  const m = await loadManifest('contact');
  const html = fixture('contact').replace(/<input[^>]*data-oa-brief-honeypot[^>]*>/, tag => tag.replace(/\bname="[^"]*"/, 'name="website"'));
  assert.ok(failed(await checkPage(m, html)).includes('honeypot name autofill ignores'));
});

test('contact: a step block lost from the published markup fails its pair', async () => {
  const m = await loadManifest('contact');
  const r = await checkPage(m, fixture('contact').replace('data-oa-brief-step="when"', 'data-removed="when"'));
  assert.ok(failed(r).includes('step pair: when'));
});

test('a commit-SHA script URL (the cached-404 unblock) passes the engine check', async () => {
  const m = await loadManifest('product');
  const sha = 'a'.repeat(40);
  const r = await checkPage(m, fixture('product').replace(/v1\.0\.\d+(\/src\/js\/oa-saved-items\.js)/, sha + '$1'));
  assert.deepEqual(failed(r), []);
});

test('contact: an empty or non-https endpoint fails', async () => {
  const m = await loadManifest('contact');
  const r = await checkPage(m, fixture('contact').replace(/data-oa-brief-endpoint="[^"]*"/, 'data-oa-brief-endpoint=""'));
  assert.ok(failed(r).includes('endpoint knob is an https URL'));
});

test('any page: visible Webflow placeholder text fails; inside w-condition-invisible it is only noted', async () => {
  const m = await loadManifest('contact');
  const shown = await checkPage(m, fixture('contact').replace('>Tables<', '>This is some text inside of a div block.<'));
  assert.ok(failed(shown).includes('no Webflow placeholder text'));
  const hidden = await checkPage(m, fixture('contact').replace('</body>', '<div class="x w-condition-invisible"><div>Heading</div></div></body>'));
  assert.ok(!failed(hidden).includes('no Webflow placeholder text'));
  assert.ok(hidden.notes.some(n => n.startsWith('placeholder text inside w-condition-invisible')));
});

test('contact: a map category the CMS no longer carries fails; empty-ok downgrades it to a note', async () => {
  const m = await loadManifest('contact');
  const renamed = fixture('contact').replace('data-oa-brief-drawer-category="seating"', 'data-oa-brief-drawer-category="seats"');
  assert.ok(failed(await checkPage(m, renamed)).some(l => l.startsWith('map category "seats"')));
  const staged = await checkPage(m, renamed.replace('data-oa-brief-drawer-category="seats"', 'data-oa-brief-drawer-category="seats" data-oa-brief-drawer-empty-ok=""'));
  assert.ok(!failed(staged).some(l => l.startsWith('map category "seats"')));
  assert.ok(staged.notes.some(n => n.includes('"seats" is empty (empty-ok)')));
});

test('contact: a Filter Tags value no item holds fails its map type', async () => {
  const m = await loadManifest('contact');
  const r = await checkPage(m, fixture('contact').replaceAll('data-oa-brief-drawer-tags="" class="piece_drawer_item-tags">side<', 'data-oa-brief-drawer-tags="" class="piece_drawer_item-tags">side-table<'));
  assert.ok(failed(r).some(l => l.startsWith('map type "side"')));
});
