---
name: icon-release
description: Use when any OA favicon/PWA icon master changes — rebuilds the whole icon set from raw-files, audits safe zones, verifies light/dark, tags a jsDelivr release and produces the Webflow head code. Covers favicon.ico, oa-favicon.svg, apple-touch, manifest and maskable icons.
---

# Icon release sweep

Full re-circulation of the OA favicon/PWA icon system when **any** master changes.
The set is self-hosted via jsDelivr and injected through Webflow Custom Code —
Webflow's own uploader re-encodes and renames files, so it is bypassed entirely.

**Never skip the verification gates.** Every one of them exists because something
actually went wrong. The traps are listed at the bottom.

Copy this checklist and tick it off as you go:

```
- [ ] Step 0 — inventory masters, archive the previous release to ss/
- [ ] Step 1–2 — icons.py svgs (light, dark, combined favicon)
- [ ] Step 3 — icons.py ico
- [ ] Step 4 — icons.py audit → fail: Brendan re-exports, back to Step 0
- [ ] Step 5 — manifest on the new tag
- [ ] Step 6 — head code on the new tag (4 links + base constant)
- [ ] Step 7 — verify → fail: back to the failing step; never tag
- [ ] Step 8 — commit, tag, 200 check on every URL before Webflow
- [ ] Step 9 — live audit after Brendan republishes
```

Needs: macOS (`md5`), `pip3 install Pillow`, the chrome-devtools MCP (Steps 7, 9).

## Paths

| What | Where |
|---|---|
| Masters (source of truth) | `02-brand/oa-logo/icons/raw-files/{svg,favicon,manifest}/` |
| Built outputs | `02-brand/oa-logo/icons/` |
| Superseded previous release | `02-brand/oa-logo/icons/ss/` |
| Head code (paste into Webflow) | `02-brand/oa-logo/icons/webflow-head-code.html` |
| Shipped copies | `01-projects/objects-of-agency-website/src/icons/` |
| Build + gate script | `scripts/icons.py` in this skill folder |

Paths are relative to the command-centre root. The website repo is nested inside it
and keeps its own history, remote and tags.

Steps 0–4 run from `02-brand/oa-logo/icons/`:

```bash
cd 02-brand/oa-logo/icons
X=../../../01-projects/objects-of-agency-website/.claude/skills/icon-release/scripts/icons.py
```

Every gate in the script exits non-zero with a message naming the file and the
number. Don't work around a failed gate.

## Step 0 — Inventory and archive

Confirm what actually changed before touching anything: `python3 $X inventory`
(md5, size and mode of every master).

Move the previous release's built outputs into `ss/` if Brendan hasn't already.
`ss/` is the archive — never delete it, it's the rollback reference.

**Expect PNGs to be RGB with no alpha.** Alpha on apple-touch or the maskable is a
defect (see traps); the inventory flags it.

## Step 1–2 — SVGs and `oa-favicon.svg`

`python3 $X svgs` rebuilds rather than hand-edits, so geometry cannot drift. From
each Affinity master it keeps only `viewBox="0 0 48 48"`, `fill-rule`, `clip-rule`,
the BG rect and the mark path. Everything else is cruft (~1200 bytes). Output:
`oa-icon-light.svg`, `oa-icon-dark.svg`. **Gate: each output's `d` string is
byte-identical to its source.**

It then builds `oa-favicon.svg`. When the two variants share geometry (the current
state — the optical corner-radius correction was retired), it stores the geometry
once and swaps fills with class-based `fill` overrides under
`@media (prefers-color-scheme:dark)` — not CSS custom properties, not `display`
toggling.

**If the variants ever diverge again**, the script stops. Build `oa-favicon.svg` by
hand with two `<g class="oa-light">` / `<g class="oa-dark">` groups toggled by
`display`. Only do this when geometry genuinely differs — duplicating identical
artwork invites drift.

This file is the **static default only**. The live theme swap is JS-driven (Step 6).

## Step 3 — Build `favicon.ico` (16 + 32 + 48)

