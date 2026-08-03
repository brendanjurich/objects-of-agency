#!/usr/bin/env python3
"""Strip Affinity export cruft from an SVG so it imports cleanly into Lottie Labs.

Stdlib only (this repo has no build step and no lxml). Geometry is never
rewritten: every `d` / `points` string is compared byte-for-byte before and
after unless --precision is passed explicitly.

Usage:
    python3 clean_svg.py IN.svg [-o OUT.svg] [--drop-guides] [--precision N]
"""

import argparse
import math
import re
import sys
import xml.etree.ElementTree as ET
from collections import Counter

SVG = "http://www.w3.org/2000/svg"
XLINK = "http://www.w3.org/1999/xlink"
SERIF = "http://www.serif.com/"
XML = "http://www.w3.org/XML/1998/namespace"

ET.register_namespace("", SVG)
ET.register_namespace("xlink", XLINK)

# Declarations that are legal as SVG presentation attributes. Anything outside
# this set stays in `style` (Affinity emits nothing outside it).
PRESENTATION = {
    "fill", "fill-rule", "fill-opacity", "stroke", "stroke-width", "stroke-opacity",
    "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-dasharray",
    "stroke-dashoffset", "clip-rule", "clip-path", "opacity", "color",
    "font-family", "font-size", "font-weight", "font-style", "text-anchor",
    "letter-spacing", "dominant-baseline", "mix-blend-mode", "paint-order",
    "vector-effect", "visibility", "display",
}

STROKE_PROPS = {
    "stroke-linejoin", "stroke-miterlimit", "stroke-linecap",
    "stroke-dasharray", "stroke-dashoffset", "stroke-width", "stroke-opacity",
}

GEOMETRY_ATTRS = ("d", "points")

# NB: `artboard` is deliberately absent — the artboard group *contains* the
# artwork, so matching it here would let --drop-guides delete the drawing.
GUIDE_RE = re.compile(
    r"construction|guide|lock|boundary|clearspace|safe.?zone|"
    r"registration|bleed|crop|\U0001F512",
    re.I,
)

# Things Lottie's renderer cannot represent. Reported, never silently deleted.
UNSUPPORTED = {
    "filter": "filters/blurs are not part of the Lottie spec — bake into the artwork",
    "text": "live text does not import — convert to curves in Affinity first",
    "tspan": "live text does not import — convert to curves in Affinity first",
    "pattern": "pattern fills do not import — expand or replace with a solid",
    "image": "embedded rasters import as opaque bitmaps, not animatable shapes",
    "use": "<use> references are commonly dropped on import — expand the instance",
    "foreignObject": "not renderable by Lottie at all",
    "marker": "markers are not part of the Lottie spec",
    "symbol": "symbols only render via <use> — expand the instance",
}

warnings: list[str] = []
notes: list[str] = []


def warn(msg):
    warnings.append(msg)


def note(msg):
    notes.append(msg)


# ---------------------------------------------------------------- numbers ---

def fmt(x, places=6):
    """Shortest round-trip-safe decimal. Kills `-0` and trailing zeros."""
    if abs(x) < 10 ** -places:
        return "0"
    s = f"{round(x, places):.{places}f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def local(el):
    return el.tag.split("}")[-1] if isinstance(el.tag, str) else ""


def iter_parents(root):
    for parent in root.iter():
        for child in list(parent):
            yield parent, child


# -------------------------------------------------------------- transforms ---

IDENTITY = (1.0, 0.0, 0.0, 1.0, 0.0, 0.0)
NUM = r"[-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?"
OP_RE = re.compile(r"(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)")


def mul(a, b):
    """Compose two 2x3 matrices: apply `b`, then `a`."""
    a0, a1, a2, a3, a4, a5 = a
    b0, b1, b2, b3, b4, b5 = b
    return (
        a0 * b0 + a2 * b1,
        a1 * b0 + a3 * b1,
        a0 * b2 + a2 * b3,
        a1 * b2 + a3 * b3,
        a0 * b4 + a2 * b5 + a4,
        a1 * b4 + a3 * b5 + a5,
    )


