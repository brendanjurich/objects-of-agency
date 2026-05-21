# All Products Filter — Implementation Plan
## Osmo Basic Filter Setup (Multi Match) + Webflow CMS

---

## Background: How the System Works

The Osmo filter script has two ways to populate `data-filter-name` on each card:

1. **Manually** — hard-code `data-filter-name="land water"` directly on the list item wrapper.
2. **Auto-collect** — leave `data-filter-name=""` empty and the script reads all `data-filter-name-collect` child elements at init time, collects their unique values, and writes them into the parent's attribute automatically.

**Option B (chosen approach)** uses a plain text CMS field bound directly to `data-filter-name`. This is the most stable approach — no timing dependencies, no async injection conflicts.

---

## Conflict Analysis: Osmo Filter vs Finsweet List Nest v2

### Attribute namespaces — no direct collision
Finsweet List Nest v2 uses exclusively `fs-list-*` prefixed attributes. Osmo uses `data-filter-*` attributes. Neither system touches the other's attributes.

### Why `data-filter-name-collect` was ruled out (Option A)
List Nest fetches nested CMS content **asynchronously after page load**. The Osmo script runs its collect sweep once at `DOMContentLoaded`. The `[data-filter-name-collect]` elements injected by List Nest are not in the DOM when Osmo initialises — they would always be missed.

`fs-list-cache=false` does not resolve this. It makes List Nest fetch fresh on every load (slightly slower), giving **consistent failure** rather than intermittent failure — useful for debugging but not a fix.

### Option B bypasses the timing issue entirely
By binding `data-filter-name` directly to a CMS plain text field, the attribute is populated server-side at render time. No JavaScript dependency, no race condition.

---

## Current DOM State (oa-v5.webflow.io/all-products)

### Filter group
- `data-filter-group=""` is on the `<section>` element (`.section_all_tables`)

### Filter buttons
| Button | `data-filter-target` | Status |
|---|---|---|
| All | `all` | ✅ Present, `data-filter-status="active"` |
| Coffee | `coffee` | ✅ Present |
| Side | `side` | ✅ Present |
| Bedside | ❌ Missing | Needs `data-filter-target="bedside"` added |
| Dining | ❌ Missing | Needs `data-filter-target="dining"` added |
| Meeting | ❌ Missing | Needs `data-filter-target="meeting"` added |
| Boardroom | ❌ Missing | Needs `data-filter-target="boardroom"` added |
| Console | ❌ Missing | Needs `data-filter-target="console"` added |

### Collection Items (cards)
- `data-filter-name=""` — present on all `.w-dyn-item` elements but **empty** (needs CMS binding)
- `data-filter-status="active"` — present ✅
- `role="listitem"` — present ✅
- Finsweet List Nest (`fs-list-nest="swatches"`, `fs-list-element="nest-target/wrapper"`) — present and isolated ✅

### Filter slugs in use
`all` `coffee` `side` `bedside` `dining` `meeting` `boardroom` `console`

---

## Step-by-Step Implementation Plan

### Step 1 — Add a plain text field to the CMS Collection

In the Webflow Designer, open the **Products** (Tables) CMS Collection settings:

- Add new field → **Plain Text**
- Name: `Filter Tags`
- Auto-slug: `filter-tags`
- Place below the swatches multi-reference field

---

### Step 2 — Populate `Filter Tags` for each product

Fill each CMS item's `Filter Tags` field with space-separated slugs matching the button targets exactly (lowercase, hyphenated for multi-word, space-separated for multi-category).

| Product | Filter Tags value |
|---|---|
| ViewFinder Aurum | `coffee` |
| ViewFinder CR | *(set per actual category)* |
| ViewFinder Cuprum | `coffee` |
| ViewFinder Noir CR | `side` |
| ViewFinder Noir Nest | `side` |
| ViewFinder Noir S | `side` |
| ViewFinder Umbra | `dining` |
| ViewFinder Winter | `dining` |
| ViewFinder Xen | *(set per actual category)* |

**Rules:**
- Lowercase only: `coffee` not `Coffee`
- Hyphenate multi-word slugs: `blue-birds` not `blue birds`
- Space-separate multiple categories: `coffee bedside` not `coffee,bedside`
- Values must exactly match `data-filter-target` on the buttons

---

### Step 3 — Bind `data-filter-name` to the CMS field

In the Designer, open the **Tables Collection List** and select the **Collection Item** element (`.all_tables_item` / `.w-dyn-item`):

1. Go to Element Settings → Custom Attributes
2. Find the existing `data-filter-name` attribute (currently value = `""`)
3. Click the value field → "Get value from [Products Collection]"
4. Select the `Filter Tags` field

Each card will now render with e.g. `data-filter-name="coffee"` or `data-filter-name="coffee bedside"` server-side.

---

### Step 4 — Fix missing `data-filter-target` on CMS-driven buttons

The `Bedside`, `Dining`, `Meeting`, `Boardroom`, and `Console` buttons come from a CMS Collection List. They render the correct label text but are missing `data-filter-target`.

1. In the Designer, find the Collection List rendering those buttons
2. Select the `.button_main_wrap` element (or closest wrapper) inside the Collection Item
3. Add custom attribute: `data-filter-target` → bind to the **slug field** of the Categories collection
4. Add static attribute: `data-filter-status` → `not-active`
5. Add static attribute: `aria-pressed` → `false`
6. Add static attribute: `aria-controls` → `filter-list`

Match the pattern of the three static buttons (All, Coffee, Side) exactly.

---

### Step 5 — Verify the "All" button default state

The `All` button must be the only one with `data-filter-status="active"` on load. All other buttons should have `data-filter-status="not-active"` (or the attribute absent — the JS sets it). This is already correct for the static buttons.

