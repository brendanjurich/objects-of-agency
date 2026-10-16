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

**The contract won't fail on a broken match.** A map key with no matching
piece is reported as a *note* ("matches no item — no row"), because an empty
branch is allowed to hide. A renamed slug or tag passes quietly. After any CMS
pass that touches slugs or Filter Tags, run `node tools/contract.mjs contact`
and read the notes, not just the PASS/FAIL count.
