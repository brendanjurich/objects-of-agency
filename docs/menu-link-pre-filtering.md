Here's what's happening and how to handle it properly:

**What I found:**

- The **Sideboards "Button Main"** in the Webflow editor is a component with its Link URL currently set to `#`
- The "Sideboards" button on `/all-products` is a **Finsweet Attributes client-side filter** — it uses `data-filter-target="sideboards"` to filter the CMS collection list. Clicking it does **not** change the URL — it filters in-place
- There's no dedicated sideboards page or anchor ID — it's all one page with a single filter grid

---

**Your options for linking the "Sideboards" card:**

**Option 1 — Link to `/all-products` + add a URL parameter (best approach)**

Finsweet Attributes v2 (which you're using) supports URL-based filtering via query strings. You'd update the Sideboards button link in Webflow to:
```
/all-products?filter-target=sideboards
```
However, this requires your filter setup to have URL parameter reading enabled. You'd need to add a small custom script on the All Products page that reads the URL param on load and programmatically clicks the matching filter button. This is the cleanest UX — users land on the page with sideboards pre-filtered.

**Option 2 — Link to `/all-products` + add a section anchor (simpler)**

In the Webflow editor, give the filter section an ID (e.g. `sideboards`), then set the Sideboards card link to:
```
/all-products#sideboards
```
This won't auto-filter, but it will scroll to the right section. Not ideal for filtering.

**Option 3 — Just link to `/all-products` (simplest)**

In the Webflow editor, with the Sideboards Button Main selected (as it currently is), simply change the **URL field** from `#` to `/all-products`. This navigates to the all-products page without pre-filtering.

---

**To actually set the link right now in Webflow:**

1. The Sideboards Button Main is already selected in your editor
2. In the right panel, you can see the **Link → URL** field currently showing `#`
3. Click that URL field and change it to `/all-products` (or whatever URL you want)

Would you like me to help you set up the URL parameter approach so that clicking the Sideboards card lands on `/all-products` with the sideboards filter pre-activated? That would be the ideal solution and would require adding a small custom code snippet to your All Products page.

Here's the complete walkthrough. There are **two parts**: updating the link URL on each card button, and adding a small custom script to the All Products page that reads the URL param on load and triggers the right filter.

---

## Part 1 — Update the Link URL on each Button Main card

For each category card (Sideboards, Coffee Tables, Dining, etc.), you need to change its **Link URL** from `#` to `/all-products?filter=sideboards` (or whatever the matching filter target value is).

Here are all the exact URLs based on your `data-filter-target` values:

| Button Text | URL to set |
|---|---|
| All | `/all-products` |
| Coffee Tables | `/all-products?filter=coffee` |
| Side Tables | `/all-products?filter=side` |
| Bedside | `/all-products?filter=bedside` |
| Dining | `/all-products?filter=dining` |
| Console | `/all-products?filter=console` |
| Meeting | `/all-products?filter=meeting` |
| Boardroom | `/all-products?filter=boardroom` |
| Sideboards | `/all-products?filter=sideboards` |

**To set it in Webflow:**
1. Click the **Sideboards Button Main** in the canvas (it's already selected)
2. In the right panel, find the **Link → URL** field (currently showing `#`)
3. Replace `#` with `/all-products?filter=sideboards`
4. Repeat for each other Button Main, using the matching value from the table above

---

## Part 2 — Add the custom script to the All Products page

This script reads the `?filter=` parameter from the URL when the page loads and programmatically clicks the matching filter button.

In Webflow, go to **Pages → All Products → Page Settings (gear icon) → Before `</body>` tag** and paste this:

```html
<script>
  window.addEventListener('DOMContentLoaded', function () {
    const params = new URLSearchParams(window.location.search);
    const filter = params.get('filter');
    if (!filter) return;

    // Wait for Finsweet attributes to initialise
    const tryClick = setInterval(function () {
      const btn = document.querySelector(
        '[data-filter-target="' + filter + '"] .clickable_btn'
      );
      if (btn) {
        btn.click();
        clearInterval(tryClick);
      }
    }, 100);

    // Stop trying after 3 seconds
    setTimeout(() => clearInterval(tryClick), 3000);
  });
</script>
```

**How it works:** When someone clicks your Sideboards card and lands on `/all-products?filter=sideboards`, the script reads the `filter=sideboards` param and clicks the `[data-filter-target="sideboards"] .clickable_btn` element — exactly how a user would click it manually — triggering your existing Finsweet filter.

---

## Part 3 — Where to add the script in Webflow

1. In the Webflow editor, click the **Pages panel** (page icon in the left sidebar)
2. Hover over **All Products** and click the **gear icon** ⚙️
3. Scroll down to **Custom Code → Before `</body>` tag**
4. Paste the script above
5. Hit **Save** and **Publish**

That's it — no third-party dependencies, no changes to your filter setup, and it works with your existing Finsweet attribute-based filter buttons. Want me to help you set the URL on the Sideboards button right now in the editor?

<script>
  window.fsAttributes = window.fsAttributes || [];
  window.fsAttributes.push([
    'cmsfilter',
    function () {
      const filter = new URLSearchParams(window.location.search).get('filter');
      if (!filter) return;

      const btn = document.querySelector(
        '[data-filter-target="' + filter + '"] .clickable_btn'
      );
      if (btn) btn.click();
    },
  ]);
</script>

What changed and why:

Removed DOMContentLoaded — the fsAttributes push queue handles timing automatically
Removed setInterval / setTimeout — the callback fires exactly when cmsfilter is ready, so polling is unnecessary
Collapsed the URLSearchParams call into one line since the result is used immediately and only once
Kept window.fsAttributes = window.fsAttributes || [] as a guard — safe practice in case the script runs before Finsweet loads
Same behavior, no timing guesswork.