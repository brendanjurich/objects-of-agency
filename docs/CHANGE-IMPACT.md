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

## Brief month select — `/contact`, `oa-brief.js` + `oa-brief.css`

The open month list (desktop; Chrome/Edge, Safari 27) uses the directional hover tile.
`oa-brief.js` gives each month a `span.directional-list__hover-tile`; its look is an Embed
`<style>` in the brief's month group (source: `tools/designer/oa-brief-month-list.html`;
the Embed is the live copy — paste changes back here).

| CMS / Designer edit | Effect on the list | Action | Status |
|---|---|---|---|
| Change `.directional-list__hover-tile`'s colour | Month hover follows (as /about) | None | Safe |
| Rename class `.directional-list__hover-tile` | Month hover tile has no colour | Update `fillMonths()` in `oa-brief.js` and re-tag | Coordinate |
| Remove `data-directional-hover` / `data-type="y"` from the select | No hover tile | Put them back | Coordinate |
| Remove `data-lenis-prevent` from the select | Wheel scrolls the page, not the open list | Put it back | Coordinate |
| Edit the Embed's CONTROLS | List follows on publish | None | Safe |

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

---

## Nav search dropdown — sitewide, `oa-global.js` (`initNavSearch`)

Found by `form[action="/search"]` inside a `.w-dropdown`; watches the toggle's `w--open`.
Every row fails soft: Webflow's own dropdown keeps working, only the input focus and the
`aria-haspopup` removal stop.

| CMS / Designer edit | Effect on the dropdown | Action | Status |
|---|---|---|---|
| Restyle the toggle, panel or field | None | None | Safe |
| Move the search form out of its Dropdown | Focus fix and `aria-haspopup` removal stop | Tell Claude; `initNavSearch` needs a new anchor | Coordinate |
| Change the form's Action from `/search` | Same, and search itself breaks | Put it back | Coordinate |
| Swap the field for a non-`type="search"` input | Focus fix stops | Tell Claude | Coordinate |
