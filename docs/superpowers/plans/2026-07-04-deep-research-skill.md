# Deep Research Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a global `/deep-research` skill that orchestrates firecrawl + built-in web tools into a clarify→plan→confirm→execute research workflow with three modes (synthesis, extraction, dossier) writing to a durable per-run folder in a central vault.

**Architecture:** A thin router `SKILL.md` handles the clarify/plan/confirm gate, mode dispatch, and vault config, then reads exactly one `references/<mode>.md` per run (progressive disclosure). `references/engine.md` holds the tool-selection table. `templates/` holds the run scaffold and synthesis brief template. No runtime code — the deliverable is markdown skill files consumed by Claude Code.

**Tech Stack:** Claude Code skill format (YAML frontmatter + markdown). Runtime tools it orchestrates: firecrawl skills (`firecrawl-search/map/crawl/agent/scrape/download`), built-in `WebSearch`/`WebFetch`. No build step, no test framework.

## Global Constraints

- Skill install path: `~/.claude/skills/deep-research/` (global, discovered automatically).
- Vault path is a single configured constant near the top of `SKILL.md`, default `~/Documents/command-center/research/`. Referenced everywhere by that constant, never hardcoded elsewhere.
- Run flow is always: **Clarify → Plan (write `plan.md`) → Confirm gate → Execute**. The confirm gate is mandatory before any firecrawl credit is spent.
- Only the relevant `references/<mode>.md` is loaded per run — `SKILL.md` stays a router, mode detail lives in references.
- Research policies (no uncited claims, no fabrication, cross-check ≥2 sources in synthesis, primary sources first, respect robots/paywalls, date-stamp retrievals) apply to every mode.
- Engine rule: prefer the cheapest tool that gets the data; firecrawl-first with built-in fallback.
- Source spec: `docs/superpowers/specs/2026-07-04-deep-research-skill-design.md`.

---

### Task 1: Scaffold directory + SKILL.md router

**Files:**
- Create: `~/.claude/skills/deep-research/SKILL.md`

**Interfaces:**
- Produces: the vault constant `RESEARCH_VAULT=~/Documents/command-center/research/`; the run-folder naming convention `<vault>/<YYYY-MM-DD>-<topic-slug>/`; the four-phase flow; the mode→reference routing table (`synthesis`→`references/synthesis.md`, `extraction`→`references/extraction.md`, `dossier`→`references/dossier.md`). All later tasks rely on these names.

- [ ] **Step 1: Create the skill directory**

Run:
```bash
mkdir -p ~/.claude/skills/deep-research/references ~/.claude/skills/deep-research/templates
```
Expected: no output, dirs exist (`ls ~/.claude/skills/deep-research` shows `references templates`).

- [ ] **Step 2: Write `SKILL.md`**

Create `~/.claude/skills/deep-research/SKILL.md` with exactly:

````markdown
---
name: deep-research
description: Multi-step web research workflow with three selectable modes — synthesis (written brief), extraction (structured dataset across many sites), and dossier (gather primary docs/policies). Orchestrates firecrawl (search/map/crawl/agent/scrape) with built-in WebSearch/WebFetch fallback, writing to a durable per-run folder in a central vault. Use when the user says "deep research", "research this properly", wants data extracted from multiple websites, or wants docs/policies gathered and summarised.
---

# /deep-research

Orchestrates existing web tools into an auditable research run. This skill does
**not** reimplement fetching — it sequences and governs `firecrawl-*` and the
built-in `WebSearch`/`WebFetch`.

## Configuration

```
RESEARCH_VAULT = ~/Documents/command-center/research/
```

If `RESEARCH_VAULT` does not exist yet, create it on first run. The
command-center workspace may not be built — this constant is the one place the
path changes when it is.

## Run flow (always, every run)

1. **Clarify.** Ask ONLY for what the invocation didn't already give:
   - **mode** — `synthesis` | `extraction` | `dossier`
   - **question/target** — what to research or which docs/sites
   - **source scope** — which sites / how broad
   - **depth** — quick vs exhaustive
   - **schema** — (extraction only) the exact fields/columns wanted
   Do not re-ask anything the user already specified.

