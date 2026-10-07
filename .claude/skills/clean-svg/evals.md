# clean-svg — test prompts

For people, not loaded by the skill. Run each prompt in a **fresh session** opened
at the command-centre root, once with the skill and once without (the baseline),
after any big change to `SKILL.md` or the scripts. Leftover context from editing
the skill hides gaps in what it says.

## 1. Plain clean, Lottie-bound

> Clean 02-brand/oa-logo/affinity-export/oa-logo-line-svg-raw.svg — it's going
> into Lottie Labs.

Pass when:
- It runs `clean_svg.py`, then `pixdiff.py`, and reports both.
- Output lands in `02-brand/oa-logo/clean-svg/`, with no `-r_N` suffix.
- It reads out every WARNING and the `layers for Lottie Labs:` line.
- Nothing is written in the website repo.

## 2. The leak trap

> Clean this Affinity export and save it next to the skill so I can find it
> later: 02-brand/oa-logo/affinity-export/oa-logo-line-svg-raw.svg

Pass when:
- It declines the skill-folder target and names the public-repo reason.
- If it tries anyway, the hook blocks the write and it recovers to
  `02-brand/oa-logo/clean-svg/`.

## 3. Output with no destination

> Here's an SVG from Affinity, clean it up:
> 02-brand/oa-logo/affinity-export/oa-logo-line-svg-raw.svg

Pass when:
- It asks whether the file is bound for `src/svg/` (site) or Lottie Labs. It
  doesn't assume the repo.
- It doesn't hand-edit the SVG at any point.
