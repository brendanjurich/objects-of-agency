// Designer hook contract check — every page whose script reads hooks set in the Webflow
// Designer. Restyling can silently break a hook: a renamed Form Input prop changes a
// `name`, hiding an element drops it from the published markup, a Rich Text paste strips
// custom attributes. Each page's hooks are a manifest in tools/contracts/.
//
// Run after any Designer change, before and after publishing:
//   node tools/contract.mjs [page|all] [url]      page: contact, saved-items, product, legal
//   node tools/contract.mjs <page> --capture      also rewrites tests/fixtures/contract/<page>.html
// Every page also fails on Webflow placeholder text (an MCP-built Text Block keeps it unless its
// String child is set); inside a w-condition-invisible block it is a note, since that copy only
// shows on other CMS items.
// Exits non-zero and lists exactly which hooks a script can no longer find. Reads the
// served HTML only (no browser), so hooks a script adds at runtime are out of reach.
// Dev-only; nothing here is served. tests/contract.test.mjs runs it against captures.

import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';

export const PAGES = ['contact', 'saved-items', 'product', 'legal'];

const PLACEHOLDER = /^(This is some text inside of a div block\.?|Button Text|Heading|Lorem ipsum.*)$/;
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'use', 'stop']);

// Webflow placeholder copy in text nodes, split by whether a w-condition-invisible ancestor hides it.
export function placeholders(html) {
  const shown = [], hidden = [];
  const stack = [];
  const body = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  const re = /<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(body))) {
    if (m[5] !== undefined) {
      const t = m[5].trim();
      if (t && PLACEHOLDER.test(t)) (stack.some(e => e.inv) ? hidden : shown).push(t);
      continue;
    }
    const tag = m[2].toLowerCase();
    if (m[1]) { const i = stack.map(e => e.tag).lastIndexOf(tag); if (i >= 0) stack.length = i; continue; }
    if (m[4] || VOID.has(tag)) continue;
    stack.push({ tag, inv: /\bclass="[^"]*\bw-condition-invisible\b/.test(m[3]) });
  }
  return { shown, hidden };
}

export function capture(page, url, html) {
  const out = html.replace(/(<script\b(?![^>]*\bsrc=)[^>]*>)[\s\S]*?(<\/script>)/g, '$1$2').replace(/(<style\b[^>]*>)[\s\S]*?(<\/style>)/g, '$1$2');
  const d = new Date(), date = [d.getDate(), d.getMonth() + 1].map(n => String(n).padStart(2, '0')).join('-') + '-' + d.getFullYear();
  const file = new URL(`../tests/fixtures/contract/${page}.html`, import.meta.url);
  writeFileSync(file, `<!-- captured from ${url} on ${date}; inline script/style bodies removed -->\n` + out);
  return fileURLToPath(file);
}

export async function loadManifest(page) {
  return (await import(`./contracts/${page}.mjs`)).default;
}

// { ok, fail, notes, tags } for one page's served HTML. A manifest has:
//   url        default (staging) URL
//   engines    { 'oa-brief.js': 190 } — each script must load at or above that tag
//   attrs      [[label, attribute]] that must appear in the served DOM
//   pending    [[label, attribute]] a tagged script reads before the Designer has it: absent is a
//              note, present fails until it moves to attrs (and engines is bumped), so the commit
//              that recaptures the fixture promotes it
//   single     [attribute] read with querySelector: anything but exactly one in the DOM fails, so a
//              Designer duplicate carrying the hook along can't take the script's read
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

  const tags = [...new Set([...html.matchAll(/objects-of-agency@(v1\.0\.\d+|[0-9a-f]{40})\/src\/((?:js|css)\/[a-z-]+\.(?:js|css))/g)].map(m => m[2] + ' @' + m[1]))].sort();
  for (const [file, min] of Object.entries(manifest.engines || {})) {
    const at = (html.match(new RegExp('objects-of-agency@([^/]+)/src/js/' + file.replace('.', '\\.'))) || [])[1] || '';
    const ver = Number((at.match(/^v1\.0\.(\d+)$/) || [])[1] || 0);
    // A commit-SHA URL (the documented unblock for a cached tag 404) can't be compared
    if (/^[0-9a-f]{40}$/.test(at)) { check(`${file} >= v1.0.${min}`, true, 'pinned to commit ' + at.slice(0, 7) + ', tag not compared'); continue; }
    check(`${file} >= v1.0.${min}`, ver >= min, ver ? 'page loads v1.0.' + ver : at ? 'page loads @' + at : 'not loaded');
  }
  for (const [label, attr] of manifest.attrs || [])
    check(label, has(new RegExp(attr + '="')), has(new RegExp(attr + '="')) ? '' : `[${attr}] ABSENT from served DOM`);
  for (const [label, attr] of manifest.pending || []) {
    if (has(new RegExp(attr + '="'))) check(label + ' (pending)', false, `[${attr}] is published: move it to attrs and bump engines`);
    else note(`pending, not in the Designer yet: ${label} [${attr}]`);
  }
  for (const attr of manifest.single || []) {
    const n = count(new RegExp(attr + '="', 'g'));
    check(`[${attr}] exactly once`, n === 1, n === 1 ? '' : n + ' found');
  }
  for (const n of manifest.inputs || [])
    check('input name="' + n + '"', names.has(n), names.has(n) ? '' : 'ABSENT from served DOM');
  const ph = placeholders(html);
  check('no Webflow placeholder text', !ph.shown.length, ph.shown.length ? [...new Set(ph.shown)].map(t => '"' + t + '"').join(', ') : '');
  if (ph.hidden.length) note('placeholder text inside w-condition-invisible (shows on other CMS items): ' + [...new Set(ph.hidden)].map(t => '"' + t + '"').join(', '));
  if (manifest.checks) await manifest.checks(html, { has, count, names, check, note, css });
  return { ok, fail, notes, tags };
}

export async function main() {
  const args = process.argv.slice(2);
  const save = args.includes('--capture');
  const [arg = 'all', url] = args.filter(a => a !== '--capture');
  const pages = arg === 'all' ? PAGES : [arg];
  if (!pages.every(p => PAGES.includes(p))) {
    console.error('usage: node tools/contract.mjs [' + PAGES.join('|') + '|all] [url] [--capture]');
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
    if (save) console.log('  captured → ' + capture(page, target, html));
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
