/* ============================================================
   OSMO — WhatsApp Modal (static QR)
   ------------------------------------------------------------
   Adapted for Objects of Agency from osmo.supply's "WhatsApp
   Modal (Generate QR Code)". Differences from the stock resource:
     • No kjua and no runtime QR — the QR is a static SVG in a
       Designer embed. One less third-party script.
     • No URL attribute and no href writer — every link keeps its
       Designer href, which is only ever the Business short link
       (docs/contact-strategy.md).
     • Their classes, backdrop and visual CSS dropped — the markup
       is built natively in the Designer and targeted by attribute.
     • Touch is decided at click time by capability, not by a CSS
       swap of two overlay elements: on touch the trigger stays a
       real link, because a real tap on a real link is what hands
       off to the WhatsApp app.
     • No backdrop, so a click outside the panel closes it.
     • Closed panel is `inert`, the trigger carries aria-expanded,
       and focus returns to the trigger if it was in the panel.
   Page-level embed (/contact). Raw-served (no build).
   ============================================================ */

function initWhatsApp() {
  const mount = document.querySelector('[data-whatsapp-init]');
  if (!mount) return;

  const triggerWrap = mount.querySelector('[data-whatsapp-trigger]');
  const panel = mount.querySelector('[data-whatsapp-panel]');
  // Button Main renders an <a> and a <button> and shows one, depending on
  // whether its Link prop is set — take whichever is on screen.
  const trigger = triggerWrap && [...triggerWrap.querySelectorAll('a, button')]
    .find(el => el.getClientRects().length);
  if (!trigger || !panel) {
    console.warn('[oa-whatsapp] markup incomplete — skipping init.');
    return;
  }

  // A phone can't scan its own screen, so on touch the panel never opens and
  // the trigger's own link goes straight to the chat.
  const touch = window.matchMedia('(hover: none) and (pointer: coarse)');

  let open = false;
  const setOpen = next => {
    // Read before inert is set — inert drops the focus to <body>.
    const refocus = !next && panel.contains(document.activeElement);
    open = next;
    mount.setAttribute('data-whatsapp-status', next ? 'open' : 'closed');
    panel.inert = !next;
    if (!touch.matches) trigger.setAttribute('aria-expanded', String(next));
    if (refocus) trigger.focus();
  };
  setOpen(false);

  triggerWrap.addEventListener('click', e => {
    if (touch.matches) return;
    e.preventDefault();
    setOpen(!open);
  });

  panel.addEventListener('click', e => {
    if (e.target.closest('[data-whatsapp-close]')) setOpen(false);
  });

  document.addEventListener('click', e => {
    if (open && !panel.contains(e.target) && !triggerWrap.contains(e.target)) {
      setOpen(false);
    }
  });

  document.addEventListener('keydown', e => {
    if (open && e.key === 'Escape') setOpen(false);
  });
}

// Initialize the WhatsApp modal
document.addEventListener('DOMContentLoaded', () => {
  initWhatsApp();
});
