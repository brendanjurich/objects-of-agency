---
name: Cross-session context — Claude chat and Claude Code
description: User works across both Claude chat and Claude Code (VS Code). architecture.md is the canonical shared reference between sessions.
type: feedback
---

Build sessions go between Claude chat (browser) and Claude Code (VS Code). Neither session has full context of the other by default.

**Why:** The user uses Claude chat for design decisions, planning, and exploration; Claude Code for implementation. Context built in one doesn't automatically carry to the other.

**How to apply:**
- Always read `docs/architecture.md` at the start of a session — it's the canonical project reference maintained across both environments.
- At the end of any session that changes architecture, decisions, or key implementation details, update `docs/architecture.md` so that context is available in the next session regardless of which tool is used.
- If the user shares a document or summary from a Claude chat session, treat it as authoritative context to be merged into architecture.md — do not discard it.
