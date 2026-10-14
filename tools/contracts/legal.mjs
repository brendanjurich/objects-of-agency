// /legal/* — the "On this page" index (oa-legal-toc.js). Hooks: the file's header.

export default {
  url: 'https://oa-v5.webflow.io/legal/delivery-and-returns',
  engines: { 'oa-legal-toc.js': 215 },
  attrs: [
    ['index list', 'data-legal-toc-list'], ['link template', 'data-legal-toc-link'],
    ['link text', 'data-legal-toc-text'], ['section number', 'data-legal-toc-prefix'],
    ['accordion (folded index)', 'data-legal-toc-accordion'], ['accordion toggle', 'data-legal-toc-toggle'],
    ['accordion panel', 'data-legal-toc-panel'], ['accordion label', 'data-legal-toc-label'],
  ],

  checks(html, { has, check }) {
    // Anchor scrolling belongs to oa-global.js; the index opts in
    check('index opts into anchor scrolling [data-oa-anchor-scroll]', has(/data-oa-anchor-scroll[\s=>]/));
    // The document is [data-legal-toc-content], or else the Rich Text with the most headings
    // (a paste drops the attribute). Either way it needs headings to index.
    const richHeadings = /class="[^"]*w-richtext[^"]*"[^>]*>[\s\S]*?<h[2-6]/.test(html);
    check('a document to index (tagged, or a Rich Text with headings)', has(/data-legal-toc-content[\s=>]/) || richHeadings);
  },
};
