# Project skills

**Project-specific** skills for the Objects of Agency website — committed to the
repo so they travel with the project and apply only here.

Put a skill here when it only makes sense for *this* site (e.g. the CDN tag-and-deploy
flow, Webflow-specific verification for these pages). If a skill is reusable across
every project (a general planning skill, GSAP helpers), it belongs in the **global**
store at `~/.claude/skills/` instead — see `~/.claude/README.md` for the rule.

Each skill is a directory with a `SKILL.md` (name + description frontmatter, then
instructions).

| Skill | Use when |
|---|---|
| `icon-release` | Any favicon/PWA icon master changes — full rebuild, safe-zone audit, jsDelivr tag, Webflow head code, live verification. |
| `osmo-in` | An osmo.supply resource is being absorbed — audit against house rules, adapt into `src/`, hand the design knobs back to the Designer. |
