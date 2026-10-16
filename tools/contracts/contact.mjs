// /contact — the project brief (oa-brief.js). Every hook the engine reads, as it was in
// tools/brief-contract.mjs before the checker went per-page.

export default {
  url: 'https://oa-v5.webflow.io/contact',
  // v1.0.250: the brief reads saved configurations through window.oaSaved — both or neither.
  // v1.0.252: a piece tag paired with its Edit link in a wrapper is cloned whole.
  // v1.0.254: removing a tag drops its configurations; Create Brief's name survives the scramble.
  // v1.0.255: the image box grows to the open drawer level; the backdrop may sit in the box.
  // v1.0.256: backdrop fades to its Designer opacity; rows clear the Done bar; no ring on focused headings.
  // v1.0.257: the drawer goes category-first — map, branch row, list="categories", cat + tags slots.
  engines: { 'oa-brief.js': 257, 'oa-saved-items.js': 254 },
  attrs: [
    ['endpoint knob', 'data-oa-brief-endpoint'],
    // controls and regions
    ['Continue', 'data-oa-brief-next'], ['Back', 'data-oa-brief-back'],
    ['Send', 'data-oa-brief-send'], ['Done (looking)', 'data-oa-brief-finish'],
    ['progress', 'data-oa-brief-progress'], ['status live region', 'data-oa-brief-status'],
    ['email error', 'data-oa-brief-error'], ['summary target', 'data-oa-brief-summary'],
    ['piece tags', 'data-oa-brief-pieces'], ['piece drawer opener', 'data-oa-brief-piece-open'],
    ['sent heading', 'data-oa-brief-sent-heading'], ['sent body', 'data-oa-brief-sent-body'],
    ['ref line', 'data-oa-brief-ref-line'],
    // the piece drawer. Every part is a hook the engine walks; a missing one makes it
    // warn and skip, and the visitor has no way to name a piece.
    ['drawer <dialog>', 'data-oa-brief-drawer'], ['drawer backdrop', 'data-oa-brief-drawer-backdrop'],
    ['drawer panel', 'data-oa-brief-drawer-panel'], ['category list', 'data-oa-brief-drawer-list'],
    ['sheet template', 'data-oa-brief-drawer-sheet'], ['branch row template', 'data-oa-brief-drawer-branch-row'],
    ['category map', 'data-oa-brief-drawer-map'], ['map category', 'data-oa-brief-drawer-category'],
    ['map category label', 'data-oa-brief-drawer-label'],
    ['CMS item category slug (nested Categories list)', 'data-oa-brief-drawer-cat'],
    ['CMS item Filter Tags', 'data-oa-brief-drawer-tags'],
    ['piece row template', 'data-oa-brief-drawer-piece-row'], ['row text slot', 'data-oa-brief-drawer-text'],
    ['Done bar', 'data-oa-brief-drawer-done'], ['"Something else" row', 'data-oa-brief-drawer-other-toggle'],
    ['drawer anchor (the box it opens over)', 'data-oa-brief-drawer-anchor'],
    ['drawer image box (grows to the open level)', 'data-oa-brief-drawer-box'],
  ],
  inputs: ['audience', 'after', 'bespoke', 'setting', 'quantity', 'timing', 'timing_date', 'budget', 'materials', 'interest', 'note', 'email', 'practice'],

  async checks(html, { has, count, names, check, note, css }) {
    check('endpoint knob is an https URL', has(/data-oa-brief-endpoint="https:\/\//));
    check('exactly one [data-oa-brief] root', count(/data-oa-brief=""/g) === 1, count(/data-oa-brief=""/g) + ' found');

    // step pairs — every step id must appear twice (question + answers)
    const byStep = {};
    [...html.matchAll(/data-oa-brief-step="([a-z]+)"/g)].forEach(m => { byStep[m[1]] = (byStep[m[1]] || 0) + 1; });
    for (const id of ['who', 'looking', 'what', 'piece', 'bespoke', 'where', 'when', 'you', 'sent'])
      check('step pair: ' + id, byStep[id] === 2, (byStep[id] || 0) + ' block(s)');

    // Honeypot: must exist, and must not carry a name browser autofill recognises — a field
    // named "website" was filled from the visitor's contact card and real briefs were dropped
    // as spam (04-10-2026). autocomplete="off" does not stop autofill.
    const hp = (html.match(/<input[^>]*data-oa-brief-honeypot[^>]*>/) || html.match(/<input[^>]*class="brief_honeypot"[^>]*>/) || [''])[0];
    const hpOk = /data-oa-brief-honeypot/.test(hp);
    check('honeypot input [data-oa-brief-honeypot]', hpOk, hpOk ? '' : hp ? 'found by class only — add the attribute' : 'ABSENT');
    const hpName = (hp.match(/\bname="([^"]*)"/) || [])[1] || '';
    check('honeypot name autofill ignores', !/^(website|url|homepage|name|email|phone|tel|company|organi[sz]ation|address|fax)$/i.test(hpName), 'name="' + hpName + '"');

    // Name is one field or a first/last pair; the engine composes either into `name`.
    check('name field (name, or first_name + last_name)', names.has('name') || (names.has('first_name') && names.has('last_name')));

    // aria-hidden on the opener hides the only way to name a piece from a screen reader
    check('drawer opener not aria-hidden', !/<[^>]*aria-hidden="true"[^>]*data-oa-brief-piece-open|<[^>]*data-oa-brief-piece-open[^>]*aria-hidden="true"/.test(html));
    check('drawer root is a <dialog>', /<dialog[^>]*\sdata-oa-brief-drawer(?:="[^"]*")?[\s>]/.test(html), 'showModal() needs a real dialog');
    // Webflow turns a custom-tag button into a Link (<a>), which can't be disabled or pressed.
    check('drawer rows are real <button>s', !/<a[^>]*data-oa-brief-drawer-(?:pick|done|back|edge|other)/.test(html));
    // The CMS list is the catalogue. Unbound text slots publish empty, and the drawer has no series.
    const items = [...html.matchAll(/data-oa-brief-drawer-item="[\s\S]{0,400}?data-oa-brief-drawer-name="[^>]*>([^<]*)<[\s\S]{0,200}?data-oa-brief-drawer-series="[^>]*>([^<]*)</g)];
    check('CMS items carry a name and a series', items.length > 0 && items.every(m => m[1].trim() && m[2].trim()),
      items.length + ' item(s)' + (items.some(m => !m[1].trim() || !m[2].trim()) ? ', some unbound' : ''));
    check('Residential filtered out of the drawer', !items.some(m => m[2].trim() === 'Residential'));
    check('level-one list is list="categories"', has(/data-oa-brief-drawer-list="categories"/));
    // The map's keys must meet the CMS. A key no item carries is a renamed slug or tag until
    // proved otherwise (the live drawer just hides the row), so it fails; a branch staged empty
    // on purpose carries data-oa-brief-drawer-empty-ok on its map entry and is only noted.
    const slugs = new Set([...html.matchAll(/data-oa-brief-drawer-cat="[^"]*"[^>]*>([^<]*)</g)].map(m => m[1].trim()));
    const filterTags = new Set([...html.matchAll(/data-oa-brief-drawer-tags="[^"]*"[^>]*>([^<]*)</g)].flatMap(m => m[1].trim().toLowerCase().split(/\s+/)));
    const entries = attr => [...html.matchAll(new RegExp('<[^>]*data-oa-brief-drawer-' + attr + '="([^"]+)"[^>]*>', 'g'))]
      .map(m => ({ key: m[1].trim().toLowerCase(), emptyOk: /data-oa-brief-drawer-empty-ok/.test(m[0]) }));
    const mapCats = entries('category'), mapTypes = entries('type');
    check('map names at least one category', mapCats.length > 0, mapCats.length + ' found');
    // oa-brief.css colours rows by this class and swatch (docs/CHANGE-IMPACT.md).
    check('row class .piece-drawer_row_wrap present (oa-brief.css row colours)', /class="[^"]*\bpiece-drawer_row_wrap\b/.test(html));
    check('CMS items carry category slugs', slugs.size > 0, slugs.size + ' distinct');
    for (const [list, found, what] of [[mapCats, slugs, 'Categories slug'], [mapTypes, filterTags, 'Filter Tags']])
      for (const e of list) {
        if (found.has(e.key)) continue;
        const kind = list === mapCats ? 'category' : 'type';
        if (e.emptyOk) note(`map ${kind} "${e.key}" is empty (empty-ok) — no row`);
        else check(`map ${kind} "${e.key}" matches an item's ${what}`, false, 'renamed in the CMS? update the map key, or mark data-oa-brief-drawer-empty-ok');
      }

    // The piece tag has the same template rule, and the same silent failure: renderPieces()
    // clears [data-oa-brief-pieces] on every change, so a tag built and styled in the
    // Designer but never attribute-marked is wiped before anyone sees it.
    if (has(/data-oa-brief-pieces="/) && !has(/data-oa-brief-piece-tag="/))
      note('no [data-oa-brief-piece-tag] — engine generates a bare button.brief_tag; any Designer-built tag inside [data-oa-brief-pieces] is wiped unmarked');
    // Edit configuration (optional): it must sit in the same child of [data-oa-brief-pieces] as
    // the tag — inside it or beside it — or it is wiped with everything else on render.
    const tags = (html.match(/data-oa-brief-pieces="[\s\S]{0,8000}/) || [''])[0];
    if (!/data-oa-brief-piece-edit/.test(tags)) note('no [data-oa-brief-piece-edit] in the piece tags — no Edit configuration link');
    else check('Edit configuration link has a link inside', /data-oa-brief-piece-edit[\s\S]{0,1500}?<a /.test(tags));

    // sent-state elements must live inside the sent step, not another step
    const sentBlock = (html.match(/data-oa-brief-step="sent"[^>]*class="brief_answers_step"[\s\S]{0,4000}/) || [''])[0];
    check('sent body inside sent step', /data-oa-brief-sent-body/.test(sentBlock));
    check('ref line inside sent step', /data-oa-brief-ref-line/.test(sentBlock));

    // chip groups
    const chipGroups = [...html.matchAll(/data-oa-brief-chips="([a-z-]+)"/g)].map(m => m[1]);
    for (const g of ['audience', 'after', 'bespoke', 'setting-res', 'setting-com', 'quantity-where', 'quantity-when', 'timing', 'budget', 'materials', 'interest'])
      check('chip group: ' + g, chipGroups.includes(g));
    check('every checkbox/radio carries a value', !/(type="(?:checkbox|radio)"[^>]*value="")/.test(html),
      count(/type="(?:checkbox|radio)"[^>]*value=""/g) + ' empty');

    // conditional groups
    check('month reveal group (timing=date)', has(/data-oa-brief-when="timing=date"/));
    check('note suppression (unless after=bespoke)', has(/data-oa-brief-unless="after=bespoke"/));

    // Informational: a class that sets `display` on a step block outranks the UA
    // [hidden] rule. The engine forces display inline now, but knowing is useful.
    if (css) try {
      const cssHref = (html.match(/https:\/\/cdn\.prod\.website-files\.com\/[^"']+\.css/) || [])[0];
      if (cssHref) {
        const text = await (await fetch(cssHref)).text();
        check('swatch --swatch--oa-umber defined (oa-brief.css row colours)', /--swatch--oa-umber\s*:/.test(text));
        for (const cls of ['brief_answers_step', 'brief_question'])
          if (new RegExp('\\.' + cls + '[^{]*\\{[^}]*display\\s*:', 'i').test(text))
            note('.' + cls + ' sets `display` — engine overrides it inline; do not rely on [hidden] alone');
      }
    } catch {}
  },
};
