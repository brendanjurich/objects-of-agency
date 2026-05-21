---
name: Update architecture.md after significant sessions
description: Always update docs/architecture.md at the end of sessions that introduce new decisions, fixes, or architectural changes
type: feedback
---

Update `docs/architecture.md` proactively at the end of any session that introduces new architectural decisions, significant bug fixes, or changes to how core systems work (nav, loader, hero, delivery chain, etc.).

**Why:** The user relies on architecture.md as the canonical project reference for starting new Claude sessions. If it falls out of date, they have to manually prompt for a summary and then ask for an update — two steps that should be one.

**How to apply:** When wrapping up a session that changed anything architectural, update the relevant sections of `docs/architecture.md` without waiting to be asked. Commit the update as part of the session's final commit, or as a standalone `docs:` commit.
