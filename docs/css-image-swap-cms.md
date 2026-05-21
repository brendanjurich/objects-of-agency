Here's a quick summary:

**The problem:** Both the Sideboards and Edition collection lists use the same CMS image field (`f_main_image_4dr`), so products that appear in both (like *Interior Credenza*) show the same image in both sections.

**The fix (no new collection list needed):**

1. **Add a new CMS image field** to your Products collection — e.g. `Edition Main Image`. Fill it in only for products where you want a different image in the Edition section.

2. **Add a second `<img>` to the card template** in the Designer, bound to the new field. Give it a unique class like `card_all-products_image-edition`.

3. **Use CSS to toggle which image shows** depending on the parent section:

```css
.card_all-products_image-edition { display: none; }

section#edition .card_all-products_image-edition { display: block; }
section#edition .card_all-products_image { display: none; }
```

The sections already have unique IDs (`#sideboards`, `#edition`), so CSS can target them cleanly. One card template, two image slots, no duplicated collection lists.

That's it. No new collection list, no JS, no Finsweet workaround. Products in Edition show the edition-specific image; products in Sideboards (or anywhere else) show the standard main image. For any product where you don't set an Edition image, Webflow will render the img tag empty — so you could add a fallback: if the Edition image field is empty, fall through to the default. Webflow handles this with the w-condition-invisible / conditional visibility feature — you can wrap each image in a conditional block in the Designer.