2. **Plan.** Create the run folder and write `plan.md` from
   `templates/run.md`, then show the user a short plan: mode, sources to hit,
   tools to use, an estimated step/credit count, and the deliverable shape.

   Run folder: `<RESEARCH_VAULT>/<YYYY-MM-DD>-<topic-slug>/`
   (`topic-slug` = lowercased, hyphenated, ≤6 words of the topic.)

3. **Confirm gate.** STOP. Wait for explicit user go-ahead before spending any
   firecrawl credit. This gate is mandatory.

4. **Execute.** Read the ONE reference for the chosen mode and follow it:
   - `synthesis` → `references/synthesis.md`
   - `extraction` → `references/extraction.md`
   - `dossier` → `references/dossier.md`
   Consult `references/engine.md` for tool selection during execution.

## Research policies (all modes)

- **No uncited claims.** Every finding/row carries a `source_url`. Unsourceable
  items are marked `unverified`, never asserted as fact.
- **No fabrication.** A missing field is `null` / `not found`, never guessed.
- **Cross-check** material claims against ≥2 sources (synthesis); note conflicts
  rather than silently picking one.
- **Primary sources first** for docs/policies (the official standard over a blog
  about it).
- **Respect robots/paywalls** — skip and note; never work around them.
- **Date-stamp** every retrieval in `sources.md`.

## Output

All artifacts stay in the run folder. Never auto-publish anywhere. On finish,
tell the user the run-folder path and list what was produced.
````

- [ ] **Step 3: Verify frontmatter parses and required sections exist**

Run:
```bash
head -3 ~/.claude/skills/deep-research/SKILL.md && \
grep -c -E "^## (Configuration|Run flow|Research policies|Output)" ~/.claude/skills/deep-research/SKILL.md
```
Expected: first line `---`, a `name:`/`description:` block, and the grep prints `4`.

- [ ] **Step 4: Commit**

```bash
cd ~/.claude && git add skills/deep-research/SKILL.md 2>/dev/null; \
cd ~/Documents/objects-of-agency
```
Note: `~/.claude/skills/` may or may not be a git repo. If it is, commit there:
```bash
git -C ~/.claude commit -m "feat(deep-research): SKILL.md router" 2>/dev/null || echo "skills dir not versioned — skipping commit"
```

---

### Task 2: references/engine.md — tool-selection table

**Files:**
- Create: `~/.claude/skills/deep-research/references/engine.md`

**Interfaces:**
- Consumes: nothing (leaf reference).
- Produces: the engine decision table that all three mode references cite by name (`references/engine.md`).

- [ ] **Step 1: Write `references/engine.md`**

Create the file with exactly:

````markdown
# Engine — tool selection

**Rule: prefer the cheapest tool that gets the data.** Firecrawl-first; fall
back to built-in tools when firecrawl is unneeded or its key/plan is absent.

| Need | Primary tool | Fallback |
|---|---|---|
| Broad discovery / "what's out there" | `firecrawl-search` | `WebSearch` |
| Enumerate a site's pages | `firecrawl-map` → `firecrawl-crawl` if bulk | — |
| Structured records from a page | `firecrawl-agent` | — |
| Single known URL, simple content | `firecrawl-scrape` | `WebFetch` |
| Save many primary docs to disk | `firecrawl-download` | `firecrawl-scrape` loop |
| General lookup, no firecrawl need / no key | `WebSearch` / `WebFetch` | — |

## Cost discipline

- Before the confirm gate, put an estimated step/credit count in `plan.md`
  (rough: 1 credit per scrape/agent page, search cheaper).
- If firecrawl errors with an auth/plan problem, drop to the fallback column and
  note the degradation in `sources.md` — do not silently abort.
- Never call `firecrawl-agent` (expensive) where a single `scrape` + manual read
  would do.
````