def parse_transform(s):
    m = IDENTITY
    for name, raw in OP_RE.findall(s or ""):
        v = [float(n) for n in re.findall(NUM, raw)]
        if name == "matrix" and len(v) == 6:
            op = tuple(v)
        elif name == "translate":
            op = (1, 0, 0, 1, v[0], v[1] if len(v) > 1 else 0)
        elif name == "scale":
            op = (v[0], 0, 0, v[1] if len(v) > 1 else v[0], 0, 0)
        elif name == "rotate":
            r = math.radians(v[0])
            c, sn = math.cos(r), math.sin(r)
            op = (c, sn, -sn, c, 0, 0)
            if len(v) == 3:
                op = mul(mul((1, 0, 0, 1, v[1], v[2]), op), (1, 0, 0, 1, -v[1], -v[2]))
        elif name == "skewX":
            op = (1, 0, math.tan(math.radians(v[0])), 1, 0, 0)
        elif name == "skewY":
            op = (1, math.tan(math.radians(v[0])), 0, 1, 0, 0)
        else:
            warn(f"unrecognised transform op `{name}` left as-is")
            return None
        m = mul(m, op)
    return m


def is_identity(m, eps=1e-9):
    return all(abs(x - y) < eps for x, y in zip(m, IDENTITY))


def write_transform(el, m):
    if is_identity(m):
        el.attrib.pop("transform", None)
    else:
        el.set("transform", "matrix(" + ",".join(fmt(v) for v in m) + ")")


def collapse_transform_chains(root):
    """Fold `<g transform>`-only wrappers into their single child.

    Affinity nests an artboard offset, an artboard scale and a per-shape matrix
    three deep. Composition is exact matrix maths — no path data is touched.
    """
    removed = 0
    changed = True
    while changed:
        changed = False
        for parent, g in list(iter_parents(root)):
            if local(g) != "g":
                continue
            kids = list(g)
            if len(kids) != 1 or set(g.attrib) - {"transform"}:
                continue
            child = kids[0]
            outer = parse_transform(g.get("transform", ""))
            inner = parse_transform(child.get("transform", ""))
            if outer is None or inner is None:
                continue
            write_transform(child, mul(outer, inner))
            parent[list(parent).index(g)] = child
            removed += 1
            changed = True
            # Restart: the snapshot now holds pairs from the detached subtree,
            # and acting on those re-applies a matrix that is already folded in.
            break
    return removed


# ---------------------------------------------------------------- styling ---

def split_decls(text):
    out = {}
    for decl in text.split(";"):
        if ":" not in decl:
            continue
        k, v = decl.split(":", 1)
        out[k.strip()] = v.strip()
    return out


def rgb_to_hex(v):
    m = re.fullmatch(r"rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)", v.strip())
    if not m:
        return v
    return "#{:02x}{:02x}{:02x}".format(*(int(g) for g in m.groups()))


def apply_decls(el, decls, overwrite=True):
    leftover = []
    for k, v in decls.items():
        if k not in PRESENTATION:
            leftover.append(f"{k}:{v}")
            continue
        v = rgb_to_hex(v)
        if k in ("stroke-width", "stroke-dashoffset", "font-size") and v.endswith("px"):
            v = v[:-2]
        if overwrite or k not in el.attrib:
            el.set(k, v)
    if leftover:
        el.set("style", ";".join(leftover))
    else:
        el.attrib.pop("style", None)


def strip_at_rules(css):
    """Remove whole `@media {…}` / `@keyframes {…}` blocks, braces balanced.

    Their inner rules are conditional. Inlining one unconditionally silently
    applies it to every viewer — a reduced-motion block would freeze the
    artwork for everybody.
    """
    out, i, had = [], 0, False
    while i < len(css):
        at = css.find("@", i)
        if at < 0:
            out.append(css[i:])
            break
        out.append(css[i:at])
        had = True
        depth, j = 0, css.find("{", at)
        if j < 0:
            break
        while j < len(css):
            if css[j] == "{":
                depth += 1
            elif css[j] == "}":
                depth -= 1
                if depth == 0:
                    break
            j += 1
        i = j + 1
    return "".join(out), had


