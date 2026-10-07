#!/usr/bin/env python3
"""icon-release build + gates. Run from 02-brand/oa-logo/icons/.

  python3 icons.py inventory          # Step 0: md5, size, mode of every master
  python3 icons.py svgs  [--out DIR]  # Steps 1-2: oa-icon-light/dark.svg + oa-favicon.svg
  python3 icons.py ico   [--out DIR]  # Step 3: favicon.ico, 16+32+48 hand-packed
  python3 icons.py audit [--dir DIR]  # Step 4: safe-zone audit of the built raster set

Every gate exits non-zero with a message naming the file and the number.
Needs: python3, `pip3 install Pillow`.
"""
import argparse, glob, hashlib, math, os, re, struct, sys

from PIL import Image

RAW = "raw-files"


def fail(msg):
    sys.exit(f"GATE FAILED — {msg}")


# ---------- Step 0 ----------
def inventory(_):
    for f in sorted(glob.glob(f"{RAW}/*/*.png") + glob.glob(f"{RAW}/svg/*.svg")):
        md5 = hashlib.md5(open(f, "rb").read()).hexdigest()
        extra = ""
        if f.endswith(".png"):
            im = Image.open(f)
            extra = f"  {im.size[0]}x{im.size[1]} {im.mode}"
            if "A" in im.mode:
                extra += "  ← ALPHA (defect on apple-touch / maskable)"
        print(f"{md5}  {f}{extra}")


# ---------- Steps 1-2 ----------
def extract(f):
    s = open(f, encoding="utf-8").read()
    ds = re.findall(r'\sd="([^"]+)"', s)
    if len(ds) != 1:
        fail(f"{f}: expected 1 path, got {len(ds)}")
    bg = re.search(r'<rect id="BG"[^>]*fill:(#[0-9a-fA-F]{6})', s)
    fg = re.search(r'\sd="[^"]+"\s+style="fill:(#[0-9a-fA-F]{6})', s)
    if not (bg and fg):
        fail(f"{f}: no BG rect fill or path fill found — has the Affinity layer naming changed?")
    return ds[0], bg.group(1), fg.group(1)


TPL = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" '
       'fill-rule="evenodd" clip-rule="evenodd">\n'
       '  <rect width="48" height="48" fill="{bg}"/>\n'
       '  <path fill="{fg}" d="{d}"/>\n'
       '</svg>\n')

COMBINED = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill-rule="evenodd" clip-rule="evenodd">\n'
            '  <style>\n'
            '    .bg{{fill:{lbg}}}\n'
            '    .fg{{fill:{lfg}}}\n'
            '    @media (prefers-color-scheme:dark){{.bg{{fill:{dbg}}}.fg{{fill:{dfg}}}}}\n'
            '  </style>\n'
            '  <rect class="bg" width="48" height="48"/>\n'
            '  <path class="fg" d="{d}"/>\n'
            '</svg>\n')


def svgs(a):
    v = {}
    for name in ("light", "dark"):
        src = f"{RAW}/svg/oa-icon-{name}.svg"
        d, bg, fg = extract(src)
        out = os.path.join(a.out, f"oa-icon-{name}.svg")
        open(out, "w", encoding="utf-8").write(TPL.format(bg=bg, fg=fg, d=d))
        if extract_d(out) != d:
            fail(f"{out}: d string is not byte-identical to {src}")
        v[name] = (d, bg, fg)
        print(f"wrote {out}  (d byte-identical ✓)")
    (ld, lbg, lfg), (dd, dbg, dfg) = v["light"], v["dark"]
    if ld != dd:
        fail("light and dark geometry differ — build oa-favicon.svg by hand with the "
             "two-group display-toggle fallback (SKILL.md Step 2)")
    out = os.path.join(a.out, "oa-favicon.svg")
    open(out, "w", encoding="utf-8").write(COMBINED.format(lbg=lbg, lfg=lfg, dbg=dbg, dfg=dfg, d=ld))
    if extract_d(out) != ld:
        fail(f"{out}: d string is not byte-identical to the masters")
    print(f"wrote {out}  (single geometry, class-swapped fills ✓)")


def extract_d(f):
    return re.search(r'\sd="([^"]+)"', open(f, encoding="utf-8").read()).group(1)


