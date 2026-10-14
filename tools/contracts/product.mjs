// /product/{slug} — the configurator (oa-configurator.js) and Save / Create brief
// (oa-saved-items.js). Default page is a configured piece; a static piece has no radios.

import { GROUPS } from '../../supabase/functions/_shared/items.ts';

// Option group → the configurator's summary element (SUMMARY in oa-saved-items.js), which
// holds the label a saved configuration carries
const SUMMARY = { 'Sizes': 'summary-size', 'Top-Material': 'summary-top-material', 'Timber': 'summary-timber', 'Anodised-Finish': 'summary-anodising' };

export default {
  url: 'https://oa-v5.webflow.io/product/viewfinder-xen',
  engines: { 'oa-configurator.js': 235, 'oa-saved-items.js': 236 },
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
