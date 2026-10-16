// The brief's month select (oa-brief.js), in a real browser on the captured /contact page with
// the month field swapped for a Webflow Select. The clock is pinned to 16-10-2026.
//   node --test tests/

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const SCRIPT = readFileSync(new URL('../src/js/oa-brief.js', import.meta.url), 'utf8');
const PAGE = readFileSync(new URL('./fixtures/contract/contact.html', import.meta.url), 'utf8')
  .replace(/<script[\s\S]*?<\/script>/g, '');
const INPUT = /<input name="timing_date"[^>]*>/;
const SELECT = (attrs = '') => `<select name="timing_date" class="form_field is-select"${attrs}><option value="">Select one...</option></select>`;

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser.close(); });

async function open(field, draft) {
  const context = await browser.newContext();
  await context.clock.setFixedTime(new Date(2026, 9, 16, 12));
  if (draft) await context.addInitScript(d => sessionStorage.setItem('oa-brief', d), JSON.stringify(draft));
  await context.route('**/*', route => route.request().url().startsWith('http://oa.test/')
    ? route.fulfill({ contentType: 'text/html', body: PAGE.replace(INPUT, () => field).replace('</body>', () => `<script>${SCRIPT}</script></body>`) })
    : route.abort());
  const page = await context.newPage();
  await page.goto('http://oa.test/contact');
  const options = () => page.$$eval('select[name="timing_date"] option', os => os.map(o => ({ value: o.value, text: o.textContent, disabled: o.disabled })));
  return { page, context, options };
}

test('the select lists a placeholder, then 24 months from next month', async () => {
  const { context, options } = await open(SELECT());
  const os = await options();
  assert.equal(os.length, 25);
  assert.deepEqual(os[0], { value: '', text: 'Choose a month', disabled: true });
  assert.deepEqual(os[1], { value: '2026-11', text: 'November 2026', disabled: false });
  assert.deepEqual(os[3], { value: '2027-01', text: 'January 2027', disabled: false });
  assert.deepEqual(os[24], { value: '2028-10', text: 'October 2028', disabled: false });
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

test('the old month input is left alone until the Designer swap', async () => {
  const { page, context } = await open('<input name="timing_date" type="month" class="form_field" value="">');
  assert.equal(await page.$eval('[name="timing_date"]', e => e.tagName), 'INPUT');
  await context.close();
});
