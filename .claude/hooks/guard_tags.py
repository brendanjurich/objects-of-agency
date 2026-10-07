#!/usr/bin/env python3
"""PreToolUse guard: jsDelivr tags are immutable. Blocks any git command that
moves, deletes or force-pushes a tag. Webflow pins exact tags, so a re-pointed
tag serves different code under a URL that looks unchanged, and jsDelivr may
keep serving the old bytes from cache.

Registered from both session roots: this repo's .claude/settings.json and the
command centre's .claude/settings.json. Exit 2 blocks the call.
"""
import json, re, sys

# `git [-C dir] [-c k=v] <sub>` — the subcommand itself, not a word in a message.
GIT = r"\bgit(?:\s+-[Cc]\s+\S+)*\s+"
RULES = [
    (GIT + r"tag\b[^;&|]*\s(-f|--force)\b", "git tag -f re-points an existing tag"),
    (GIT + r"tag\b[^;&|]*\s(-d|--delete)\b", "git tag -d deletes a tag"),
    (GIT + r"push\b[^;&|]*\s(--delete|-d)\b[^;&|]*\bv\d", "git push --delete removes a published tag"),
    (GIT + r"push\b[^;&|]*\s:(refs/tags/)?v\d", "git push :tag deletes a published tag"),
    (GIT + r"push\b(?=[^;&|]*\s(-f|--force|--force-with-lease)\b)(?=[^;&|]*(--tags|refs/tags|\bv\d+\.\d+))",
     "force-pushing tags rewrites published tags"),
]


def main():
    cmd = (json.load(sys.stdin).get("tool_input") or {}).get("command", "")
    cmd = re.sub(r"'[^']*'|\"(?:[^\"\\]|\\.)*\"", "''", cmd, flags=re.S)  # quoted text is data
    for rx, why in RULES:
        if re.search(rx, cmd):
            sys.stderr.write(
                f"Blocked: {why}. jsDelivr tags are immutable — any change ships "
                f"as a NEW tag (next v1.0.X). If a tag genuinely must be rewritten, "
                f"Brendan runs it himself.\n")
            sys.exit(2)


if __name__ == "__main__":
    main()