- [ ] **Step 2: Verify the table is present**

Run:
```bash
grep -c "firecrawl-" ~/.claude/skills/deep-research/references/engine.md
```
Expected: a number ≥ 6.

- [ ] **Step 3: Commit** (same pattern as Task 1 Step 4)

```bash
git -C ~/.claude add skills/deep-research/references/engine.md 2>/dev/null && \
git -C ~/.claude commit -m "feat(deep-research): engine reference" 2>/dev/null || echo "skipping commit"
```

---

### Task 3: references/synthesis.md — written-brief mode

**Files:**
- Create: `~/.claude/skills/deep-research/references/synthesis.md`

**Interfaces:**
- Consumes: `references/engine.md` (tool selection); `templates/brief.md` (deliverable shape, defined in Task 6); the run folder + `sources.md` from `SKILL.md`.
- Produces: `brief.md` in the run folder.

- [ ] **Step 1: Write `references/synthesis.md`**

````markdown
# Mode: Synthesis

Produce a written brief that answers the research question with cited findings.

## Steps

1. Decompose the question into 3–6 sub-questions; record them in `plan.md`.
2. For each, run `firecrawl-search` (see `engine.md`) to find candidate sources.
3. Read/scrape the strongest sources. Log each in `sources.md` as
   `url · title · retrieved-YYYY-MM-DD · sub-question it informs`.
4. **Cross-check** every material claim against ≥2 independent sources. Where
   sources conflict, record the conflict — do not silently pick one.
5. Write `brief.md` in the run folder from `templates/brief.md`:
   question, key findings (each with an inline `[n]` cite), analysis,
   recommendation, sources list.
6. Anything you could not source goes under an **Unverified** heading, labelled
   as such — never folded into the findings as fact.

## Done when

`brief.md` exists, every finding carries a citation resolving to `sources.md`,
and conflicts/unverified items are explicitly flagged.
````

- [ ] **Step 2: Verify**

Run:
```bash
grep -q "templates/brief.md" ~/.claude/skills/deep-research/references/synthesis.md && \
grep -q "Cross-check" ~/.claude/skills/deep-research/references/synthesis.md && echo OK
```
Expected: `OK`.

- [ ] **Step 3: Commit** (same pattern)

```bash
git -C ~/.claude add skills/deep-research/references/synthesis.md 2>/dev/null && \
git -C ~/.claude commit -m "feat(deep-research): synthesis reference" 2>/dev/null || echo "skipping commit"
```

---

### Task 4: references/extraction.md — structured-dataset mode

**Files:**
- Create: `~/.claude/skills/deep-research/references/extraction.md`

**Interfaces:**
- Consumes: `references/engine.md`; the user-supplied schema from the clarify phase; run folder + `sources.md`.
- Produces: `dataset.csv` and `dataset.json` in the run folder; raw agent JSON under `raw/`.

- [ ] **Step 1: Write `references/extraction.md`**

````markdown
# Mode: Extraction

Produce a structured dataset of records extracted across many sites.

## Steps

1. Confirm the schema from the clarify phase — an explicit field list, always
   including `source_url`. Example:
   `studio_name, city, principals, sectors, contact_email, fit_signal, source_url`.
   Write the schema into `plan.md`.
2. Build the target list: `firecrawl-map`/`firecrawl-search` to enumerate the
   sites/pages to extract from. Record the count in `plan.md` (drives the credit
   estimate).
3. For each target, run `firecrawl-agent` with the schema. Save the raw JSON
   response to `raw/<domain>.json`.
4. Normalise every record to the schema. **Missing field → `null`, never
   guessed.** Every row must carry its `source_url`.
5. Write merged outputs to the run folder:
   - `dataset.json` — array of record objects.
   - `dataset.csv` — one header row of the schema fields, one row per record.
6. Log each source site in `sources.md` with retrieval date.

## Done when

`dataset.csv` + `dataset.json` exist, row counts match, every row has a
`source_url`, and no field was fabricated.
````

- [ ] **Step 2: Verify**

