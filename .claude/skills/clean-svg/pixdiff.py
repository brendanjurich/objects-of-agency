#!/usr/bin/env python3
"""Prove a cleaned SVG renders identically to its source. Stdlib + Pillow only.

Renders both files through Quick Look (`qlmanage`, present on every Mac) and
compares pixels. Both roots are forced to the same explicit size first —
otherwise the comparison just measures the intrinsic-size change that
clean_svg.py deliberately makes (Affinity's `width="100%"` → a real canvas).

Usage:
    python3 pixdiff.py SOURCE.svg CLEANED.svg [--size 1024]
"""

import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile

from PIL import Image, ImageChops

NUM = r"[-+]?[0-9]*\.?[0-9]+"


def normalised(src, size, workdir, name):
    svg = open(src, encoding="utf-8").read()
    # The prolog must go first — otherwise `<?xml … ?>` is mistaken for the root
    # tag and the attributes land inside the declaration, which kills the parse.
    svg = re.sub(r"<\?xml[^>]*\?>", "", svg)
    svg = re.sub(r"<!DOCTYPE[^>]*>", "", svg, flags=re.S).lstrip()

    root = re.match(r"<svg\b[^>]*>", svg)
    if not root:
        sys.exit(f"{src}: no <svg> root element found")
    vb = re.search(r'viewBox\s*=\s*"([^"]+)"', root.group(0))
    if not vb:
        sys.exit(f"{src}: no viewBox — cannot normalise for comparison")
    _, _, w, h = (float(n) for n in re.findall(NUM, vb.group(1)))
    scale = size / max(w, h)

    head = re.sub(r'\s(width|height)\s*=\s*"[^"]*"', "", root.group(0)[:-1])
    head += f' width="{w * scale:.0f}" height="{h * scale:.0f}">'
    dest = os.path.join(workdir, name)
    open(dest, "w", encoding="utf-8").write(head + svg[root.end():])
    return dest


def render(path, workdir):
    out = os.path.join(workdir, os.path.basename(path) + ".out")
    os.makedirs(out, exist_ok=True)
    subprocess.run(["qlmanage", "-t", "-s", "2048", "-o", out, path],
                   capture_output=True, check=True)
    png = os.path.join(out, os.path.basename(path) + ".png")
    if not os.path.exists(png):
        sys.exit(f"Quick Look produced no thumbnail for {path}")
    return Image.open(png).convert("RGBA")


def flatten(im, size):
    im = im.resize(size) if im.size != size else im
    return Image.alpha_composite(Image.new("RGBA", size, (255, 0, 255, 255)), im).convert("RGB")


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("source")
    ap.add_argument("cleaned")
    ap.add_argument("--size", type=int, default=1024)
    ap.add_argument("--keep", action="store_true", help="keep the rendered PNGs")
    args = ap.parse_args()

    work = tempfile.mkdtemp(prefix="clean-svg-")
    a = render(normalised(args.source, args.size, work, "a.svg"), work)
    b = render(normalised(args.cleaned, args.size, work, "b.svg"), work)

    # Magenta backdrop: any transparency difference shows up loudly.
    a, b = flatten(a, a.size), flatten(b, a.size)
    diff = ImageChops.difference(a, b)
    worst = max(max(band.getextrema()) for band in diff.split())
    total = a.size[0] * a.size[1]
    bad = sum(1 for p in diff.convert("L").getdata() if p > 8)
    pct = 100 * bad / total

    print(f"rendered {a.size[0]}×{a.size[1]}")
    print(f"  max channel delta : {worst}")
    print(f"  pixels differing  : {bad:,} / {total:,} ({pct:.3f}%)")

    if bad == 0:
        print("  PASS — pixel-identical")
    elif pct < 0.3:
        print("  SOFT PASS — sub-threshold. Confirm this is edge antialiasing or "
              "a layer you deliberately dropped, not a thinned stroke.")
        if args.keep:
            diff.save(os.path.join(work, "diff.png"))
    else:
        print(f"  FAIL — real visual difference. Renders kept in {work}")
        a.save(os.path.join(work, "source.png"))
        b.save(os.path.join(work, "cleaned.png"))
        ImageChops.invert(diff.convert("L")).save(os.path.join(work, "diff.png"))
        sys.exit(1)

    if not args.keep:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    main()
