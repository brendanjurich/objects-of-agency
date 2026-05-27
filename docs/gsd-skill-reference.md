# GSD Skill Reference

Installed: May 4, 2026. Use these slash commands in Claude Code chat.

## When to use what

### Starting a session
- `/gsd-resume-work` — restores full context (git state, memory, recent work). Use every session start.
- `/gsd-health` — quick project health check: stale branches, uncommitted work, broken patterns.

### Planning a feature
- `/gsd-plan-phase` — researches the problem, designs a plan, gets approval before touching code.
- `/gsd-discuss-phase` — Socratic exploration before committing to an approach.
- `/gsd-spike` — time-boxed investigation of an unknown (e.g. "how does Swiper handle this edge case?").

### Executing
- `/gsd-execute-phase` — runs an approved plan step by step with checkpoints.
- `/gsd-fast` — lightweight version for smaller tasks.

### Debugging
- `/gsd-debug` — scientific debugging: forms hypotheses, tests them, tracks what's been ruled out.
- `/gsd-forensics` — deep post-mortem on why something broke.

### Reviewing / verifying
- `/gsd-verify-work` — checks that completed work achieved its goal, not just that tasks are ticked.
- `/gsd-audit-fix` — finds issues and applies fixes in one pass.
- `/gsd-code-review` — code quality review at configurable depth.

### Shipping
- `/gsd-ship` — runs final checks and prepares a release.
- `/gsd-milestone-summary` — summary of what was built across a milestone.

---

## Priority three for this project

1. `/gsd-resume-work` — every session start
2. `/gsd-debug` — the moment a fix doesn't work on the first attempt
3. `/gsd-plan-phase` — before any carousel/animation/JS work

---

## Session workflow

```
/clear              ← when switching tasks or starting fresh
/gsd-resume-work    ← always after clear
```

Use `/clear` when switching contexts (advisory → build, one feature → another). Don't clear mid-task.
