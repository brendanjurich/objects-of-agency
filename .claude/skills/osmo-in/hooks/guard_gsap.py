#!/usr/bin/env python3
"""PostToolUse guard for osmo-in: after a Write/Edit to src/js or src/css in
the website repo, reject a CDN GSAP load or a site-wide GSAP default. Webflow's
GSAP integration supplies window.gsap; a second copy clobbers CustomEase, and
Osmo's gsap.defaults/registerEase rewrite every tween on the site.

Exit 2 shows stderr to Claude (the write already happened, so it must be undone).
"""
import json, os, re, sys

REPO_MARK = "/01-projects/objects-of-agency-website/"
PATTERNS = [
    (re.compile(r"(cdn\.jsdelivr\.net/npm/gsap|unpkg\.com/gsap|cdnjs\.cloudflare\.com/ajax/libs/gsap)"),
     "loads GSAP from a CDN — reuse window.gsap from Webflow's integration"),
    (re.compile(r"gsap\.defaults\s*\("),
     "sets gsap.defaults() — that rewrites tween defaults site-wide"),
    (re.compile(r"registerEase\s*\("),
     "calls registerEase() — a global ease registration; name an ease per tween instead"),
]


def main():
    data = json.load(sys.stdin)
    path = (data.get("tool_input") or {}).get("file_path", "")
    full = os.path.realpath(path)
    i = full.find(REPO_MARK)
    if i < 0 or not re.match(r"src/(js|css)/", full[i + len(REPO_MARK):]):
        return
    try:
        text = open(full, encoding="utf-8").read()
    except OSError:
        return
    # Adaptation banners name what was removed, so comments don't count.
    # Blank them but keep the newlines, so line numbers stay true.
    text = re.sub(r"/\*.*?\*/", lambda m: "\n" * m.group().count("\n"), text, flags=re.S)
    text = re.sub(r"(^|\s)//.*", r"\1", text)
    hits = []
    for n, line in enumerate(text.splitlines(), 1):
        for rx, why in PATTERNS:
            if rx.search(line):
                hits.append(f"  {os.path.basename(full)}:{n} {why}\n    {line.strip()[:120]}")
    if hits:
        sys.stderr.write("osmo-in house rule broken (CLAUDE.md → GSAP):\n"
                         + "\n".join(hits)
                         + "\nRemove these lines before going on.\n")
        sys.exit(2)


if __name__ == "__main__":
    main()
