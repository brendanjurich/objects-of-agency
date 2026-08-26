#!/usr/bin/env python3
"""Print the RFC 6381 codec string of an MP4, read out of the container.

    python3 tools/codec-string.py <file-or-url> [more...]

The string a browser is given to `canPlayType` has to describe the file it will
actually receive. HandBrake's UI and its Activity Log describe what the encoder
was *asked* for — the bits that reach the browser live in the `hvcC` / `avcC`
box, and they have drifted from the UI before (x265 flipping high-tier on when a
Level is pinned; a preset silently selecting the 10-bit encoder). So read them
here, from the finished file, and paste the result into HEVC_CODEC.

Takes local paths or URLs — a URL is range-requested, so it costs ~1.5MB, not
the whole video. No dependencies.
"""

import re
import struct
import sys
import urllib.request
from pathlib import Path

HEAD_BYTES = 1_500_000  # moov sits at the front in a faststart file
CONTAINERS = {'moov', 'trak', 'mdia', 'minf', 'stbl'}


def read_head(src):
    if re.match(r'^https?://', src):
        req = urllib.request.Request(src, headers={'Range': f'bytes=0-{HEAD_BYTES}'})
        return urllib.request.urlopen(req).read()
    return Path(src).read_bytes()[:HEAD_BYTES]


def atoms(buf, start, end):
    """Yield (type, payload_start, payload_end) for every atom in a range."""
    i = start
    while i + 8 <= end:
        size = struct.unpack('>I', buf[i:i + 4])[0]
        kind = buf[i + 4:i + 8].decode('latin1', errors='replace')
        header = 8
        if size == 1:
            size = struct.unpack('>Q', buf[i + 8:i + 16])[0]
            header = 16
        if size == 0:
            size = end - i
        if size < header:
            return
        yield kind, i + header, min(i + size, end)
        i += size


def walk(buf, start, end):
    for kind, s, e in atoms(buf, start, end):
        yield kind, s, e
        if kind in CONTAINERS:
            yield from walk(buf, s, e)
        elif kind == 'stsd':
            # Not a plain container: 4 bytes version/flags + 4 entry count, then a
            # VisualSampleEntry whose own 8-byte header and 78 fixed bytes sit in
            # front of the child boxes (avcC / hvcC). Descend past all of it.
            yield from walk(buf, s + 8 + 8 + 78, e)


def hevc_string(cfg):
    """hvcC → hvc1.<profile>.<compat>.<tier><level>.<constraints>"""
    byte1 = cfg[1]
    space = (byte1 >> 6) & 3
    tier = 'H' if (byte1 >> 5) & 1 else 'L'
    profile = byte1 & 0x1F
    # The compatibility flags are written in reverse bit order, as hex.
    compat = int(f'{struct.unpack(">I", cfg[2:6])[0]:032b}'[::-1], 2)
    level = cfg[12]
    out = f'hvc1.{["", "A", "B", "C"][space]}{profile}.{compat:X}.{tier}{level}'
    constraints = list(cfg[6:12])
    while constraints and constraints[-1] == 0:
        constraints.pop()
    if constraints:
        out += '.' + '.'.join(f'{b:02X}'.lstrip('0') or '0' for b in constraints)
    plain = {1: 'Main (8-bit)', 2: 'Main10 (10-bit)'}.get(profile, f'profile {profile}')
    return out, f'{plain}, {"High" if tier == "H" else "Main"} tier, Level {level / 30:.1f}'


def avc_string(cfg):
    """avcC → avc1.<profile><compat><level>"""
    profile, compat, level = cfg[1], cfg[2], cfg[3]
    plain = {0x42: 'Baseline', 0x4D: 'Main', 0x64: 'High'}.get(profile, f'profile 0x{profile:02X}')
    return f'avc1.{profile:02X}{compat:02X}{level:02X}', f'{plain}, Level {level / 10:.1f}'


def describe(src):
    buf = read_head(src)
    top = [k for k, _, _ in atoms(buf, 0, len(buf))]
    faststart = 'mdat' not in top or top.index('moov') < top.index('mdat')

    dims = duration = codec = detail = None
    for kind, s, e in walk(buf, 0, len(buf)):
        if kind == 'tkhd':
            w, h = struct.unpack('>II', buf[e - 8:e])
            if w >> 16:
                dims = f'{w >> 16}x{h >> 16}'
        elif kind == 'mdhd':
            if buf[s] == 1:
                scale, units = struct.unpack('>IQ', buf[s + 20:s + 32])
            else:
                scale, units = struct.unpack('>II', buf[s + 12:s + 20])
            if scale:
                duration = units / scale
        elif kind == 'hvcC':
            codec, detail = hevc_string(buf[s:e])
        elif kind == 'avcC':
            codec, detail = avc_string(buf[s:e])

    if not codec:
        print(f'{src}\n  no video configuration found (not an MP4, or moov is past '
              f'{HEAD_BYTES // 1000}KB — not faststart)\n')
        return

    print(src)
    print(f'  {dims or "?"}  {duration:.2f}s  {detail}' if duration else f'  {dims or "?"}  {detail}')
    print(f'  codecs="{codec}"')
    if not faststart:
        print('  WARNING: moov is after mdat — not faststart, playback waits for the whole file')
    print()


def pinned():
    """Show what the shipped code currently claims, for eyeball comparison."""
    root = Path(__file__).resolve().parent.parent
    for js in sorted(root.glob('src/js/*.js')):
        for line in js.read_text().splitlines():
            if 'HEVC_CODEC' in line and 'codecs=' in line:
                print(f'  {js.relative_to(root)}: {line.split("=", 1)[1].strip().rstrip(";")}')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    for arg in sys.argv[1:]:
        describe(arg)
    print('Currently pinned in this repo:')
    pinned()
