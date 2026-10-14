// Designer hook contract check — every page whose script reads hooks set in the Webflow
// Designer. Restyling can silently break a hook: a renamed Form Input prop changes a
// `name`, hiding an element drops it from the published markup, a Rich Text paste strips
// custom attributes. Each page's hooks are a manifest in tools/contracts/.
//
// Run after any Designer change, before and after publishing:
//   node tools/contract.mjs [page|all] [url]      page: contact, saved-items, product, legal
// Exits non-zero and lists exactly which hooks a script can no longer find. Reads the
// served HTML only (no browser), so hooks a script adds at runtime are out of reach.
// Dev-only; nothing here is served. tests/contract.test.mjs runs it against captures.

import { fileURLToPath } from 'node:url';

export const PAGES = ['contact', 'saved-items', 'product', 'legal'];

export async function loadManifest(page) {
  return (await import(`./contracts/${page}.mjs`)).default;
}

// { ok, fail, notes, tags } for one page's served HTML. A manifest has:
//   url        default (staging) URL
//   engines    { 'oa-brief.js': 190 } — each script must load at or above that tag
//   attrs      [[label, attribute]] that must appear in the served DOM
//   inputs     input/textarea names a script reads
//   checks     (html, ctx) => void, page-specific; ctx = { has, count, names, check, note, css }
export async function checkPage(manifest, html, { css = false } = {}) {
  const ok = [];
  const fail = [];
  const notes = [];
  const has = re => re.test(html);
  const count = re => (html.match(re) || []).length;
  const names = new Set([...html.matchAll(/<(?:input|textarea|select)[^>]*\bname="([^"]+)"/g)].map(m => m[1]));
  const check = (label, cond, detail = '') => (cond ? ok : fail).push(label + (detail ? ' — ' + detail : ''));
  const note = text => notes.push(text);

  const tags = [...new Set([...html.matchAll(/objects-of-agency@(v1\.0\.\d+)\/src\/((?:js|css)\/[a-z-]+\.(?:js|css))/g)].map(m => m[2] + ' @' + m[1]))].sort();
  for (const [file, min] of Object.entries(manifest.engines || {})) {
    const ver = Number(((html.match(new RegExp('v1\\.0\\.(\\d+)/src/js/' + file.replace('.', '\\.'))) || [])[1]) || 0);
    check(`${file} >= v1.0.${min}`, ver >= min, ver ? 'page loads v1.0.' + ver : 'not loaded');
  }
  for (const [label, attr] of manifest.attrs || [])
    check(label, has(new RegExp(attr + '="')), has(new RegExp(attr + '="')) ? '' : `[${attr}] ABSENT from served DOM`);
  for (const n of manifest.inputs || [])
    check('input name="' + n + '"', names.has(n), names.has(n) ? '' : 'ABSENT from served DOM');
  if (manifest.checks) await manifest.checks(html, { has, count, names, check, note, css });
  return { ok, fail, notes, tags };
}

export async function main() {
  const [arg = 'all', url] = process.argv.slice(2);
  const pages = arg === 'all' ? PAGES : [arg];
  if (!pages.every(p => PAGES.includes(p))) {
    console.error('usage: node tools/contract.mjs [' + PAGES.join('|') + '|all] [url]');
    process.exit(2);
  }
  let failed = 0;
  for (const page of pages) {
    const manifest = await loadManifest(page);
    const target = url || manifest.url;
    const html = await (await fetch(target + (target.includes('?') ? '&' : '?') + '_=' + Date.now())).text();
    const r = await checkPage(manifest, html, { css: true });
    failed += r.fail.length;
    console.log(`\n== ${page}  ${target}`);
    r.tags.forEach(t => console.log('  tag  ' + t));
    r.notes.forEach(n => console.log('  note ' + n));
    console.log('PASS (' + r.ok.length + ')');
    r.ok.forEach(l => console.log('  ok   ' + l));
    console.log('FAIL (' + r.fail.length + ')');
    r.fail.forEach(l => console.log('  FAIL ' + l));
  }
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