---

### Step 6 — Add Osmo JS and CSS to the project

Add via VS Code / Claude Code as a separate script file. No modifications to the Osmo core logic are needed — Option B means `data-filter-name` is already populated and the collect logic is never triggered.

See separate files:
- `all-products-filter.js` — Osmo `initBasicFilterSetupMultiMatch` function
- `all-products-filter.css` — Filter button and list item transition styles

---

## What Does NOT Need Changing

| Element | Status |
|---|---|
| `role="listitem"` on cards | ✅ Already present, no conflict |
| `role="list"` on list wrapper | ✅ Already present, no conflict |
| `data-filter-status="active"` on cards | ✅ Already present, JS manages at runtime |
| `data-filter-group=""` on section | ✅ Already present |
| Finsweet List Nest swatch setup | ✅ Completely isolated, no conflict |
| `fs-list-*` attributes | ✅ Separate namespace, untouched |

---

## Osmo JavaScript (initBasicFilterSetupMultiMatch)
```js
function initBasicFilterSetupMultiMatch() {
  const transitionDelay = 300;
  const groups = [...document.querySelectorAll('[data-filter-group]')];

  groups.forEach(group => {
    const buttons = [...group.querySelectorAll('[data-filter-target]')];
    const items = [...group.querySelectorAll('[data-filter-name]')];

    // collect names once (init only)
    items.forEach(item => {
      const cs = item.querySelectorAll('[data-filter-name-collect]');
      if (!cs.length) return;
      const seen = new Set(), out = [];
      cs.forEach(c => {
        const v = (c.getAttribute('data-filter-name-collect') || '').trim().toLowerCase();
        if (v && !seen.has(v)) { seen.add(v); out.push(v); }
      });
      if (out.length) item.setAttribute('data-filter-name', out.join(' '));
    });

    // cache tokens
    const itemTokens = new Map();
    items.forEach(el => {
      const tokens = ((el.getAttribute('data-filter-name') || '').trim().toLowerCase().split(/\s+/)).filter(Boolean);
      itemTokens.set(el, new Set(tokens));
    });

    const setItemState = (el, on) => {
      const next = on ? 'active' : 'not-active';
      if (el.getAttribute('data-filter-status') !== next) {
        el.setAttribute('data-filter-status', next);
        el.setAttribute('aria-hidden', on ? 'false' : 'true');
      }
    };

    const setButtonState = (btn, on) => {
      const next = on ? 'active' : 'not-active';
      if (btn.getAttribute('data-filter-status') !== next) {
        btn.setAttribute('data-filter-status', next);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      }
    };

    let activeTarget = null;

    const itemMatches = el => {
      if (!activeTarget || activeTarget === 'all') return true;
      return itemTokens.get(el).has(activeTarget);
    };

    const paint = rawTarget => {
      const target = (rawTarget || '').trim().toLowerCase();
      activeTarget = (!target || target === 'all') ? 'all' : target;

      items.forEach(el => {
        if (el._ft) clearTimeout(el._ft);
        const next = itemMatches(el);
        const cur = el.getAttribute('data-filter-status');

        if (cur === 'active' && transitionDelay > 0) {
          el.setAttribute('data-filter-status', 'transition-out');
          el._ft = setTimeout(() => { setItemState(el, next); el._ft = null; }, transitionDelay);
        } else if (transitionDelay > 0) {
          el._ft = setTimeout(() => { setItemState(el, next); el._ft = null; }, transitionDelay);
        } else {
          setItemState(el, next);
        }
      });

      buttons.forEach(btn => {
        const t = (btn.getAttribute('data-filter-target') || '').trim().toLowerCase();
        setButtonState(btn, (activeTarget === 'all' && t === 'all') || (t && t === activeTarget));
      });
    };

    group.addEventListener('click', e => {
      const btn = e.target.closest('[data-filter-target]');
      if (btn && group.contains(btn)) paint(btn.getAttribute('data-filter-target'));
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initBasicFilterSetupMultiMatch();
});
```

---

## Osmo CSS
```css
/* Filter Button */
.filter-btn {
  transition: color 0.6s cubic-bezier(0.625, 0.05, 0, 1),
              background-color 0.6s cubic-bezier(0.625, 0.05, 0, 1);
}

.filter-btn[data-filter-status="active"] {
  background-color: #131313;
  color: #EFEEEC;
}

/* Filter List Item */
.filter-list__item[data-filter-status="active"] {
  transition: opacity 0.6s cubic-bezier(0.625, 0.05, 0, 1),
              transform 0.6s cubic-bezier(0.625, 0.05, 0, 1);
  transform: scale(1) rotate(0.001deg);
  opacity: 1;
  visibility: visible;
  position: relative;
}

.filter-list__item[data-filter-status="transition-out"] {
  transition: opacity 0.45s cubic-bezier(0.625, 0.05, 0, 1),
              transform 0.45s cubic-bezier(0.625, 0.05, 0, 1);
  transform: scale(0.9) rotate(0.001deg);
  opacity: 0;
  visibility: visible;
}

.filter-list__item[data-filter-status="not-active"] {
  transform: scale(0.9) rotate(0.001deg);
  opacity: 0;
  visibility: hidden;
  position: absolute;
}
```

> **Note:** The Osmo CSS class names (`.filter-btn`, `.filter-list__item`) are from the demo. Your project uses `.button_main_wrap` and `.all_tables_item` respectively. The CSS selectors need to be updated to target your actual class names, or target by attribute only (e.g. `[data-filter-target]` and `[data-filter-name]`). This will be handled in the VS Code / Claude Code step.
