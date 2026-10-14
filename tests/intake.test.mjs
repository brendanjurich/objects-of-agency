// The intake chain (supabase/functions/_shared/intake.ts) with the real brief and saved-list
// definitions, and fakes for Turnstile, the rate limiter, the database and Resend. Asserts
// only what's visible from outside: the response, what was stored, what was mailed.
//   node --test tests/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { intake } from '../supabase/functions/_shared/intake.ts';
import { brief } from '../supabase/functions/brief-intake/brief.ts';
import { selection } from '../supabase/functions/selection-intake/selection.ts';
import { parseItems } from '../supabase/functions/_shared/items.ts';

const ORIGIN = 'https://oa-v5.webflow.io';
const NOW = 1_800_000_000_000;
const ITEM = { slug: 'viewfinder-cr', name: 'ViewFinder CR', options: { Sizes: '700mm-diameter' }, labels: { Sizes: '700mm Diameter' }, qty: 2 };

const BRIEF = { audience: 'client', after: ['seen'], email: 'ann@studio.com.au', name: 'Ann Lee', project: 'Smith Residence',
  pieces: ['ViewFinder CR'], items: [ITEM], note: 'Corner of a dining room', started_at: NOW - 60_000, turnstile: 'tok' };
const LIST = { email: 'ann@studio.com.au', project: 'Smith Residence', items: [ITEM], origin_url: ORIGIN + '/saved-items',
  started_at: NOW - 60_000, turnstile: 'tok' };

