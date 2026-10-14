// /product/{slug} — the configurator (oa-configurator.js) and Save / Create brief
// (oa-saved-items.js). Default page is a configured piece; a static piece has no radios.

import { readFileSync } from 'node:fs';
import { GROUPS } from '../../supabase/functions/_shared/items.ts';

// Option group → the configurator's summary element, which holds the label a saved
// configuration carries. Read from SUMMARY in oa-saved-items.js, its one owner.
const source = readFileSync(new URL('../../src/js/oa-saved-items.js', import.meta.url), 'utf8');
const SUMMARY = Object.fromEntries([...source.match(/const SUMMARY = \{([^}]*)\}/)[1].matchAll(/'([^']+)': '([^']+)'/g)].map(m => [m[1], m[2]]));

export default {
  url: 'https://oa-v5.webflow.io/product/viewfinder-xen',
  // v1.0.250: ?cfg= restore reads the link through window.oaSaved — both or neither
  engines: { 'oa-configurator.js': 250, 'oa-saved-items.js': 250 },
  attrs: [
    ['Save button', 'data-oa-save'], ['Create brief button', 'data-oa-create-brief'], ['nav count badge', 'data-oa-saved-count'],
    ['option slug on option items', 'data-option'], ['option price', 'data-price'],
    ['cascading slider', 'data-cascading-slider-wrap'], ['slider viewport', 'data-cascading-viewport'], ['slides', 'data-cascading-slide'],
    ['sticky panel mask', 'data-oa-stuck-mask'],
  ],
  inputs: GROUPS,

  checks(html, { has, check }) {
    for (const g of GROUPS) check(`summary element #${SUMMARY[g]} (${g} label)`, has(new RegExp(`id="${SUMMARY[g]}"`)));
    check('piece title .config_title (the name a saved piece carries)', has(/class="config_title[\s"]/));
    check('live price .configure_price', has(/class="configure_price[\s"]/));
  },
};
