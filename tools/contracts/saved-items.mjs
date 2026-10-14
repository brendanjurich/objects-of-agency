// /saved-items — the Saved Items page (oa-saved-items.js). Hook list: the file's header.
// The config lines follow the option groups the share links encode, so a group added to
// GROUPS (items.ts) without its line in the row template fails here.

import { GROUPS } from '../../supabase/functions/_shared/items.ts';

// Hooks every row template must carry — the page renders each saved entry from a copy
const ROW = [
  ['piece name', 'data-oa-saved-name'], ['price', 'data-oa-saved-price'], ['price wrap', 'data-oa-saved-price-wrap'],
  ['quantity value', 'data-oa-saved-qty-value'], ['edit link', 'data-oa-saved-edit'], ['remove', 'data-oa-saved-remove'],
];

export default {
  url: 'https://oa-v5.webflow.io/saved-items',
  engines: { 'oa-saved-items.js': 250 },
  attrs: [
    ['row template', 'data-oa-saved-row'], ['nav count badge', 'data-oa-saved-count'],
    ['empty state', 'data-oa-saved-empty'], ['list section', 'data-oa-saved-wrap'],
    ['missing-pieces notice', 'data-oa-saved-missing'], ['project name input', 'data-oa-saved-project'],
    ['Create brief', 'data-oa-saved-brief'], ['Email me this list', 'data-oa-saved-email'], ['Share', 'data-oa-saved-share'],
    ['share-with-prices checkbox', 'data-oa-saved-share-price'],
    ['email input', 'data-oa-saved-email-input'], ['email send', 'data-oa-saved-email-send'],
    ['email status', 'data-oa-saved-email-status'], ['email honeypot', 'data-oa-saved-honeypot'],
    ['shared-link banner', 'data-oa-saved-shared'], ['Add to my saved items', 'data-oa-saved-import'],
    ...ROW,
  ],

  checks(html, { count, check }) {
    const rows = count(/data-oa-saved-row="/g);
    for (const [label, attr] of ROW) {
      const n = count(new RegExp(attr + '="', 'g'));
      check('every row has its ' + label, n >= rows, `${n} of ${rows} rows`);
    }
    for (const g of GROUPS) {
      const n = count(new RegExp(`data-oa-saved-line="${g}"`, 'g'));
      check(`every row has a ${g} line`, n >= rows, `${n} of ${rows} rows`);
    }
    for (const q of ['minus', 'plus']) {
      const n = count(new RegExp(`data-oa-saved-qty="${q}"`, 'g'));
      check(`every row has quantity ${q}`, n >= rows, `${n} of ${rows} rows`);
    }
    // The slug comes from the row's link to its product page
    check('every row links to /product/{slug}', count(/href="\/product\/[a-z0-9-]+"/g) >= rows);
    // Same autofill trap as the brief's honeypot (04-10-2026)
    const hp = (html.match(/<[^>]*data-oa-saved-honeypot[^>]*>(?:\s*<input[^>]*>)?/) || [''])[0];
    const hpName = (hp.match(/\bname="([^"]*)"/) || [])[1] || '';
    check('honeypot name autofill ignores', !/^(website|url|homepage|name|email|phone|tel|company|organi[sz]ation|address|fax)$/i.test(hpName), 'name="' + hpName + '"');
  },
};
