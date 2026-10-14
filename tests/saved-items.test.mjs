// Saved configuration module (oa-saved-items.js), driven through window.oaSaved in a real
// browser. Pages are fixtures served at http://oa.test, so location.pathname matches the
// site's (/product/{slug}, /saved-items, /contact); the script is the raw repo file.
//   node --test tests/

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { compact, GROUPS } from '../supabase/functions/_shared/items.ts';

const SCRIPT = readFileSync(new URL('../src/js/oa-saved-items.js', import.meta.url), 'utf8');
const SHARE = 'https://nleekoypvxoagnwiqtzz.supabase.co/functions/v1/share-list';

const PRODUCT = `
  <h1 class="config_title">ViewFinder CR</h1>
  <div class="configure_price">A$12,500</div>
  <ul>
    <li data-option="700mm-diameter"><input type="radio" name="Sizes" checked></li>
    <li data-option="900mm-diameter"><input type="radio" name="Sizes"></li>
    <li data-option="oak"><input type="radio" name="Timber" checked></li>
  </ul>
  <div class="w-condition-invisible">
    <li data-option="stone"><input type="radio" name="Top-Material" checked></li>
  </div>
  <span id="summary-size">700mm Diameter</span>
  <span id="summary-timber">Oak</span>
  <span id="summary-top-material">Stone</span>
  <a data-oa-save href="#"><span class="button_main_text">Save</span></a>
  <div data-oa-create-brief><a href="/contact">Create brief</a></div>
  <div data-oa-saved-count><span></span></div>`;

const ROW = slug => `
  <div data-oa-saved-row>
    <a href="/product/${slug}">View</a>
    <span data-oa-saved-name>${slug === 'viewfinder-cr' ? 'ViewFinder CR' : 'Vesper Bed'}</span>
    ${GROUPS.map(g => `<p><span data-oa-saved-line="${g}"></span></p>`).join('')}
    <span data-oa-saved-qty-value></span>
  </div>`;
const SAVED_PAGE = `<div data-oa-saved-wrap>${ROW('viewfinder-cr')}${ROW('vesper-bed')}</div><div data-oa-saved-empty></div>`;

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser.close(); });

