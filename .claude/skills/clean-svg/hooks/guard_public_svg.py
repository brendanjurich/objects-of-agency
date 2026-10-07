#!/usr/bin/env python3
"""PreToolUse guard for clean-svg: no SVG lands in the public website repo
outside src/svg/ or src/icons/. Checks Write/Edit file paths and, for Bash,
the `-o` target of clean_svg.py plus the destination of cp/mv.

Exit 2 blocks the call; stderr is the reason Claude sees.
"""
import json, os, shlex, sys

REPO_MARK = "/01-projects/objects-of-agency-website/"
ALLOWED = ("src/svg/", "src/icons/")


def offending(path, cwd):
    if not path.lower().endswith(".svg"):
        return None
    full = os.path.realpath(os.path.join(cwd, os.path.expanduser(path)))
    i = full.find(REPO_MARK)
    if i < 0:
        return None
    rel = full[i + len(REPO_MARK):]
    return None if rel.startswith(ALLOWED) else rel


def bash_targets(cmd):
    try:
        toks = shlex.split(cmd, posix=True)
    except ValueError:
        return []
    out = []
    for i, t in enumerate(toks):
        if t in ("-o", "--output") and i + 1 < len(toks):
            out.append(toks[i + 1])
    # cp/mv destination = last arg of each simple command
    seg = []
    for t in toks + [";"]:
        if t in (";", "&&", "||", "|"):
            if seg and os.path.basename(seg[0]) in ("cp", "mv") and len(seg) > 2:
                dest = seg[-1]
                if dest.lower().endswith(".svg"):
                    out.append(dest)
                else:  # directory destination: check each source name inside it
                    out += [os.path.join(dest, os.path.basename(s))
                            for s in seg[1:-1] if not s.startswith("-")]
            seg = []
        else:
            seg.append(t)
    return out


def main():
    data = json.load(sys.stdin)
    cwd = data.get("cwd") or os.getcwd()
    ti = data.get("tool_input") or {}
    if data.get("tool_name") == "Bash":
        paths = bash_targets(ti.get("command", ""))
    else:
        paths = [ti.get("file_path", "")]
    for p in paths:
        rel = offending(p, cwd)
        if rel:
            sys.stderr.write(
                f"Blocked: {rel} would put an SVG in the PUBLIC website repo "
                f"outside src/svg/ or src/icons/. Anything committed there stays "
                f"in public history. Write cleaned brand assets to "
                f"02-brand/oa-logo/clean-svg/ in the command centre instead. If "
                f"this file is genuinely shipped by the site, target src/svg/.\n")
            sys.exit(2)


if __name__ == "__main__":
    main()
