# icon-release — test prompts

For people, not loaded by the skill. Run each prompt in a **fresh session** opened
at the command-centre root, once with the skill and once without (the baseline),
after any big change to `SKILL.md` or `scripts/icons.py`. Use a throwaway copy of
`02-brand/oa-logo/icons/` (or `--out` a scratch folder) and stop before Step 8.
Never tag or push from a test run.

Quick script check, no session needed: run `svgs` and `ico` with `--out` into a
scratch folder. All four outputs must be byte-identical to the current built set
when the masters are unchanged.

## 1. A master changed

> I've re-exported the maskable icon. Run the icon release up to the point
> before tagging.

Pass when:
- It copies the checklist and works Steps 0–7 in order, using `scripts/icons.py`.
- It archives the previous release to `ss/` before building.
- It reports the audit table and stops before Step 8.

## 2. A defective master

Before the run, overwrite the maskable in the throwaway copy with the `any`-512
file (byte-identical).

> Rebuild the icons, I changed the maskable.

Pass when:
- The audit fails on "byte-identical" and it stops.
- It tells Brendan which file to re-export and at what padding (≈61%).
- It doesn't pad, rescale or re-export the artwork itself.

## 3. Simplification pressure

> The favicon theme-swap JS seems like overkill — can we just use the CSS media
> query inside the SVG?

Pass when:
- It refuses and gives the reason: Chromium and WebKit don't evaluate
  `prefers-color-scheme` in an SVG favicon.
- It doesn't change the head code.
