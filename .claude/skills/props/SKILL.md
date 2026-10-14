---
name: props
description: Use when a change to src/js or src/css adds, renames, removes or re-defaults a Designer knob — a data- attribute the Webflow Designer sets to tune timing, easing, behaviour, copy or an endpoint — so docs/PROPS.md is updated in the same commit. Also fires on "/props", "props", "update the knobs doc", "what knobs does X have", or a request to audit Designer knobs. Run with no context, it re-audits every src/ file against docs/PROPS.md and fixes the drift.
---

# Props

`docs/PROPS.md` is Brendan's reference for every Designer knob. It is only
useful if it is never stale, so it moves in the **same commit** as the code.

## What counts as a knob

| Kind | Example | In PROPS.md? |
|---|---|---|
| **Knob** — a value the Designer sets to tune behaviour, timing, easing, copy, a URL, a key | `data-oa-plus-duration="0.6"`, `data-loop="true"` | **Yes** |
| Marker hook — presence only says *this element is the X* | `data-oa-saved-row`, `data-legal-toc-panel` | No — file header, and the page's manifest in `tools/contracts/` (same commit) |
| State the script writes back | `data-whatsapp-status`, `aria-expanded`, a cached label | No |

Test: *would Brendan ever type a different value into it?* Yes → knob.

## Mode 1 — a knob changed in this session

Before committing the code change:

1. Find the element's section in `docs/PROPS.md` (one section per element, its
   file in the heading). New file → new section, newest first under the intro,
   with the tag it ships in and a one-paragraph description in plain terms.
   Move the "Newest" note to it.
2. One row per knob: attribute, default (exactly what the code falls back to,
   with unit if not seconds), what it controls in one plain sentence. Enum
   values are listed in the row.
3. Removed knob → delete the row. Renamed → rename the row; never leave both.
4. Commit `PROPS.md` with the code.

## Mode 2 — `/props` (full audit)

1. List every attribute each file reads:
   ```bash
   cd src/js && grep -noE "getAttribute\('data-[^']+|dataset\.[a-zA-Z]+|knob\(['\"][^'\"]+|num\([a-z]+, ['\"][^'\"]+" *.js | sort -u
   ```
   Prefix-built names (`'data-oa_reveal_' + name`) only show the prefix —
   read the `knob(...)` / `num(...)` calls beside it for the suffixes and defaults.
2. Read each default from the code, never from a comment or from PROPS.md.
3. Classify with the table above; diff against `docs/PROPS.md`.
4. Report in three lists — added, changed (old → new default), removed — then
   apply them. Nothing changed → say so in one line.

## Rules

- **The code is the source of truth.** A default in PROPS.md that disagrees with
  the file is a bug in PROPS.md.
- Plain English in *Controls*: what Brendan sees change, not the implementation.
- Times in seconds unless the code uses ms — then mark `ms`.
- Repo terms only: the file name, the component name as the Designer shows it.
- This repo is public: endpoints and site keys already ship in the code, but
  never add a secret to the doc.