def inline_css(root):
    """Flatten a flat `.class {}` stylesheet onto the elements.

    Lottie Labs reads presentation attributes, not CSS. At-rules (`@media`,
    `@keyframes`) cannot be represented at all — they are left in place and
    reported so they get re-authored as real animation in the editor.
    """
    styles = [(p, s) for p, s in iter_parents(root) if local(s) == "style"]
    if not styles:
        return
    by_class = {}
    for el in root.iter():
        for c in (el.get("class") or "").split():
            by_class.setdefault(c, []).append(el)

    for parent, style_el in styles:
        css = re.sub(r"/\*.*?\*/", "", style_el.text or "", flags=re.S)
        css, has_at = strip_at_rules(css)
        applied = 0
        for sel, body in re.findall(r"([^{}@]+)\{([^{}]*)\}", css):
            sel = sel.strip()
            parts = [p.strip() for p in sel.split(",")]
            if not parts or not all(re.fullmatch(r"\.[\w-]+", p) for p in parts):
                # Percentages are @keyframes stops, already covered by the at-rule warning.
                if sel and not all(re.fullmatch(r"\d+%|from|to", p) for p in parts):
                    warn(f"CSS selector `{sel}` is not a flat class — left in <style>")
                continue
            decls = split_decls(body)
            for p in parts:
                for el in by_class.get(p[1:], []):
                    apply_decls(el, decls)
            applied += 1
            css = css.replace("{" + body + "}", "{}", 1)

        if has_at:
            warn("<style> contains at-rules (@media / @keyframes) — kept, along "
                 "with the class attributes they target. Lottie cannot import CSS "
                 "animation; re-author it on the timeline in Lottie Labs.")
        elif applied:
            parent.remove(style_el)
            for el in root.iter():
                el.attrib.pop("class", None)
            note(f"inlined {applied} CSS rule(s) onto presentation attributes")


def styles_to_attrs(root):
    for el in root.iter():
        if "style" in el.attrib:
            apply_decls(el, split_decls(el.get("style")), overwrite=False)


# ----------------------------------------------------------------- pruning ---

def has_stroke(el):
    s = el.get("stroke") or split_decls(el.get("style", "")).get("stroke")
    return bool(s) and s != "none"


def is_invisible(el):
    """A shape that paints nothing: Affinity's artboard bounds rects."""
    if local(el) not in ("rect", "path", "circle", "ellipse", "polygon", "line"):
        return False
    if len(el):
        return False
    fill = el.get("fill") or split_decls(el.get("style", "")).get("fill")
    return fill == "none" and not has_stroke(el) and "clip-path" not in el.attrib


def drop_dead_shapes(root):
    n = 0
    for parent, el in list(iter_parents(root)):
        if is_invisible(el):
            parent.remove(el)
            n += 1
    return n


NUMERIC_ATTRS = {
    "x", "y", "width", "height", "cx", "cy", "r", "rx", "ry",
    "x1", "y1", "x2", "y2", "offset", "stroke-width", "opacity",
    "fill-opacity", "stroke-opacity", "stroke-miterlimit",
}


def tidy_numbers(root):
    """Normalise Affinity's `-0` and trailing zeros on non-path attributes."""
    for el in root.iter():
        for k in list(el.attrib):
            v = el.get(k)
            if k in NUMERIC_ATTRS and re.fullmatch(NUM, v or ""):
                el.set(k, fmt(float(v)))


def tidy_groups(root):
    """Unwrap groups that only add nesting to the Lottie Labs layer panel.

    Two Affinity habits: a bare `<g>` left behind by a removed clip, and a
    `<g id="X">` wrapping one shape that carries the same name. A group with
    a transform, clip or opacity is real structure and is always kept.
    """
    n = 0
    changed = True
    while changed:
        changed = False
        for parent, g in list(iter_parents(root)):
            if local(g) != "g" or not len(g):
                continue
            attrs = set(g.attrib)
            i = list(parent).index(g)
            if not attrs:
                parent[i:i + 1] = list(g)
                n += 1
                changed = True
                break  # snapshot is stale — see collapse_transform_chains
            if attrs == {"id"} and len(g) == 1:
                child = g[0]
                cid = child.get("id", "")
                gid = g.get("id", "")
                if cid.startswith(gid) or gid.startswith(cid):
                    child.set("id", gid)
                    parent[i] = child
                    n += 1
                    changed = True
                    break
    return n


def drop_empty_groups(root):
    n = 0
    changed = True
    while changed:
        changed = False
        for parent, el in list(iter_parents(root)):
            if local(el) in ("g", "defs") and not len(el) and not (el.text or "").strip():
                parent.remove(el)
                n += 1
                changed = True
                break  # snapshot is stale — see collapse_transform_chains
    return n