Run:
```bash
grep -q "firecrawl-agent" ~/.claude/skills/deep-research/references/extraction.md && \
grep -q "never guessed" ~/.claude/skills/deep-research/references/extraction.md && echo OK
```
Expected: `OK`.

- [ ] **Step 3: Commit** (same pattern)

```bash
git -C ~/.claude add skills/deep-research/references/extraction.md 2>/dev/null && \
git -C ~/.claude commit -m "feat(deep-research): extraction reference" 2>/dev/null || echo "skipping commit"
```

---

### Task 5: references/dossier.md — source-gathering mode

**Files:**
- Create: `~/.claude/skills/deep-research/references/dossier.md`

**Interfaces:**
- Consumes: `references/engine.md`; target list from clarify phase; run folder + `sources.md`.
- Produces: primary docs under `raw/`; `dossier.md` index in the run folder.

- [ ] **Step 1: Write `references/dossier.md`**

````markdown
# Mode: Dossier

Gather primary documents/policies, preserve the raw material, and index them.

## Steps

1. Confirm the target docs from the clarify phase (e.g. an official standard, a
   procurement agreement). Prefer the **primary source** over commentary.
2. Fetch each into `raw/`: `firecrawl-download` (or `firecrawl-scrape` →
   `WebFetch` fallback) to `raw/<slug>.md`. Keep the original wording.
3. Write a one-page summary per doc: what it is, who issues it, the key
   requirements/clauses, and any dates/versions.
4. Write `dossier.md` — an index listing each doc: title, source URL, retrieval
   date, local `raw/` path, and its one-page summary (or a link to it).
5. Log every doc in `sources.md` with retrieval date.

## Done when

Each target doc is saved under `raw/`, summarised, and listed in `dossier.md`
with a resolvable source URL and retrieval date.
````

- [ ] **Step 2: Verify**

Run:
```bash
grep -q "primary source" ~/.claude/skills/deep-research/references/dossier.md && \
grep -q "raw/" ~/.claude/skills/deep-research/references/dossier.md && echo OK
```
Expected: `OK`.

- [ ] **Step 3: Commit** (same pattern)

```bash
git -C ~/.claude add skills/deep-research/references/dossier.md 2>/dev/null && \
git -C ~/.claude commit -m "feat(deep-research): dossier reference" 2>/dev/null || echo "skipping commit"
```

---

### Task 6: templates/run.md + templates/brief.md

**Files:**
- Create: `~/.claude/skills/deep-research/templates/run.md`
- Create: `~/.claude/skills/deep-research/templates/brief.md`

**Interfaces:**
- Consumes: nothing (leaf templates).
- Produces: `templates/run.md` (referenced by `SKILL.md` Plan phase) and `templates/brief.md` (referenced by `references/synthesis.md`).

- [ ] **Step 1: Write `templates/run.md`**

````markdown
# Research Run — {{TOPIC}}

- **Mode:** {{synthesis | extraction | dossier}}
- **Date:** {{YYYY-MM-DD}}
- **Question / target:** {{...}}
- **Source scope:** {{which sites / how broad}}
- **Depth:** {{quick | exhaustive}}
- **Schema (extraction only):** {{field list}}

## Tool plan

{{ordered list of tool calls per engine.md}}

## Estimated cost

{{~N steps / ~N firecrawl credits}}

## Confirm status

- [ ] User approved — execution may begin
````

- [ ] **Step 2: Write `templates/brief.md`**

````markdown
# {{TOPIC}} — Research Brief

_Mode: synthesis · {{YYYY-MM-DD}}_

## Question

{{the question, restated}}

## Key findings

- {{finding}} [1]
- {{finding}} [2]

## Analysis

{{synthesis across findings — what it means, tensions, confidence}}

## Recommendation

{{the one recommended path, trade-offs surfaced}}

## Unverified

- {{claim that could not be sourced — flagged, not asserted}}

## Sources

See `sources.md`. Inline `[n]` markers resolve to entries there.
````