`python3 $X ico`. **Pillow's ICO writer silently drops the extra sizes** — it
produced a 531-byte single-size file — so the script hand-packs the container with
`struct`, embedding each PNG verbatim. Gate: the file holds all three sizes.

The ICO is built from the **dark** variant and is dark-only — a single `.ico` cannot
theme-swap. It's the legacy/Windows fallback.

## Step 4 — Audit the raster set (safe zones)

`python3 $X audit`. This is the gate that catches real defects. It measures
**radial** extent, not bbox — the mark is circular and Android's safe zone is a
circle.

| File | Purpose | Target | Hard limit |
|---|---|---|---|
| `oa-icon-maskable-512.png` | `maskable` — **gets cropped** | **≈61%** radial (Android's 66dp-in-108dp keyline) | ≤80% |
| `oa-manifest-icon-512/192.png` | `any` — **renders uncropped** | ~71–79% | — |
| `oa-favicon-16/32/48.png` | ICO payload | ~75% | — |
| `oa-apple-touch-icon.png` | iOS tile, **no alpha** | ~78–80% | — |

**Gates (all in the script):**
- maskable and `any` **must be different files** — they shipped byte-identical once,
  which cannot satisfy both (a 61%-padded `any` looks undersized uncropped; a 79%
  maskable touches the mask rim).
- maskable corners must be solid background and the image must have no alpha — the
  mask crops *into* the background, so a transparent corner shows as a wedge.
- Centring offset ≤2px.

If a gate fails, **stop and tell Brendan which file to re-export and to what
number.** Don't pad or rescale his artwork. When the new export lands, go back to
Step 0.

## Step 5 — Manifest

Bump every icon `src` to the new tag. Three entries; `any` and `maskable` stay
**separate** — never `"any maskable"` on one entry.

`id` / `start_url` / `scope` must be **absolute URLs to the live site**. The manifest
is served cross-origin from jsDelivr, so relative values would scope the PWA to the
CDN and break it. Currently staging — see the domain-cutover item in `docs/REMAINING.md`.

## Step 6 — Head code

Bump the tag everywhere in `webflow-head-code.html` (four `<link>` URLs **and** the
`base` constant inside the script — easy to miss one). Two runtime scripts, both
load-bearing:

1. **Webflow neutraliser** — Webflow's Favicon/Webclip Site Settings fields cannot be
   cleared, so it injects ~6 icon tags. Strips them by matching the
   `website-files.com` **host** (never filenames — Brendan re-uploads there).
2. **Theme swapper** — rewrites the icon `href` on a `matchMedia` listener, replacing
   the whole `<link>` node (not just `.href`) to force a re-rasterise. Also removes
   the `.ico` link at runtime so the SVG wins unambiguously.

**Do not "simplify" the swapper back to the pure-CSS media query.** Neither Chromium
nor WebKit evaluates `prefers-color-scheme` inside an SVG favicon; Firefox is the only
engine that does. This was verified on Chrome desktop (macOS) and Chrome iOS in
incognito with hard reload, in both OS themes. The static `href` stays
`oa-favicon.svg` so Firefox and no-JS still swap natively.

## Step 7 — Verify before deploying

1. **SVG integrity** — cleaned `d` strings byte-identical to masters; no `serif`,
   `clipPath` or `DOCTYPE` survives.
2. **ICO** — `Image.open(...).ico.sizes()` returns all three.
3. **Manifest** — parses; absolute `id`/`start_url`/`scope`; purposes are
   `any`/`any`/`maskable`; all `src` on the new tag.
4. **Head code** — zero references to the *old* tag; the `base` constant matches.
5. **Render harness** — build a throwaway page in the scratchpad showing the favicon
   at 128/48/32/16, the `.ico`, the maskable under circle + squircle + rounded-rect +
   teardrop clip-paths with a dashed 80% ring, apple-touch, and the `any` icons.
   Serve it and screenshot in **both** schemes via chrome-devtools `emulate`.
   Include the fixed `oa-icon-light.svg` / `oa-icon-dark.svg` as controls — the
   combined file must match each exactly.

If any check fails, go back to the step that built the failing file, rebuild, and
re-run all five checks. Nothing is tagged until every check passes.

## Step 8 — Deploy

```bash
# 1. stage into the website repo (9 files)
cp oa-favicon.svg oa-icon-light.svg oa-icon-dark.svg favicon.ico \
   oa-apple-touch-icon.png oa-manifest-icon-192.png oa-manifest-icon-512.png \
   oa-icon-maskable-512.png oa-site.webmanifest \
   ../../../01-projects/objects-of-agency-website/src/icons/

# 2. commit on dev, tag, push both
cd ../../../01-projects/objects-of-agency-website
git add src/icons/ && git commit && git tag v1.0.X
git push origin dev && git push origin v1.0.X

# 3. verify EVERY url before touching Webflow
B="https://cdn.jsdelivr.net/gh/brendanjurich/objects-of-agency@v1.0.X/src/icons"
for f in favicon.ico oa-favicon.svg oa-icon-light.svg oa-icon-dark.svg \
         oa-apple-touch-icon.png oa-manifest-icon-192.png oa-manifest-icon-512.png \
         oa-icon-maskable-512.png oa-site.webmanifest; do
  curl -sI "$B/$f" | head -1
done
```

Expect `200` with `image/svg+xml`, `image/vnd.microsoft.icon`, `image/png`,
`application/manifest+json` — **not** `text/plain`. A fresh tag can 404 as
`text/plain` for minutes (occasionally up to ~1h); poll rather than proceeding, or
SHA-pin to unblock. Propagation is often partial — some files 200 while others 404.

Then commit the command centre (PNGs are gitignored there — only SVGs, the `.ico`
and text files track). Merge `dev` → `main` when staging is confirmed good.

## Step 9 — Live audit after Brendan republishes

**Audit the post-JS DOM and the network log — never the served HTML.** The served
HTML always contains Webflow's icon tags; that's expected, not a failure.

```javascript
// via chrome-devtools evaluate_script
({
  deployedTags: [...new Set(document.head.innerHTML.match(/@v1\.0\.\d+/g) || [])],
  swapperPresent: /matchMedia/.test(document.head.innerHTML),
  oaFaviconHref: (document.getElementById('oa-favicon') || {}).href,
  icoLinksRemaining: document.head.querySelectorAll('link[rel="icon"][href$=".ico"]').length,
  wfIconTagsRemaining: document.head.querySelectorAll('link[href*="website-files.com"][rel*="icon"]').length,
  wfStylesheetIntact: !!document.querySelector('link[rel="stylesheet"][href*="website-files.com"]')
})
```

Pass = new tag present, swapper present, `icoLinksRemaining: 0`,
`wfIconTagsRemaining: 0`, `wfStylesheetIntact: true`, zero console errors.

Then `emulate` dark → re-evaluate (**no reload**) → expect `oa-icon-dark.svg`, then
back to light. **The proof is the network log**: a fetch of `oa-icon-dark.svg` at the
moment of the flip means the browser genuinely re-rasterised.

If the deployed tag is still the old one, the paste didn't save — Webflow's
**Save Changes** on the Custom Code panel is separate from **Publish**.

## Traps

- **Pillow drops ICO sizes.** Hand-pack with `struct`.
- **`any` and `maskable` must be distinct files** at different paddings.
- **Alpha on the maskable** shows as wedges under the OS mask.
- **Pure-CSS SVG favicon theme swap does not work** in Chromium or WebKit.
- **The neutraliser must match on host, not filename.** Brendan re-uploads to Webflow
  Settings deliberately (so a leaked tag renders current art); filename matching would
  silently stop working.
- **jsDelivr tags are immutable.** Any asset change needs a new tag — never re-point
  an existing one. `.claude/hooks/guard_tags.py` blocks it from either session root.
- **Command centre is text-only.** `*.png` is gitignored there; the website repo needs
  its scoped `!src/icons/` exception (already present).
- **Live OS theme toggle won't repaint an already-drawn tab icon on iOS**, even with
  the JS swapper. WebKit repaint quirk, unfixable from our side. Not a regression.