def drop_noop_clips(root, vb):
    """Affinity clips the artboard to its own bounds. That clip clips nothing."""
    dead = set()
    for parent, cp in list(iter_parents(root)):
        if local(cp) != "clipPath":
            continue
        kids = list(cp)
        if len(kids) == 1 and local(kids[0]) == "rect":
            r = kids[0]
            box = [float(r.get(k, 0)) for k in ("x", "y", "width", "height")]
            if vb and all(abs(a - b) < 1e-6 for a, b in zip(box, vb)):
                dead.add(cp.get("id"))
                parent.remove(cp)
                continue
        warn(f"clipPath #{cp.get('id')} is a real clip — kept "
             "(Lottie Labs imports it as a mask layer)")
    if dead:
        for el in root.iter():
            ref = el.get("clip-path", "")
            if re.fullmatch(r"url\(#(.+)\)", ref or "") and \
                    re.fullmatch(r"url\(#(.+)\)", ref).group(1) in dead:
                del el.attrib["clip-path"]
    return len(dead)


def strip_cruft_attrs(root, doc_has_stroke):
    for el in root.iter():
        for k in list(el.attrib):
            if k.startswith(f"{{{SERIF}}}") or k == f"{{{XML}}}space":
                del el.attrib[k]
        if el is not root and not doc_has_stroke:
            for k in list(el.attrib):
                if k in STROKE_PROPS:
                    del el.attrib[k]
    root.attrib.pop("version", None)
    if not doc_has_stroke:
        for k in list(root.attrib):
            if k in STROKE_PROPS or k == "stroke":
                del root.attrib[k]


# --------------------------------------------------------------------- ids ---

def kebab(s):
    s = re.sub(r"[^\w\s-]", " ", s, flags=re.UNICODE)
    s = re.sub(r"[\s_]+", "-", s.strip())
    s = re.sub(r"-{2,}", "-", s).strip("-").lower()
    # An XML id may not start with a digit; Affinity's own fix is a leading `_`.
    return f"_{s}" if s[:1].isdigit() else s


def normalise_ids(root):
    """Prefer Affinity's human `serif:id` over its mangled `id`, kebab-cased.

    Ids that something references (`url(#…)`, `href="#…"`) are left verbatim —
    renaming one silently breaks the reference.
    """
    blob = ET.tostring(root, encoding="unicode")
    referenced = set(re.findall(r"url\(#([^)]+)\)", blob)) | set(
        re.findall(r'href="#([^"]+)"', blob))

    # serif:id is read before strip_cruft_attrs removes it.
    seen, renamed = set(), 0
    for el in root.iter():
        cur = el.get("id")
        if not cur or cur in referenced:
            if cur:
                seen.add(cur)
            continue
        human = el.get(f"{{{SERIF}}}id") or cur
        new = kebab(human)
        if not new:
            del el.attrib["id"]
            continue
        base, i = new, 2
        while new in seen:
            new, i = f"{base}-{i}", i + 1
        seen.add(new)
        if new != cur:
            el.set("id", new)
            renamed += 1
    return renamed


def audit_layers(root, drop_guides):
    """Report named layers; optionally delete Affinity's construction scaffolding."""
    kept, dropped = [], []
    for parent, el in list(iter_parents(root)):
        i = el.get("id")
        if not i:
            continue
        if GUIDE_RE.search(i):
            if drop_guides:
                parent.remove(el)
                dropped.append(i)
            else:
                kids = len(list(el.iter())) - 1
                warn(f"`{i}` (<{local(el)}>, {kids} descendant(s)) looks like "
                     "construction/guide scaffolding — check it, then re-run "
                     "with --drop-guides to delete it")
        elif local(el) != "clipPath":
            kept.append(i)
    return kept, dropped


def scan_unsupported(root):
    for el in root.iter():
        t = local(el)
        if t in UNSUPPORTED:
            warn(f"<{t}> present — {UNSUPPORTED[t]}")
        if el.get("mix-blend-mode"):
            warn("mix-blend-mode is not supported by the Lottie renderer")
        if el.get("vector-effect") == "non-scaling-stroke":
            warn("vector-effect=non-scaling-stroke does not survive import")
    if root.findall(f".//{{{SVG}}}linearGradient") or root.findall(f".//{{{SVG}}}radialGradient"):
        note("gradients import as Lottie gradient fills — verify stop positions")


# ------------------------------------------------------------------- shell ---

def geometry(root):
    return [el.get(a) for el in root.iter() for a in GEOMETRY_ATTRS if el.get(a)]