- [ ] **Step 3: Verify both files exist**

Run:
```bash
ls ~/.claude/skills/deep-research/templates/
```
Expected: `brief.md  run.md`.

- [ ] **Step 4: Commit** (same pattern)

```bash
git -C ~/.claude add skills/deep-research/templates 2>/dev/null && \
git -C ~/.claude commit -m "feat(deep-research): run + brief templates" 2>/dev/null || echo "skipping commit"
```

---

### Task 7: Discovery verification + dry-run + docs

**Files:**
- Modify: `~/Documents/objects-of-agency/SKILLS-REF.md` (regenerated, not hand-edited)

**Interfaces:**
- Consumes: the complete skill from Tasks 1–6.
- Produces: confirmation the skill is discoverable and the router behaves; refreshed SKILLS-REF.

- [ ] **Step 1: Confirm file tree is complete**

Run:
```bash
find ~/.claude/skills/deep-research -type f | sort
```
Expected exactly:
```
.../SKILL.md
.../references/dossier.md
.../references/engine.md
.../references/extraction.md
.../references/synthesis.md
.../templates/brief.md
.../templates/run.md
```

- [ ] **Step 2: Dry-run the router (manual, no credits spent)**

In a Claude Code session, invoke `/deep-research` with a throwaway prompt like
"research the IGS Revit Content Standard requirements". Verify the model:
- asks only for missing clarify fields (should infer mode=dossier),
- writes a `plan.md` under `~/Documents/command-center/research/<date>-.../`,
- **stops at the confirm gate** without calling any firecrawl tool.

Expected: it halts at the gate. If it runs firecrawl before approval, fix the
gate wording in `SKILL.md` and re-run.

- [ ] **Step 3: Regenerate the skills reference**

Run:
```bash
python3 ~/.claude/bin/gen-skills-ref.py
```
Expected: `SKILLS-REF.md` regenerates and now lists `deep-research`. Verify:
```bash
grep -c "deep-research" ~/Documents/objects-of-agency/SKILLS-REF.md
```
Expected: ≥ 1.

- [ ] **Step 4: Commit the regenerated reference**

```bash
cd ~/Documents/objects-of-agency && \
git add SKILLS-REF.md && \
git commit -m "docs: register deep-research skill in SKILLS-REF"
```

---

## Self-Review

**Spec coverage:**
- 3 selectable modes → Tasks 3, 4, 5. ✓
- Firecrawl-first + fallback → Task 2 (engine.md), referenced by all modes. ✓
- Global skill path → Task 1 Step 1. ✓
- Central vault + configurable constant → Task 1 (`RESEARCH_VAULT`). ✓
- Clarify→plan→confirm→execute → Task 1 Run flow + Task 7 Step 2 gate check. ✓
- Router + progressive disclosure → Task 1 routes to one reference. ✓
- Per-run folder (plan/sources/raw + mode outputs) → templates Task 6, folder written in Task 1 Plan phase, populated per mode. ✓
- Research policies → Task 1 (canonical list) + reinforced per mode. ✓
- Engine decision table → Task 2. ✓
- Out-of-scope (no monitoring, no new primitives, no auto-publish) → honoured; not implemented. ✓

**Placeholder scan:** Template files intentionally use `{{...}}` and `- [ ]`
placeholders — these are the *skill's* fill-in tokens, not plan gaps. All plan
steps carry concrete file content. No TBD/TODO in the plan itself. ✓

**Type/name consistency:** `RESEARCH_VAULT`, run-folder pattern
`<vault>/<YYYY-MM-DD>-<topic-slug>/`, `sources.md`, `plan.md`, `dataset.csv/json`,
`brief.md`, `dossier.md`, and the three `references/<mode>.md` names are used
identically across Tasks 1–7. ✓

**Note on git:** `~/.claude/skills/` may not be a versioned repo; commit steps
degrade gracefully (`|| echo skipping`). Only the SKILLS-REF commit (Task 7) is
guaranteed to land in the objects-of-agency repo.
