# Deep Research Skill — Design Spec

_Date: 2026-07-04 · Status: approved, pre-implementation_

## Purpose

A global `/deep-research` skill that orchestrates the existing firecrawl
toolkit (search / map / crawl / agent-extract / scrape) plus built-in
WebSearch/WebFetch into a repeatable, auditable multi-step research workflow.
It does **not** reimplement web tooling — it sequences and governs it.

Primary use cases (from founder context): gathering procurement docs/policies
(e.g. IGS Revit Content Standard, CUAFWE2024), structured extraction across
many sites (e.g. interior-design studios with contact + fit signals), and
written synthesis on a topic.

## Decisions (locked)

| Decision | Choice |
|---|---|
| Deliverables | Three selectable modes: **synthesis**, **extraction**, **dossier** |
| Engine | **Firecrawl-first**, built-in WebSearch/WebFetch fallback |
| Skill scope | **Global** — `~/.claude/skills/deep-research/` |
| Output | **Central vault** (oa-command-centre workspace) |
| Run flow | **Clarify → plan → confirm gate → execute** |
| Architecture | Router SKILL.md + per-mode references + templates + **durable per-run folder** |

## Skill layout

```
~/.claude/skills/deep-research/
  SKILL.md                 # router: clarify → plan → confirm gate, mode dispatch, engine rules
  references/
    synthesis.md           # written-brief mode
    extraction.md          # structured-dataset mode (schema convention + firecrawl-agent orchestration)
    dossier.md             # source-gathering mode
    engine.md              # firecrawl-first / built-in-fallback decision table + credit-cost notes
  templates/
    brief.md               # synthesis deliverable template
    run.md                 # per-run plan.md scaffold
```

SKILL.md is a thin router; only the relevant `references/*.md` is read per run
(progressive disclosure — keeps run context lean).

## Vault path

Skill reads a single configured constant near the top of SKILL.md. Default:

```
~/Documents/oa-command-centre/07-research/
```

The oa-command-centre workspace does not exist yet; the constant is centralized so
the path changes in one place once it's built.

## Run flow (every run)

1. **Clarify** — SKILL.md asks only for what's missing from the invocation:
   mode; the research question/target; source scope (which sites / how broad);
   depth (quick vs exhaustive); and, for extraction, the output schema (fields).
2. **Plan** — writes `plan.md` into the run-folder and shows a short plan: mode,
   sources it will hit, tools it will use, rough firecrawl-credit/step estimate,
   deliverable shape.
3. **Confirm gate** — waits for user go-ahead before spending credits.
4. **Execute** — routes to the single relevant mode reference and runs to
   deliverable, logging sources as it goes.

## Modes

### Synthesis
`firecrawl-search` (broad) → scrape/read top sources → dedupe & cross-check →
write `brief.md` from template: question, key findings, analysis,
recommendation. **Every claim cited** to a source in `sources.md`.

### Extraction
User defines a schema (e.g. `studio_name, city, principals, sectors,
contact_email, fit_signal, source_url`) → `firecrawl-map`/`search` builds the
target-site list → `firecrawl-agent` per site returns structured JSON → merged
into `dataset.csv` + `dataset.json`, one row per record, `source_url` on every
row.

### Dossier
Given targets → `firecrawl-scrape`/`download` primary docs into `raw/` → one-page
summary per doc + an index (`dossier.md`). Raw material preserved, not just
summarised.

All three modes write to the same run-folder and share the `sources.md`
citation log.

## Per-run folder

Scaffolded at step 2, in the vault:

```
~/Documents/oa-command-centre/07-research/<YYYY-MM-DD>-<topic-slug>/
  plan.md            # mode, sources, tool plan, credit estimate, confirm status
  sources.md         # citation log: url · title · retrieved-date · which claim/row it backs
  raw/               # scraped docs (dossier), raw agent JSON (extraction), saved pages
  dataset.csv/.json  # extraction only
  brief.md           # synthesis only
  dossier.md         # dossier only
```

Durable — survives `/clear`. A long multi-site run resumes by re-reading
`plan.md` + `sources.md`.

## Engine decision table (`engine.md`)

| Need | Tool | Fallback |
|---|---|---|
| Broad discovery / "what's out there" | `firecrawl-search` | `WebSearch` |
| Enumerate a site's pages | `firecrawl-map` → `crawl` if bulk | — |
| Structured records from a page | `firecrawl-agent` | — |
| Single known URL, simple | `firecrawl-scrape` | `WebFetch` |
| General lookup, no firecrawl need / no key | `WebSearch` / `WebFetch` | — |

Rule: **prefer the cheapest tool that gets the data.** Log an estimated
step/credit count in `plan.md` before the confirm gate.

## Research policies (enforced in every mode)

- **No uncited claims.** Every finding/row carries a `source_url`; unsourceable
  items are marked `unverified`, not asserted.
- **No fabrication.** Missing field → `null`/`not found`, never guessed.
- **Cross-check** material claims against ≥2 sources in synthesis; note
  conflicts rather than picking silently.
- **Primary sources first** for docs/policies (official standard over a blog
  about it).
- **Respect robots/paywalls** — skip and note, don't work around.
- **Date-stamp** retrievals.

## Out of scope

- No scheduling/monitoring (firecrawl-monitor stays a separate tool).
- No new web-fetching primitives — orchestration only.
- No auto-publish of outputs anywhere; artifacts stay in the vault.
```