def round_geometry(root, places):
    def r(m):
        return fmt(float(m.group(0)), places)
    for el in root.iter():
        for a in GEOMETRY_ATTRS:
            if el.get(a):
                el.set(a, re.sub(NUM, r, el.get(a)))


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("src")
    ap.add_argument("-o", "--out")
    ap.add_argument("--drop-guides", action="store_true",
                    help="delete CONSTRUCTION / LOCK / boundary layers")
    ap.add_argument("--precision", type=int, default=None,
                    help="round path coordinates to N places (default: never — "
                         "geometry stays byte-identical and is asserted)")
    args = ap.parse_args()

    raw = open(args.src, encoding="utf-8").read()
    before_bytes = len(raw.encode())
    raw = re.sub(r"<\?xml[^>]*\?>", "", raw)
    raw = re.sub(r"<!DOCTYPE[^>]*>", "", raw, flags=re.S)

    root = ET.fromstring(raw)
    if local(root) != "svg":
        sys.exit("not an SVG root element")

    before_geo = geometry(root)
    vb = None
    if root.get("viewBox"):
        vb = [float(n) for n in re.findall(NUM, root.get("viewBox"))]
        # Lottie Labs wants an explicit canvas, not width="100%".
        root.set("width", fmt(vb[2]))
        root.set("height", fmt(vb[3]))
    else:
        warn("no viewBox — Lottie Labs will guess the canvas size")

    inline_css(root)
    styles_to_attrs(root)
    # Only meaningful once CSS is on the elements — a stroke declared in a
    # stylesheet is still a stroke, and stripping its width would thin the art.
    doc_has_stroke = any(has_stroke(el) for el in root.iter())
    renamed = normalise_ids(root)
    strip_cruft_attrs(root, doc_has_stroke)
    dead = drop_dead_shapes(root)
    clips = drop_noop_clips(root, vb)
    collapsed = collapse_transform_chains(root) + tidy_groups(root)
    empties = drop_empty_groups(root)
    tidy_numbers(root)
    layers, dropped = audit_layers(root, args.drop_guides)
    if dropped:
        empties += drop_empty_groups(root)
        # The construction layer is usually the only stroked thing in the file.
        if not any(has_stroke(el) for el in root.iter()):
            strip_cruft_attrs(root, False)
    scan_unsupported(root)
    if len(list(root)) > 4 or len(root.findall(f".//{{{SVG}}}clipPath")) > 2:
        warn("this looks like a multi-artboard sheet, not one piece of artwork — "
             "export the single artboard you want to animate and clean that")

    if args.precision is not None:
        round_geometry(root, args.precision)
        warn(f"--precision {args.precision} rewrote path data — the geometry "
             "gate is disabled; eyeball the result against the source")
    else:
        # Deletions are legitimate (--drop-guides); mutations never are.
        after_geo = geometry(root)
        assert not (Counter(after_geo) - Counter(before_geo)), \
            "GEOMETRY DRIFT — surviving path data does not match the source"
        lost = len(before_geo) - len(after_geo)

    ET.indent(root, space="  ")
    out = ET.tostring(root, encoding="unicode")
    out = re.sub(r"\s*/>", "/>", out).rstrip() + "\n"

    dest = args.out or args.src.rsplit(".", 1)[0] + "-clean.svg"
    open(dest, "w", encoding="utf-8").write(out)

    after = len(out.encode())
    delta = 100 * (before_bytes - after) / max(before_bytes, 1)
    print(f"{args.src} → {dest}")
    print(f"  {before_bytes:,} B → {after:,} B ({delta:+.0f}%)")
    print(f"  removed: {dead} dead shape(s), {clips} no-op clip(s), "
          f"{collapsed} transform wrapper(s), {empties} empty group(s)")
    print(f"  ids: {renamed} normalised" + (f", dropped {len(dropped)} guide layer(s)"
                                            if dropped else ""))
    print(f"  layers for Lottie Labs: {', '.join(layers) if layers else '(none named)'}")
    for n in dict.fromkeys(notes):
        print(f"  note: {n}")
    for w, n in Counter(warnings).items():
        print(f"  WARNING: {w}" + (f" (×{n})" if n > 1 else ""))
    if args.precision is None:
        print(f"  gate: surviving path data byte-identical to source ✓"
              + (f" ({lost} path(s) deliberately deleted)" if lost else ""))


if __name__ == "__main__":
    main()