// A fresh context per test: its own localStorage, nothing carried over.
async function open(path, body = '', { init, share } = {}) {
  const context = await browser.newContext();
  if (init) await context.addInitScript(init);
  await context.route('http://oa.test/**', route => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><body>${body}<script>${SCRIPT}</script></body>`,
  }));
  await context.route(SHARE + '**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(share) }));
  const page = await context.newPage();
  await page.goto('http://oa.test' + path);
  page.goTo = p => page.goto("http://oa.test" + p);
  return { page, context, body };
}

const seed = list => `localStorage.setItem('oa-saved-items:v1', ${JSON.stringify(JSON.stringify(list))})`;
const lines = page => page.$$eval('[data-oa-saved-rendered]', rows => rows.map(r =>
  Object.fromEntries([...r.querySelectorAll('[data-oa-saved-line]')].map(el => [el.dataset.oaSavedLine, el.textContent]))));
const b64url = s => Buffer.from(s).toString('base64url');

test('current() reads the visible configuration, never a hidden section or the price', async () => {
  const { page, context } = await open('/product/viewfinder-cr', PRODUCT);
  assert.deepEqual(await page.evaluate(() => window.oaSaved.current()), {
    slug: 'viewfinder-cr',
    options: { Sizes: '700mm-diameter', Timber: 'oak' },
    labels: { Sizes: '700mm Diameter', Timber: 'Oak' },
  });
  await context.close();
});

test('current() is null off a product page', async () => {
  const { page, context } = await open('/contact');
  assert.equal(await page.evaluate(() => window.oaSaved.current()), null);
  await context.close();
});

test("forRequest('saved') returns the project and named entries in the items[] shape, no price", async () => {
  const { page, context } = await open('/contact', '', { init: seed({ v: 1, project: 'Smith Residence', sharePrice: true, items: [
    { slug: 'viewfinder-cr', name: 'ViewFinder CR', options: { Sizes: '700mm-diameter' }, labels: { Sizes: '700mm Diameter', Timber: '' }, price: 12500, qty: 2, savedAt: 1 },
    { slug: 'vesper-bed', options: {}, labels: {}, qty: 1 },
  ] }) });
  assert.deepEqual(await page.evaluate(() => window.oaSaved.forRequest('saved')), {
    project: 'Smith Residence',
    items: [{ slug: 'viewfinder-cr', name: 'ViewFinder CR', options: { Sizes: '700mm-diameter' }, labels: { Sizes: '700mm Diameter' }, qty: 2 }],
  });
  await context.close();
});

test("Create brief hands the product page's configuration to forRequest('product')", async () => {
  const { page, context } = await open('/product/viewfinder-cr', PRODUCT);
  await page.evaluate(() => document.querySelector('[data-oa-create-brief] a').addEventListener('click', e => e.preventDefault()));
  await page.click('[data-oa-create-brief] a');
  await page.goTo('/contact');
  assert.deepEqual(await page.evaluate(() => window.oaSaved.forRequest('product')), {
    project: '',
    items: [{ slug: 'viewfinder-cr', name: 'ViewFinder CR', options: { Sizes: '700mm-diameter', Timber: 'oak' }, labels: { Sizes: '700mm Diameter', Timber: 'Oak' }, qty: 1 }],
  });
  await context.close();
});

test("forRequest('product') is empty with nothing handed over", async () => {
  const { page, context } = await open('/contact');
  assert.deepEqual(await page.evaluate(() => window.oaSaved.forRequest('product')), { project: '', items: [] });
  await context.close();
});

test('sameConfig() ignores option order and name, and tells configurations apart', async () => {
  const { page, context } = await open('/contact');
  const r = await page.evaluate(() => {
    const a = { slug: 'viewfinder-cr', options: { Sizes: '700mm-diameter', Timber: 'oak' } };
    return [
      window.oaSaved.sameConfig(a, { slug: 'viewfinder-cr', name: 'x', options: { Timber: 'oak', Sizes: '700mm-diameter' } }),
      window.oaSaved.sameConfig(a, { slug: 'viewfinder-cr', options: { Sizes: '900mm-diameter', Timber: 'oak' } }),
      window.oaSaved.sameConfig(a, { slug: 'viewfinder-xen', options: a.options }),
    ];
  });
  assert.deepEqual(r, [true, false, false]);
  await context.close();
});

test('editHref() and parseCfg() round-trip; parseCfg drops unknown groups and bad slugs', async () => {
  const { page, context } = await open('/contact');
  const r = await page.evaluate(() => {
    const href = window.oaSaved.editHref({ slug: 'viewfinder-cr', options: { Sizes: '700mm-diameter', Timber: 'oak' } });
    return [href, window.oaSaved.parseCfg(new URL(href, location.origin).search),
      window.oaSaved.parseCfg('?cfg=Colour:red,Sizes:BAD SLUG,Timber:oak'), window.oaSaved.parseCfg('')];
  });
  assert.deepEqual(r, ['/product/viewfinder-cr?cfg=Sizes:700mm-diameter,Timber:oak',
    { Sizes: '700mm-diameter', Timber: 'oak' }, { Timber: 'oak' }, {}]);
  await context.close();
});

test('Save keeps working for the visit when storage throws', async () => {
  const { page, context } = await open('/product/viewfinder-cr', PRODUCT, { init: () => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });
  } });
  await page.click('[data-oa-save]');
  assert.equal(await page.textContent('[data-oa-saved-count] span'), '1');
  assert.equal(await page.textContent('[data-oa-save] .button_main_text'), 'Saved');
  await context.close();
});

test('option-group order is pinned: share links encode a group by its index', () => {
  assert.deepEqual(GROUPS, ['Sizes', 'Top-Material', 'Timber', 'Anodised-Finish']);
});

const ITEMS = [
  { slug: 'viewfinder-cr', name: 'ViewFinder CR', qty: 2,
    options: { Sizes: '700mm-diameter', 'Top-Material': 'stone', Timber: 'oak', 'Anodised-Finish': 'bronze' },
    labels: { Sizes: '700mm Diameter', 'Top-Material': 'Stone', Timber: 'Oak', 'Anodised-Finish': 'Bronze' } },
  { slug: 'vesper-bed', name: 'Vesper Bed', qty: 1, options: { Timber: 'walnut' }, labels: { Timber: 'Walnut' } },
];
const EXPECTED = [
  { Sizes: '700mm Diameter', 'Top-Material': 'Stone', Timber: 'Oak', 'Anodised-Finish': 'Bronze' },
  { Sizes: '', 'Top-Material': '', Timber: 'Walnut', 'Anodised-Finish': '' },
];

test("a short link the server encoded (compact) decodes to the same options on the page", async () => {
  const { page, context } = await open('/saved-items?l=smith-residence-k3f9x2', SAVED_PAGE, { share: compact('Smith Residence', ITEMS) });
  await page.waitForSelector('html.oa-saved-ready');
  assert.deepEqual(await lines(page), EXPECTED);
  await context.close();
});

test('an old ?s= link (captured format, with prices) still decodes', async () => {
  // A pre-short-link ?s= payload, as oa-saved-items.js wrote it: prices on.
  const old = '{"v":1,"p":"Smith Residence","$":1,"i":[["viewfinder-cr",2,[[0,"700mm-diameter","700mm Diameter"],[1,"stone","Stone"],[2,"oak","Oak"],[3,"bronze","Bronze"]],12500],["vesper-bed",1,[[2,"walnut","Walnut"]]]]}';
  const { page, context } = await open('/saved-items?s=' + b64url(old), SAVED_PAGE);
  assert.deepEqual(await lines(page), EXPECTED);
  await context.close();
});
