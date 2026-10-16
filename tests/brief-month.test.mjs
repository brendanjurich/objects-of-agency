// The brief's month select (oa-brief.js), in a real browser on the captured /contact page, its
// month select swapped for one per test. The clock is pinned to 16-10-2026.
//   node --test tests/

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const SCRIPT = readFileSync(new URL('../src/js/oa-brief.js', import.meta.url), 'utf8');
const PAGE = readFileSync(new URL('./fixtures/contract/contact.html', import.meta.url), 'utf8')
  .replace(/<script[\s\S]*?<\/script>/g, '');
const FIELD = /<select name="timing_date"[\s\S]*?<\/select>/;
const SELECT = (attrs = '') => `<select name="timing_date" class="form_field is-select"${attrs}><option value="">Select one...</option></select>`;

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser.close(); });

async function open(field, draft) {
  const context = await browser.newContext();
  await context.clock.setFixedTime(new Date(2026, 9, 16, 12));
  if (draft) await context.addInitScript(d => sessionStorage.setItem('oa-brief', d), JSON.stringify(draft));
  await context.route('**/*', route => route.request().url().startsWith('http://oa.test/')
    ? route.fulfill({ contentType: 'text/html', body: PAGE.replace(FIELD, () => field).replace('</body>', () => `<script>${SCRIPT}</script></body>`) })
    : route.abort());
  const page = await context.newPage();
  await page.goto('http://oa.test/contact');
  const options = () => page.$$eval('select[name="timing_date"] option', os => os.map(o => ({ value: o.value, text: o.text, disabled: o.disabled, hidden: o.hidden })));
  return { page, context, options };
}

test('the select lists a placeholder, then 24 months from next month', async () => {
  const { context, options } = await open(SELECT());
  const os = await options();
  assert.equal(os.length, 25);
  assert.deepEqual(os[0], { value: '', text: 'Choose a month', disabled: true, hidden: true });
  assert.deepEqual(os[1], { value: '2026-11', text: 'November 2026', disabled: false, hidden: false });
  assert.deepEqual(os[3], { value: '2027-01', text: 'January 2027', disabled: false, hidden: false });
  assert.deepEqual(os[24], { value: '2028-10', text: 'October 2028', disabled: false, hidden: false });
  await context.close();
});

test('data-oa-brief-months sets the window', async () => {
  const { context, options } = await open(SELECT(' data-oa-brief-months="6"'));
  const os = await options();
  assert.equal(os.length, 7);
  assert.equal(os[6].value, '2027-04');
  await context.close();
});

test('nothing is picked until the visitor picks', async () => {
  const { page, context } = await open(SELECT());
  assert.equal(await page.$eval('select[name="timing_date"]', s => s.selectedIndex), 0);
  await context.close();
});

test('a saved month in the window comes back', async () => {
  const { page, context } = await open(SELECT(), { timing: 'date', timing_date: '2027-02' });
  assert.equal(await page.$eval('select[name="timing_date"]', s => s.value), '2027-02');
  await context.close();
});

test('a saved month outside the window, or old free text, falls back to the placeholder', async () => {
  for (const v of ['2026-09', 'March next year']) {
    const { page, context } = await open(SELECT(), { timing: 'date', timing_date: v });
    assert.equal(await page.$eval('select[name="timing_date"]', s => s.selectedIndex), 0, v);
    await context.close();
  }
});

test('every month carries the directional hover item and tile; the placeholder does not', async () => {
  const { page, context } = await open(SELECT());
  const rows = await page.$$eval('select[name="timing_date"] option', os => os.map(o => ({
    item: o.hasAttribute('data-directional-hover-item'),
    tile: !!o.querySelector('[data-directional-hover-tile].directional-list__hover-tile'),
    text: o.text,
  })));
  assert.deepEqual(rows[0], { item: false, tile: false, text: 'Choose a month' });
  assert.ok(rows.slice(1).every(r => r.item && r.tile), 'every month has its item hook and tile');
  assert.equal(rows[1].text, 'November 2026');
  await context.close();
});
