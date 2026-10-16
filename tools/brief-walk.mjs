// Brief piece-drawer walk on staging: answers the brief up to the piece step, opens the drawer
// and drives it the way a visitor does, printing one JSON line of observations. Dev-only.
//   node tools/brief-walk.mjs [chromium|webkit] [width] [height] [--local]
//     --local  serves this checkout's src/js/oa-brief.js and src/css/oa-brief.css in place of
//              the tagged files, so a change can be walked before it is tagged
// Run each release in both browsers at 1440×900 and 390×844 and read the JSON for: l1 (the
// category rows, in map order), focus after each step, done ("Done · 1"), the shared tick
// (nestedPressed, ocPressed "true"), the edge strip closing two levels, colours
// (rest/hover/selected/unselected = text / tick stroke / tick opacity / aria-pressed), errors.
// Gotchas it already handles: the who step advances on its own once a radio is picked; a radio
// input sits over its label text (click with force); Continue is a component wrapper (click
// the button inside it).
import { chromium, webkit } from 'playwright';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const local = args.includes('--local');
const [bname = 'chromium', w = '1440', h = '900'] = args.filter(a => a !== '--local');
const D = 'data-oa-brief-drawer';

const browser = await { chromium, webkit }[bname].launch();
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
if (local) await page.route(/objects-of-agency@[^/]+\/src\/(js|css)\/oa-brief\.(js|css)/, r => {
  const f = r.request().url().endsWith('.js') ? 'src/js/oa-brief.js' : 'src/css/oa-brief.css';
  r.fulfill({ body: readFileSync(new URL('../' + f, import.meta.url), 'utf8'), contentType: f.endsWith('.js') ? 'application/javascript' : 'text/css' });
});
await page.goto('https://oa-v5.webflow.io/contact?_=' + Date.now(), { waitUntil: 'load' });
await page.waitForTimeout(2500);

// ---- walk to the piece step
const step = () => page.evaluate(() => {
  const s = [...document.querySelectorAll('[data-oa-brief-step]')].find(e => !e.hidden && e.getClientRects().length);
  return s && s.getAttribute('data-oa-brief-step');
});
const steps = [];
for (let i = 0; i < 6; i++) {
  const st = await step(); steps.push(st);
  if (st === 'piece') break;
  if (st === 'who') await page.getByText("I'm specifying for a client", { exact: true }).first().click({ force: true });
  if (st === 'what') await page.getByText("A piece you've seen", { exact: true }).first().click({ force: true });
  await page.waitForTimeout(1200);
  if (await step() === st) {
    await page.locator('[data-oa-brief-next] button, [data-oa-brief-next] a').filter({ visible: true }).first().click({ force: true });
    await page.waitForTimeout(1200);
  }
}

// ---- drive the drawer
const focus = () => page.evaluate(() => { const a = document.activeElement; return (a.getAttribute('aria-label') || a.textContent).trim().replace(/\s+/g, ' ').slice(0, 30); });
const sheetOf = label => page.evaluate(([D, label]) => { const b = [...document.querySelectorAll('[' + D + '] [aria-controls]')].find(b => b.textContent.trim() === label); return b && b.getAttribute('aria-controls'); }, [D, label]);
const visible = id => page.evaluate(id => { const el = document.getElementById(id); return !!el && getComputedStyle(el).visibility === 'visible'; }, id);
const btn = name => page.getByRole('button', { name, exact: true });
const wait = ms => page.waitForTimeout(ms);
const out = { browser: bname, width: +w, local, src: await page.evaluate(() => ([...document.scripts].map(s => s.src).find(s => /oa-brief\.js/.test(s)) || '').match(/@[^/]+/)?.[0]), steps };

await page.locator('[data-oa-brief-piece-open] button, [data-oa-brief-piece-open]').filter({ visible: true }).first().click();
await wait(900);
out.l1 = await page.evaluate(D => [...document.querySelectorAll('[' + D + '-list="categories"] > *')].map(r => r.textContent.trim()), D);
out.focusOpen = await focus();
await btn('Tables').click(); await wait(800); out.focusTables = await focus();
await btn('Coffee').click(); await wait(800); out.focusCoffee = await focus();
out.backLabel = await page.evaluate(([D, id]) => document.getElementById(id).querySelector('[' + D + '-back]').textContent.trim(), [D, await sheetOf('Coffee')]);
await btn('ViewFinder Noir Nest').click(); await wait(200);
out.done = (await page.locator('[' + D + '-done-text]').textContent()).trim();
await page.keyboard.press('Escape'); await wait(800);
out.escFocus = await focus();
out.coffeeClosed = !(await visible(await sheetOf('Coffee')));
await btn('Nested').click(); await wait(800);
out.nestedPressed = await page.locator(`#${await sheetOf('Nested')} [${D}-pick="ViewFinder Noir Nest"]`).getAttribute('aria-pressed');
await page.locator(`[${D}-panel] > [${D}-edge]`).click(); await wait(900);
out.stripFocus = await focus();
out.tablesClosed = !(await visible(await sheetOf('Tables')));
await btn('Office & Commercial').click(); await wait(800);
out.ocPressed = await page.locator(`#${await sheetOf('Office & Commercial')} [${D}-pick="ViewFinder Noir Nest"]`).getAttribute('aria-pressed');
await page.keyboard.press('Escape'); await wait(800);

// ---- row colours: Seat 1 at rest, hovered, selected, un-selected (pointer moved off each time)
await btn('Seating').click(); await wait(800);
const row = btn('Seat 1');
const colour = () => row.evaluate(b => [getComputedStyle(b.querySelector('[data-oa-brief-drawer-text]') || b).color,
  getComputedStyle(b.querySelector('.u-path') || b).stroke, getComputedStyle(b.querySelector('[aria-hidden="true"]') || b).opacity, b.getAttribute('aria-pressed')].join(' / '));
const off = async () => { await page.mouse.move(2, 2); await wait(400); };
out.colours = { rest: await colour() };
await row.hover(); await wait(400); out.colours.hover = await colour();
await row.click(); await off(); out.colours.selected = await colour();
await row.click(); await off(); out.colours.unselected = await colour();
await page.keyboard.press('Escape'); await wait(800);
await page.keyboard.press('Escape'); await wait(900);

out.closed = await page.evaluate(D => !document.querySelector('dialog[' + D + ']').open, D);
out.focusAfterClose = await focus();
out.tags = await page.evaluate(() => [...document.querySelectorAll('[data-oa-brief-pieces] [data-oa-brief-piece-name]')].map(e => e.textContent.trim()));
out.errors = errors;
console.log(JSON.stringify(out));
await browser.close();
