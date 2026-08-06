---
name: clean-svg
description: Use when an Affinity Designer SVG export needs cleaning before it goes anywhere else — especially Lottie Labs for animation, but equally Figma, Rive, Webflow or src/svg/. Fires on "clean this SVG", "clean-svg", "strip the Affinity cruft", "prep this for Lottie", "this SVG won't import properly", or an .svg dropped in with no framing. Strips the serif:/DOCTYPE/artboard scaffolding, inlines CSS onto presentation attributes, collapses nested matrix wrappers, names the layers, and proves the result renders pixel-identically.
---

# Clean SVG

Affinity exports carry ~40–50% dead weight and a nesting structure built for
Affinity's own layer panel, not for an importer. Lottie Labs reads what
survives: **groups become layers, ids become layer names, presentation
attributes become animatable properties.** Everything else is noise or a
silent drop.

Two scripts, both stdlib + Pillow (this repo has no build step and no `lxml`):

| Script | Job |
|---|---|
| `clean_svg.py` | The clean. Reports every removal and every Lottie incompatibility. |
| `pixdiff.py` | The gate. Renders source vs cleaned through Quick Look and diffs pixels. |

**Never hand-edit an Affinity export.** Geometry drift is invisible in a diff
and obvious on screen a week later. The script never rewrites path data unless
`--precision` is passed, and asserts it.

## Run

```bash
D=.claude/skills/clean-svg
python3 $D/clean_svg.py path/to/export.svg -o path/to/out.svg
python3 $D/pixdiff.py path/to/export.svg path/to/out.svg   # the gate
```

Then read the report — it is the deliverable, not a log.

**Where the files live.** Brand artwork moves through two folders in the
command centre, both private:

| Folder | Holds |
|---|---|
| `02-brand/oa-logo/affinity-export/` | Raw Affinity exports — the input. Never edited. |
| `02-brand/oa-logo/clean-svg/` | **Cleaned output. This is the home — always write here.** |

Drop the `-r_1`/`-r_2` Affinity revision suffix on the way out; the clean
folder holds one current file per asset. Never write output into this skill
folder or anywhere else in the website repo (see traps).

| Flag | When |
|---|---|
| `--drop-guides` | Second run only, after reading what it wants to delete. |
| `--precision N` | Only when file size genuinely matters. Disables the geometry gate. |
| `--keep` (pixdiff) | Keep the rendered PNGs to eyeball a soft pass. |

## What it strips

Confirmed against every OA master — the icon set, the nav mark, the monograph
versions and the lock-up sheet.

**Gone:** `<?xml?>`, `<!DOCTYPE>`, `version`, `xml:space`, `xmlns:serif`, every
`serif:id`, `width="100%"`/`height="100%"`, empty layer `<g>`s, the artboard
bounds `<rect fill="none">`, a `<clipPath>` whose rect equals the viewBox (it
clips nothing), `stroke-*` props on a file with no strokes, `-0`, groups that
only add nesting depth.

**Rewritten:** `style="fill:#fff"` → `fill="#fff"` (importers read attributes,
not CSS), `rgb()` → hex, `width`/`height` set to the real canvas so nothing has
to guess, chains of `<g transform>` wrappers composed into one matrix.

**Kept:** all path data, `viewBox`, `fill-rule`/`clip-rule`, real clips, real
strokes, `role`/`aria-label`, and any id something references by `url(#…)`.

## The three gates

**1. Geometry.** Every surviving `d`/`points` string must be byte-identical to
the source. Deletions are allowed (that is what `--drop-guides` does);
mutations never are. The script asserts this and dies on failure.

**2. Pixels.** `pixdiff.py` must PASS. It normalises both files to the same
explicit size first — otherwise it just measures the intrinsic-size change the
clean deliberately makes. A SOFT PASS is only acceptable when you can name what
differs (dropped guides, edge antialiasing). *This gate caught two real bugs
during the build; do not skip it because the report looked clean.*

**3. Warnings.** Every WARNING is read out to Brendan, not swallowed. They are
the difference between "cleaned" and "will actually animate".

## Reading the report

`layers for Lottie Labs:` is the layer panel he will see. If it says
`(none named)`, the artwork imports as `Path 1, Path 2, Path 3` and every
animation target has to be guessed — **say so and ask whether to name them in
Affinity first.** Naming layers there is cheaper than renaming them in Lottie.

Guide layers are reported, never auto-deleted. Show Brendan the list with the
descendant counts, then re-run with `--drop-guides`. `artboard` is deliberately
excluded from that detection — the artboard group *contains* the artwork.

## What Lottie cannot import

Reported by name, never silently deleted, because each one needs an art
decision rather than a code one:

| In the file | Reality |
|---|---|
| `<text>` / `<tspan>` | Does not import. Convert to curves in Affinity, then re-export. |
| `@keyframes` / `@media` CSS | Cannot be represented. Re-author on the Lottie timeline — that is the point of going there. |
| `<filter>`, blurs | Not in the Lottie spec. Bake into the artwork or drop the effect. |
| `mix-blend-mode` | Not supported by the renderer. |
| `<use>`, `<symbol>` | Commonly dropped on import. Expand the instance in Affinity. |
| `<image>` | Imports as an opaque bitmap — not animatable. |
| `vector-effect="non-scaling-stroke"` | Does not survive. |
| gradients | Do import, but verify stop positions after. |

A multi-artboard sheet warns and should be rejected: **export the one artboard
being animated and clean that.** The lock-up master is nine artboards in one
file; cleaning it wholesale produces a mess in every tool.

## Traps

- **`prefers-reduced-motion` rules are conditional.** Inlining a rule from
  inside an at-rule block applies it to everyone — it froze the Perth halo at
  `animation:none` for all viewers. At-rule blocks are stripped before flat
  rules are matched; keep it that way.
- **A stroke declared in CSS is still a stroke.** Deciding "this file has no
  strokes" before inlining the stylesheet strips `stroke-width` and thins the
  artwork. That check runs *after* CSS inlining.
- **An id may not start with a digit.** `48FAV` → `_48fav`; Affinity's own
  workaround, and an invalid id breaks reference lookups downstream.
- **Referenced ids are never renamed.** Renaming a gradient or clip id
  silently breaks the `url(#…)` that points at it.
- **The `-0` in path data stays.** It is inside `d` strings, which are never
  touched. Only attribute values are normalised.
- **Explicit `width`/`height` changes how it previews.** Quick Look and the
  browser now render at intrinsic size instead of scaling to fill. That is
  correct and wanted — `width="100%"` is exactly what makes importers guess a
  canvas.
- **This repo is public — cleaned brand assets never live here.** Not in this
  skill folder, not anywhere in the repo, unless the asset is genuinely
  shipped by the site. Everything else (logo masters, curve exports bound for
  Lottie Labs, work-in-progress marks) goes to `02-brand/oa-logo/clean-svg/`
  in the private command centre. Write it there in the first place rather than
  moving it afterwards — an asset committed here and deleted later still sits
  in the public history, and only an unpushed branch can be rewritten.
- **The output is not automatically for the repo.** A cleaned file bound for
  `src/svg/` still follows `CLAUDE.md` → CDN Deployment Workflow; a file bound
  for Lottie Labs never enters the repo at all. Ask which it is.
