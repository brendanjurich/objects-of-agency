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

## Paths

| What | Where |
|---|---|
| Masters (source of truth) | `02-brand/oa-logo/icons/raw-files/{svg,favicon,manifest}/` |
| Built outputs | `02-brand/oa-logo/icons/` |
| Superseded previous release | `02-brand/oa-logo/icons/ss/` |
| Head code (paste into Webflow) | `02-brand/oa-logo/icons/webflow-head-code.html` |
| Shipped copies | `01-projects/objects-of-agency-website/src/icons/` |

Paths are relative to the command-centre root. The website repo is nested inside it
and keeps its own history, remote and tags.

## Step 0 — Inventory and archive

Confirm what actually changed before touching anything.

```bash
cd 02-brand/oa-logo/icons
md5 raw-files/*/*.png raw-files/svg/*.svg
python3 -c "
from PIL import Image; import glob
for f in sorted(glob.glob('raw-files/**/*.png', recursive=True)):
    im = Image.open(f); print(f, im.size, im.mode)
"
```

Move the previous release's built outputs into `ss/` if Brendan hasn't already.
`ss/` is the archive — never delete it, it's the rollback reference.

**Expect PNGs to be RGB with no alpha.** Alpha on apple-touch or the maskable is a
defect (see traps).

## Step 1 — Clean the SVGs

Affinity exports carry ~1200 bytes of cruft. Extract and rebuild rather than
hand-editing, so geometry cannot drift.

Strip: `<?xml?>`, `<!DOCTYPE>`, `version`, `width`/`height="100%"`, `xmlns:xlink`,
`xmlns:serif`, `xml:space`, every `serif:id`, all empty artboard `<g>` wrappers, the
locked `id="FAV-48-…-MSTR---LOCK-🔒"` rect (painted over, dead weight), the
`<clipPath>` + its `clip-path` reference (the clip rect equals the viewBox, so it
clips nothing), and `stroke-linejoin`/`stroke-miterlimit` (no strokes exist).

Keep: `viewBox="0 0 48 48"`, `fill-rule`, `clip-rule`, the BG rect, the mark path.

```python
import re
def extract(f):
    s = open(f, encoding="utf-8").read()
    ds = re.findall(r'\sd="([^"]+)"', s)
    assert len(ds) == 1, f"{f}: expected 1 path, got {len(ds)}"
    bg = re.search(r'<rect id="BG"[^>]*fill:(#[0-9a-fA-F]{6})', s).group(1)
    fg = re.search(r'\sd="[^"]+"\s+style="fill:(#[0-9a-fA-F]{6})', s).group(1)
    return ds[0], bg, fg

TPL = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" '
       'fill-rule="evenodd" clip-rule="evenodd">\n'
       '  <rect width="48" height="48" fill="{bg}"/>\n'
       '  <path fill="{fg}" d="{d}"/>\n'
       '</svg>\n')
```

Write `oa-icon-light.svg` and `oa-icon-dark.svg`. **Gate: assert each output's `d`
string is byte-identical to its source.**

## Step 2 — Build `oa-favicon.svg`

Check whether the two variants share geometry:

```python
assert light_d == dark_d   # if this holds, use the single-geometry form below
```

**If identical** (current state — the optical corner-radius correction was retired),
store the geometry once and swap fills. Class-based `fill` overrides — not CSS custom
properties, not `display` toggling:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill-rule="evenodd" clip-rule="evenodd">
  <style>
    .bg{fill:#fafaf8}
    .fg{fill:#0a0a0a}
    @media (prefers-color-scheme:dark){.bg{fill:#0a0a0a}.fg{fill:#fafaf8}}
  </style>
  <rect class="bg" width="48" height="48"/>
  <path class="fg" d="…"/>
</svg>
```

**If the variants ever diverge again**, fall back to two `<g class="oa-light">` /
`<g class="oa-dark">` groups toggled by `display`. Only do this when geometry
genuinely differs — duplicating identical artwork invites drift.

This file is the **static default only**. The live theme swap is JS-driven (Step 6).

## Step 3 — Build `favicon.ico` (16 + 32 + 48)

**Pillow's ICO writer silently drops the extra sizes** — it produced a 531-byte
single-size file. Hand-pack the container, embedding each PNG verbatim:

```python
import struct
from PIL import Image
sizes = [16, 32, 48]
blobs = []
for s in sizes:
    p = f"raw-files/favicon/oa-favicon-{s}.png"
    assert Image.open(p).size == (s, s)
    blobs.append((s, open(p, "rb").read()))
header  = struct.pack("<HHH", 0, 1, len(blobs))
offset  = 6 + 16 * len(blobs)
entries = data = b""
for s, png in blobs:
    entries += struct.pack("<BBBBHHII", s, s, 0, 0, 1, 32, len(png), offset)
    offset  += len(png); data += png
open("favicon.ico", "wb").write(header + entries + data)

assert sorted(Image.open("favicon.ico").ico.sizes()) == [(16,16),(32,32),(48,48)]
```

The ICO is built from the **dark** variant and is dark-only — a single `.ico` cannot
theme-swap. It's the legacy/Windows fallback.

## Step 4 — Audit the raster set (safe zones)

This is the gate that catches real defects. Measure **radial** extent, not bbox — the
mark is circular and Android's safe zone is a circle.

```python
from PIL import Image
import math
def audit(f):
    im = Image.open(f).convert("RGB"); w,h = im.size; px = im.load()
    bg = px[0,0]
    corners_ok = all(px[x,y] == bg for x,y in [(0,0),(w-1,0),(0,h-1),(w-1,h-1)])
    cx, cy = (w-1)/2, (h-1)/2; maxr = 0
    for y in range(h):
        for x in range(w):
            r,g,b = px[x,y]
            if abs(r-bg[0])+abs(g-bg[1])+abs(b-bg[2]) > 30:
                maxr = max(maxr, math.hypot(x-cx, y-cy))
    return (2*maxr)/w, corners_ok
```

| File | Purpose | Target | Hard limit |
|---|---|---|---|
| `oa-icon-maskable-512.png` | `maskable` — **gets cropped** | **≈61%** radial (Android's 66dp-in-108dp keyline) | ≤80% |
| `oa-manifest-icon-512/192.png` | `any` — **renders uncropped** | ~71–79% | — |
| `oa-favicon-16/32/48.png` | ICO payload | ~75% | — |
| `oa-apple-touch-icon.png` | iOS tile, **no alpha** | ~78–80% | — |

**Gates:**
- maskable and `any` **must be different files** — they shipped byte-identical once,
  which cannot satisfy both (a 61%-padded `any` looks undersized uncropped; a 79%
  maskable touches the mask rim).
- maskable `corners_ok` must be **True** and the image must have no alpha — the mask
  crops *into* the background, so a transparent corner shows as a wedge.
- Centring offset should be ≤2px.

If a threshold fails, **stop and tell Brendan which file to re-export and to what
number.** Don't pad or rescale his artwork.

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
  an existing one.
- **Command centre is text-only.** `*.png` is gitignored there; the website repo needs
  its scoped `!src/icons/` exception (already present).
- **Live OS theme toggle won't repaint an already-drawn tab icon on iOS**, even with
  the JS swapper. WebKit repaint quirk, unfixable from our side. Not a regression.