# ---------- Step 3 ----------
def ico(a):
    # Pillow's ICO writer silently drops the extra sizes, so pack by hand.
    sizes = [16, 32, 48]
    blobs = []
    for s in sizes:
        p = f"{RAW}/favicon/oa-favicon-{s}.png"
        got = Image.open(p).size
        if got != (s, s):
            fail(f"{p} is {got[0]}x{got[1]}, expected {s}x{s}")
        blobs.append((s, open(p, "rb").read()))
    header = struct.pack("<HHH", 0, 1, len(blobs))
    offset = 6 + 16 * len(blobs)
    entries = data = b""
    for s, png in blobs:
        entries += struct.pack("<BBBBHHII", s, s, 0, 0, 1, 32, len(png), offset)
        offset += len(png)
        data += png
    out = os.path.join(a.out, "favicon.ico")
    open(out, "wb").write(header + entries + data)
    got = sorted(Image.open(out).ico.sizes())
    if got != [(16, 16), (32, 32), (48, 48)]:
        fail(f"{out} holds sizes {got}, expected 16/32/48")
    print(f"wrote {out}  (16+32+48 ✓)")


# ---------- Step 4 ----------
def measure(f):
    im = Image.open(f)
    alpha = "A" in im.mode
    im = im.convert("RGB")
    w, h = im.size
    px = im.load()
    bg = px[0, 0]
    corners_ok = all(px[x, y] == bg for x, y in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)])
    cx, cy = (w - 1) / 2, (h - 1) / 2
    maxr, xs, ys = 0, [], []
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) > 30:
                maxr = max(maxr, math.hypot(x - cx, y - cy))
                xs.append(x)
                ys.append(y)
    off = max(abs((min(xs) + max(xs)) / 2 - cx), abs((min(ys) + max(ys)) / 2 - cy)) if xs else 0
    return (2 * maxr) / w, corners_ok, alpha, off


TARGETS = [  # file, purpose, target note
    ("oa-icon-maskable-512.png", "maskable (cropped)", "≈61%, hard limit ≤80%"),
    ("oa-manifest-icon-512.png", "any (uncropped)", "~71–79%"),
    ("oa-manifest-icon-192.png", "any (uncropped)", "~71–79%"),
    ("oa-apple-touch-icon.png", "iOS tile, no alpha", "~78–80%"),
    (f"{RAW}/favicon/oa-favicon-16.png", "ICO payload", "~75%"),
    (f"{RAW}/favicon/oa-favicon-32.png", "ICO payload", "~75%"),
    (f"{RAW}/favicon/oa-favicon-48.png", "ICO payload", "~75%"),
]


def audit(a):
    fails = []
    print(f"{'file':40} {'radial':>7} {'centre':>7}  corners alpha  target")
    for name, purpose, target in TARGETS:
        f = os.path.join(a.dir, name)
        if not os.path.exists(f):
            fails.append(f"{f} missing")
            continue
        ratio, corners, alpha, off = measure(f)
        print(f"{name:40} {ratio:6.1%} {off:5.1f}px  {str(corners):7} {str(alpha):5}  {target}  [{purpose}]")
        if off > 2:
            fails.append(f"{name}: mark is {off:.1f}px off centre (≤2px)")
        if name.startswith("oa-icon-maskable"):
            if ratio > 0.80:
                fails.append(f"{name}: radial extent {ratio:.1%} exceeds the 80% hard limit — re-export at ≈61%")
            if not corners or alpha:
                fails.append(f"{name}: corners must be solid background with no alpha — the OS mask shows a wedge")
        if name == "oa-apple-touch-icon.png" and alpha:
            fails.append(f"{name}: has alpha — iOS fills it black")
    mask = os.path.join(a.dir, "oa-icon-maskable-512.png")
    anyf = os.path.join(a.dir, "oa-manifest-icon-512.png")
    if os.path.exists(mask) and os.path.exists(anyf) and open(mask, "rb").read() == open(anyf, "rb").read():
        fails.append("maskable and any-512 are byte-identical — they need different paddings")
    if fails:
        fail("tell Brendan which file to re-export and to what number; don't pad or "
             "rescale his artwork:\n  " + "\n  ".join(fails))
    print("audit ✓")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("inventory").set_defaults(fn=inventory)
    for name, fn in (("svgs", svgs), ("ico", ico)):
        sp = sub.add_parser(name)
        sp.add_argument("--out", default=".", help="output directory (default: here)")
        sp.set_defaults(fn=fn)
    sp = sub.add_parser("audit")
    sp.add_argument("--dir", default=".", help="directory holding the built set (default: here)")
    sp.set_defaults(fn=audit)
    a = p.parse_args()
    if not os.path.isdir(RAW):
        sys.exit(f"No {RAW}/ here — run from 02-brand/oa-logo/icons/ (cwd is {os.getcwd()})")
    a.fn(a)


if __name__ == "__main__":
    main()
