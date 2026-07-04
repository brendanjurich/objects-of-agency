# Command Centre — Design Spec

**Date:** 2026-07-04
**Status:** Approved design, pending implementation plan
**Owner:** Brendan Jurich · built with Claude Code

## Purpose

A single canonical workspace — `~/Documents/command-center/` — that acts as
Brendan's second brain and business OS. One folder opened in VS Code where he
and Claude see every business document in the explorer and co-edit live.
Houses all projects, strategy, research, and context for Objects of Agency,
organised so new work always has an obvious home.

This is piece #3 of the decomposition agreed 2026-06-11 (skills quick-ref →
workspace map → command centre). The workspace map (#2) is delivered *inside*
this build as an auto-generated `MAP.md`, not as a prerequisite.

## Decisions (settled in brainstorming, 2026-07-04)

| Decision | Choice |
|---|---|
| Relationship to `~/Documents/ OBJECTS OF AGENCY/` (legacy Finder folder, ~8GB) | **Selective migration.** Command centre is canonical for working/text documents. Heavy binaries stay in the Finder folder, linked from markdown. Migration is a guided pass, not a bulk move. |
| Website repo location | **Moved inside**, to `command-center/projects/objects-of-agency/`. Keeps its own git history, remote, and name. Claude project memory re-keyed to the new path. |
| Scope | **Business + personal development.** No family/house/health admin until the business structure proves itself. |
| Versioning | **Private GitHub repo, text-only.** Binaries and sensitive material gitignored. |
| Architecture | **Projects + Domains.** Bounded builds in `projects/` (one collapsible folder each); ongoing functions as flat top-level domains. |

## Folder structure

```
~/Documents/command-center/
├── CLAUDE.md                  # the OS: conventions, precedence, how we co-work
├── FOUNDER.md                 # founder & business context (moved from website repo)
├── MAP.md                     # auto-generated workspace index — never hand-edited
├── inbox/                     # capture zone; unfiled material lands here, gets swept
├── projects/                  # bounded builds (start/finish), one folder each
│   └── objects-of-agency/     # website repo, moved in, own git + remote
├── brand/                     # identity, voice, positioning
├── marketing/                 # content strategy & material, social platforms, campaigns
├── sales/                     # pricing (Blair Enns), trade program, outreach & lead gen,
│                              # proposals, presentations
├── growth/                    # growth strategy, SEO/AEO
├── operations/                # frameworks, policies, legal (open Ts&Cs thread), admin
├── research/                  # deep-research vault — pre-exists, absorbed as-is
├── pd/                        # personal development
├── archive/                   # finished projects retire here
└── _system/                   # templates, scripts (MAP.md generator)
```

Rules:

- **Shallow by default.** Each domain gets a one-line `README.md` stating what
  belongs there. Subfolders emerge from real content — no empty scaffolding.
- **Naming:** kebab-case folders; `YYYY-MM-DD-` prefix on dated documents
  (sorting mechanism — matches the research vault convention). All
  human-readable dates (inside docs, headers, MAP.md) are **DD-MM-YYYY**.
- **Lead generation lives in `sales/`** — the GTM is a single channel (direct
  outreach to design studios), so outreach *is* sales. `growth/` holds
  strategy and SEO/AEO only.
- **Future projects** (e.g. the IGS Revit/BIM pipeline) each get one folder
  under `projects/`; completed ones move to `archive/`.

## Git & privacy

- `git init` at the command-centre root; private GitHub repo under
  `brendanjurich`.
- `.gitignore` excludes:
  - `projects/objects-of-agency/` (nested repo with its own remote — ignored
    by the outer repo for clarity),
  - heavy binaries (`*.pdf`, images, video, archives, design files),
  - `**/private/` — a convention: any folder named `private/` never leaves
    the machine (finance, legal identifiers, anything sensitive).
- Text/strategy docs get history + off-machine backup, which later enables
  cloud agents and context-farming without re-architecture.
- Never commit secrets, API keys, tokens, or `.env` files (standing rule).

## VS Code + Claude layer

- **One folder to open:** `command-center/` is the daily workspace. The
  website repo appears as one collapsible project. No multi-root workspace.
- **Extensions:** audit current install; add only the useful non-code layer —
  markdown rendering, PDF/Office viewing in-editor, Excalidraw. Keep the
  existing theme and config; no wholesale profile import.
- **CLAUDE.md hierarchy:** command-centre `CLAUDE.md` = global business
  context and workspace conventions, importing `FOUNDER.md`. The website
  repo's own `CLAUDE.md` is untouched and takes precedence when working
  inside it. `.claude/FOUNDER-CONTEXT.md` moves out of the website repo to
  `command-center/FOUNDER.md` (repo keeps no copy; the file is currently
  tracked-and-modified on `dev`, so its removal is committed).
- **Memory re-key:** `~/.claude/projects/-Users-brendanjurich-Documents-objects-of-agency/`
  is renamed to match the repo's new path so auto-memory and history survive
  the move.
- **`/deep-research` vault:** `RESEARCH_VAULT` already points at
  `~/Documents/command-center/research/` — no change; the existing IGS
  dossier is absorbed in place.
- **MAP.md generator:** small script in `_system/scripts/`, same pattern as
  the SKILLS.md generator — reads the live tree, regenerates the index.
  Never hand-maintained.

## Migration plan (one session, reversible at each step)

1. Scaffold the structure (research/ already exists).
2. `git init`, `.gitignore`, first commit, create private GitHub repo, push.
3. Move the website repo into `projects/`; re-key Claude project memory;
   verify `git status`, `npm run build`, and remotes still work.
4. Move `FOUNDER-CONTEXT.md` → `FOUNDER.md`; commit its removal in the
   website repo; write the command-centre `CLAUDE.md`.
5. Install the agreed VS Code extensions; open the new folder.
6. Build the MAP.md generator; generate the first index.
7. Guided selective pass over ` OBJECTS OF AGENCY`: pick strategy/text docs
   to move (binaries stay, linked from markdown).

Precondition for step 3: the website repo's working tree changes
(`.claude/FOUNDER-CONTEXT.md`, `.gitignore`) are committed or intentionally
carried before the move.

## Workflow upgrades (explicitly phase 2 — after this build)

Current Claude usage is website-centric (deploy loop, research, graphify).
The structure itself is the multiplier; no playbook workflows are built now.
First candidate when launch focus allows: a **`/research-lead` skill** —
pre-call brief on an interior-design studio before direct outreach, aimed at
the decided GTM channel. Content atomizer, SEO tooling, and scheduled
routines wait until there is content and a lead list to feed them.

## Success criteria

- Opening `~/Documents/command-center/` in VS Code shows the whole business
  as a navigable tree, website repo collapsible under `projects/`.
- Website repo functions identically post-move: `git status` clean-or-known,
  remote pushes work, `npm run build` passes, Claude memory intact.
- `MAP.md` regenerates from the live tree with one command.
- A new document created today has one obvious home; nothing new lands in
  the legacy Finder folder.
- Private GitHub repo holds text history; no binaries, secrets, or
  `private/` content pushed.
