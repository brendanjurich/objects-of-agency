# Change Impact

> What a CMS or Designer edit breaks before you make it. One section per
> scripted feature: each row is an edit, what it does to the live page, and
> what has to change with it. Any commit that adds a new dependency of this
> kind (a script reading a CMS slug, field value or Designer text) adds its row
> here in the same commit.

**Reading the tables:** *Safe* means the page follows the edit on its own.
*Coordinate* means the edit breaks a match unless the other side changes too:
tell Claude the old and new value first.

---

## Brief piece drawer — `/contact`, `oa-brief.js`

The drawer's structure lives in a hidden map in the Designer
(`piece-drawer_map`, inside the drawer templates wrapper). Pieces come from the
Products CMS and join the map by **Categories slug** and **Filter Tags** value.
Labels in the map are Designer copy, not CMS names.

| CMS / Designer edit | Effect on the drawer | Action | Status |
|---|---|---|---|
| Rename a piece | Drawer follows | None | Safe |
| Rename a category | No change; the drawer label is the map's copy | Edit the map label to match, if wanted | Safe |
| Change a **category slug** | That category's row disappears | Update the map's `data-oa-brief-drawer-category` key | Coordinate |
| Change a table's **Filter Tags** | Piece drops out of its type, or lands in another | Update the map's `data-oa-brief-drawer-type` key, and the `/all-products` filter buttons (`data-filter-target`) — tags drive both | Coordinate |
| Add a piece | Appears once it has Categories set (and Filter Tags, if a table) | Tag it | Safe |
| Add a table type | No row until the map has one | Add a `piece-drawer_map-type` Text Block under `tables`: key = the tag, text = the label | Coordinate |
| Add a drawer category | No row until the map has one | Add a `piece-drawer_map-<slug>` Div with a `piece-drawer_map-label` | Coordinate |
| Remove a category's or type's last piece | Row hides itself | None | Safe |
| Rename class `.piece-drawer_row_wrap` | Rows lose their hover and selected colours | Update `oa-brief.css` (row colour states) and re-tag | Coordinate |
| Rename swatch `--swatch--oa-umber` | Hover/selected colour is lost | Update `oa-brief.css` and re-tag. Changing the swatch's *value* is safe | Coordinate |
| Add a `:hover` colour back on `.piece-drawer_row_wrap` in the Designer | Hover sticks after a tap on phones, so an un-selected row looks selected | Leave hover to `oa-brief.css` | Coordinate |

**The contract fails on a broken match.** A map key no piece carries fails
`node tools/contract.mjs contact` ("renamed in the CMS?"), though the live
drawer only hides the row. To stage a category or type empty on purpose, add
`data-oa-brief-drawer-empty-ok` to its map entry; it is then only noted. The
contract runs when someone runs it, so after any CMS pass that touches slugs or
Filter Tags, run it against staging. It also fails if `.piece-drawer_row_wrap`
is gone from the page or `--swatch--oa-umber` from the site CSS.
