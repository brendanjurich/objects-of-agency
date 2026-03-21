// ============================================================
// 1. PRICING ENGINE
// ============================================================
function initPricingEngine() {
  const basePriceEl = document.querySelector('.config_base_price');
  const fromPriceEl = document.querySelector('.config_from_price');
  const configuredPriceEl = document.querySelector('.configure_price');
  if (!basePriceEl || (!fromPriceEl && !configuredPriceEl)) return;

  const formatter = new Intl.NumberFormat('en-AU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  function calculatePrice() {
    const basePrice = parseFloat(basePriceEl.textContent.replace(/[^0-9.]/g, '')) || 0;
    let modifier = 0;

    document.querySelectorAll('input[type="radio"]:checked').forEach(function (input) {
      const priceEl = input.closest('[data-price]');
      if (priceEl) {
        modifier += parseFloat(priceEl.getAttribute('data-price')) || 0;
      }
    });

    if (fromPriceEl) fromPriceEl.textContent = formatter.format(basePrice);
    if (configuredPriceEl) configuredPriceEl.textContent = formatter.format(basePrice + modifier);
  }

  document.addEventListener('change', function (event) {
    if (event.target.type === 'radio') calculatePrice();
  });

  calculatePrice();
}

// ============================================================
// 2. SUMMARY UPDATER
// ============================================================
function initSummaryUpdater() {
  const groups = [
    { name: 'Sizes',           id: 'summary-size' },
    { name: 'Top-Material',    id: 'summary-top-material' },
    { name: 'Timber',          id: 'summary-timber' },
    { name: 'Anodised-Finish', id: 'summary-anodising' },
  ];

  function updateSummary() {
    groups.forEach(function (group) {
      const summaryEl = document.getElementById(group.id);
      if (!summaryEl) return;

      const checked = document.querySelector('input[name="' + group.name + '"]:checked');
      if (!checked) return;

      const labelEl = checked.closest('.form_ui_item') &&
        checked.closest('.form_ui_item').querySelector('.form_ui_text');
      if (labelEl) summaryEl.textContent = labelEl.textContent.trim();
    });
  }

  document.addEventListener('change', function (event) {
    if (event.target.type === 'radio') updateSummary();
  });

  updateSummary();
}

// ============================================================
// 3. INIT ON DOM READY
// ============================================================
document.addEventListener('DOMContentLoaded', function () {
  initPricingEngine();
  initSummaryUpdater();
});