// One run: a handler built from the definition and fakes, and a record of what it did.
function run(which, body, { turnstile = 'ok', limit = true, sendThrows = false, storeThrows = false, origin = ORIGIN, method = 'POST', raw, headers = {} } = {}) {
  const seen = { stored: [], mail: [], limited: [] };
  const insert = async row => {
    if (storeThrows) throw new Error('db down');
    seen.stored.push(row);
    return { id: 'row-1', ref: row.ref };
  };
  const definition = which === 'brief' ? brief({ insert }) : selection({ insert, share: async () => 'smith-residence-k3f9x2' });
  const handler = intake(definition, {
    turnstile: async () => turnstile,
    underLimit: async (name, email, ip) => {
      seen.limited.push({ name, email, ip });
      if (limit === 'throw') throw new Error('counter down');
      return limit;
    },
    send: async m => { if (sendThrows) throw new Error('resend down'); seen.mail.push(m); },
    now: () => NOW,
  });
  const text = raw ?? JSON.stringify(body);
  const req = new Request('https://fn.test/', {
    method, headers: { origin, 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.9', ...headers },
    body: method === 'POST' || method === 'PUT' ? text : undefined,
  });
  return handler(req).then(async res => ({ status: res.status, body: await res.text().then(t => { try { return JSON.parse(t); } catch { return t; } }), res, ...seen }));
}

test('a brief stores once and mails the studio and the visitor', async () => {
  const r = await run('brief', BRIEF);
  assert.equal(r.status, 200);
  assert.match(r.body.ref, /^OA-[0-9A-F]{6}$/);
  assert.equal(r.stored.length, 1);
  assert.equal(r.stored[0].ref, r.body.ref);
  assert.deepEqual(r.stored[0].items, parseItems([ITEM]));
  assert.deepEqual(r.mail.map(m => m.to).sort(), ['ann@studio.com.au', 'hello@objects.agency']);
  assert.deepEqual(r.limited, [{ name: 'brief', email: 'ann@studio.com.au', ip: '203.0.113.9' }]);
  assert.equal(r.res.headers.get('access-control-allow-origin'), ORIGIN);
});

test('a saved list stores once, mails both, and the visitor gets the short link', async () => {
  const r = await run('selection', LIST);
  assert.equal(r.status, 200);
  assert.match(r.body.ref, /^SL-[0-9A-F]{6}$/);
  assert.equal(r.stored.length, 1);
  assert.equal(r.stored[0].origin_url, ORIGIN + '/saved-items');
  const visitor = r.mail.find(m => m.to === 'ann@studio.com.au');
  assert.match(visitor.text, /https:\/\/oa-v5\.webflow\.io\/saved-items\?l=smith-residence-k3f9x2/);
  assert.equal(r.limited[0].name, 'selection');
});

test('an origin off the allowlist is refused before anything else', async () => {
  const r = await run('brief', BRIEF, { origin: 'https://evil.example' });
  assert.equal(r.status, 403);
  assert.deepEqual([r.stored.length, r.mail.length], [0, 0]);
});

test('preflight answers 204 with CORS; other methods 405', async () => {
  const pre = await run('brief', null, { method: 'OPTIONS' });
  assert.equal(pre.status, 204);
  assert.equal(pre.res.headers.get('access-control-allow-methods'), 'POST, OPTIONS');
  assert.equal((await run('brief', null, { method: 'GET' })).status, 405);
});

test('an oversized body is 413, malformed JSON 400', async () => {
  assert.equal((await run('brief', BRIEF, { headers: { 'content-length': '40000' } })).status, 413);
  const bad = await run('brief', null, { raw: '{nope' });
  assert.deepEqual([bad.status, bad.body.error], [400, 'json']);
});

test('a filled honeypot is logged, never a drop', async () => {
  const r = await run('brief', { ...BRIEF, website: 'https://annlee.com' });
  assert.equal(r.status, 200);
  assert.equal(r.stored.length, 1);
});

test('a send faster than the minimum time gets a fake success: no store, no mail', async () => {
  for (const which of ['brief', 'selection']) {
    const r = await run(which, { ...(which === 'brief' ? BRIEF : LIST), started_at: NOW - 1000 });
    assert.equal(r.status, 200);
    assert.ok(r.body.ref);
    assert.deepEqual([r.stored.length, r.mail.length, r.limited.length], [0, 0, 0]);
  }
});

test('Turnstile: unset secret fails closed (503), a failed check is 403', async () => {
  const unset = await run('brief', BRIEF, { turnstile: 'unset' });
  assert.deepEqual([unset.status, unset.body.error, unset.stored.length], [503, 'config', 0]);
  const fail = await run('selection', LIST, { turnstile: 'fail' });
  assert.deepEqual([fail.status, fail.body.error, fail.stored.length], [403, 'verification', 0]);
});

test('field errors name the field; anything else is "fields"', async () => {
  assert.equal((await run('brief', { ...BRIEF, audience: 'nobody' })).body.error, 'audience');
  assert.equal((await run('brief', { ...BRIEF, email: 'not-an-email' })).body.error, 'email');
  assert.equal((await run('brief', { ...BRIEF, name: 'Ann\nLee' })).body.error, 'fields');
  assert.equal((await run('brief', { ...BRIEF, items: [{ ...ITEM, price: 12500 }] })).body.error, 'fields');
  assert.equal((await run('selection', { ...LIST, email: '' })).body.error, 'email');
  assert.equal((await run('selection', { ...LIST, items: [] })).body.error, 'items');
  assert.equal((await run('selection', { ...LIST, origin_url: 'https://evil.example/saved-items' })).body.error, 'fields');
});

test('"just looking" needs no email, and is only mailed to the studio', async () => {
  const r = await run('brief', { ...BRIEF, audience: 'looking', email: '' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.mail.map(m => m.to), ['hello@objects.agency']);
  assert.equal(r.limited[0].email, null);
});

test('a link in echoed text is 400; a link only in the brief note goes through, kept for the studio only', async () => {
  for (const [which, body] of [['brief', { ...BRIEF, name: 'Ann www.evil.com' }], ['brief', { ...BRIEF, project: 'evil.com' }],
    ['brief', { ...BRIEF, items: [{ ...ITEM, name: 'Click evil.com' }] }], ['selection', { ...LIST, project: 'see evil.com' }]]) {
    const r = await run(which, body);
    assert.deepEqual([r.status, r.body.error, r.stored.length], [400, 'link', 0]);
  }
  const r = await run('brief', { ...BRIEF, note: 'Plans at https://dropbox.com/x' });
  assert.equal(r.status, 200);
  assert.match(r.mail.find(m => m.to === 'hello@objects.agency').text, /dropbox\.com/);
  assert.doesNotMatch(r.mail.find(m => m.to === 'ann@studio.com.au').text, /dropbox\.com/);
});

test('over the rate limit is an honest 429, never a silent "Sent"', async () => {
  const r = await run('selection', LIST, { limit: false });
  assert.deepEqual([r.status, r.body.error, r.stored.length, r.mail.length], [429, 'limit', 0, 0]);
});

test('a broken rate counter lets the send through', async () => {
  const r = await run('brief', BRIEF, { limit: 'throw' });
  assert.equal(r.status, 200);
  assert.equal(r.stored.length, 1);
});

test('a store failure is 500 and sends no mail', async () => {
  const r = await run('brief', BRIEF, { storeThrows: true });
  assert.deepEqual([r.status, r.body.error, r.mail.length], [500, 'store', 0]);
});

test('a mail outage never fails a stored request', async () => {
  const r = await run('brief', BRIEF, { sendThrows: true });
  assert.equal(r.status, 200);
  assert.equal(r.stored.length, 1);
});

test('the item validator rejects unknown keys and a price, and caps the list at 12', () => {
  assert.throws(() => parseItems([{ ...ITEM, price: 1 }]));
  assert.throws(() => parseItems([{ ...ITEM, options: { Colour: 'red' } }]));
  assert.throws(() => parseItems(Array(13).fill(ITEM)));
  assert.equal(parseItems(Array(12).fill(ITEM)).length, 12);
});
