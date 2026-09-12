#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2026 PythonWoods <dev@pythonwoods.dev>
# SPDX-License-Identifier: Apache-2.0
"""Decide whether an encoded demo GIF may be shipped.

    python3 scripts/verify_demo_gif.py <gif> [--self-test]

This is the half of the proportion and fidelity invariants that could not live
in `docker/record-demo.sh`, because that script never sees the encoded GIF, and
both defects it checks for were introduced *at encoding time*.

WHAT SHIPPED IN v0.30.x, AND WHY NOTHING CAUGHT IT
--------------------------------------------------
1. **Proportion.** The asset was 1280x800 with editor text at a glyph x-height
   of 17px, against a GitHub README prose x-height of 9px -- 1.89x the size of
   the text around it, which on a rendered page reads as a layout error. The
   cause was a 2x device scale factor on a 1x screen plus an output width equal
   to the capture width, which made the downscale a no-op.

   A gate inside the recorder cannot see this. A glyph's DEVICE-pixel size is
   `fontSize * DSF` and does not depend on the screen geometry at all: the
   broken run and the correct one both render at ~17 device px. What differs is
   the ratio between capture width and output width, and only the encoded file
   carries that.

2. **Fidelity.** The squiggle is `editorError.foreground`, #F14C4C, and the GIF
   rendered it as a pale pink. palettegen allocates its 256 slots by frequency
   and an antialiased 1-2px underline is the least frequent thing in an editor
   frame, so the colour carrying the whole message loses its slot. The nearest
   entry allocated was #C96256, a distance of 46.7 -- outside even the loose
   45-unit proximity band the asset was checked with.

   So a proximity COUNT is not the check. A count within 45 can be satisfied by
   something a human reads as washed out, which is exactly how the defect
   passed. What is checked here is the nearest distance ACHIEVED, with the
   threshold set from what a correct encode actually reaches (0.0, because the
   palette is seeded) rather than from what a broken one happened to hit.

Exit 0 when the asset may ship, 1 when it may not, 2 when the instrument itself
is broken.

What this does NOT check, stated here rather than discovered later
-----------------------------------------------------------------
1. **It does not know what the sequence shows.** That the quick fix landed and
   the file changed is asserted by `record-demo.sh`, from the file on disk, at
   record time. This script measures pixels; it cannot tell a demo of a fix
   from a demo of a suppression.
2. **It samples frames.** Both colours are on screen for seconds, so an even
   sample finds them; a colour present in a single frame could be missed.
3. **It compares against the README's prose size, not against the Marketplace's.**
   The two containers differ, and the Marketplace's CSS is not ours to read. The
   mitigation is the output width: at 800px the image is narrower than either
   container, so neither rescales it and the measured size is the shown size.
"""

from __future__ import annotations

import math
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


#: ImageMagick's driver, resolved rather than named. ImageMagick 7 ships
#: `magick`; ImageMagick 6 -- which is what the recording container has, and
#: therefore what the gate runs under in the pipeline -- ships only `convert`.
#: Hardcoding `magick` made the gate abort with FileNotFoundError inside the
#: container, and because an aborted self-test is treated as a refusal, it
#: DELETED a correct asset and reported a fidelity failure. The instrument
#: being unavailable and the asset being wrong are different outcomes and must
#: not produce the same one.
_MAGICK = shutil.which("magick") or shutil.which("convert")


#: The x-height of GitHub README body text, in CSS pixels. `.markdown-body` is
#: 16px in a system sans stack, whose x-height renders 9px. The whole point of
#: the asset's geometry is to match this number.
PROSE_XHEIGHT = 9
#: +/-1. The editor font and the README's sans have slightly different x-height
#: ratios at the same em, so a correct encode lands on 8 or 9. Still an order of
#: magnitude tighter than the 17 it has to reject.
XHEIGHT_TOLERANCE = 1

#: Colours that carry meaning, and the minimum number of pixels that must reach
#: each one EXACTLY. Both are forced into the palette by `optimize-gif.js
#: --seed`; if that stops happening, the nearest entry drifts to ~47 and this
#: fails. Measured on the accepted asset: 13 and 97 respectively.
MEANING_COLOURS: dict[str, tuple[tuple[int, int, int], int]] = {
    "editorError.foreground (the squiggle)": ((0xF1, 0x4C, 0x4C), 8),
    "editorWarning.foreground (Z501)": ((0xCC, 0xA7, 0x00), 8),
}

#: The nearest palette colour must come within this distance of the target.
#: Set from the measurement, not from the instrument's history: a seeded palette
#: reaches 0.0, so 4 admits nothing but rounding. The previously shipped value,
#: #C96256 at 46.7, fails it by more than tenfold -- and the self-test asserts
#: that it does, in that direction, because a threshold nobody has seen reject
#: the known-bad value is a number rather than a control.
FIDELITY_MAX_DISTANCE = 4.0

#: The value v0.30.x actually shipped. Kept as a named negative control.
PREVIOUSLY_SHIPPED = (0xC9, 0x62, 0x56)
#: Markdown link syntax. A generic "is it red" test counted these and passed.
SALMON = (0xE5, 0x7C, 0x6A)

_PX = re.compile(r"^(\d+),(\d+):\s*\([^)]*\)\s*#([0-9A-Fa-f]{6})")
_HIST = re.compile(r"^\s*(\d+):\s*\([^)]*\)\s*#([0-9A-Fa-f]{6})")


def _run(argv: list[str], **kw: object) -> subprocess.CompletedProcess[str]:
    return subprocess.run(  # noqa: S603
        argv, capture_output=True, text=True, encoding="utf-8", errors="replace", **kw
    )


def dist(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def _hex(c: tuple[int, int, int]) -> str:
    return "#%02X%02X%02X" % c


def histogram(png: Path) -> dict[tuple[int, int, int], int]:
    """Every distinct colour in *png* with its pixel count.

    A histogram rather than a per-pixel walk: ImageMagick emits one line per
    colour, so this is thousands of lines instead of 360,000.
    """
    proc = _run([_MAGICK, str(png), "-depth", "8", "-format", "%c", "histogram:info:-"])
    out: dict[tuple[int, int, int], int] = {}
    for line in proc.stdout.splitlines():
        m = _HIST.match(line)
        if m:
            h = m.group(2)
            out[tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))] = int(m.group(1))  # type: ignore[index]
    return out


def xheight(png: Path, width: int, height: int) -> int | None:
    """Glyph x-height in the pixels of *png*, or None if it cannot be measured.

    The right half of the frame below the tab bar is editor text at every
    geometry: the sidebar is on the left, the status bar at the bottom. Within
    one rendered text row the x-height region is the plateau -- ascenders and
    descenders are a minority of the ink -- so the rows carrying at least half
    the row's peak ink are the x-height rows, and the median over rows discards
    the larger heading and any row the crop cut through.
    """
    crop = f"{width // 2 - 20}x{height * 58 // 100}+{width // 2}+{height * 27 // 100}"
    proc = _run([_MAGICK, str(png), "-crop", crop, "+repage",
                 "-colorspace", "Gray", "-depth", "8", "txt:-"])
    ink: dict[int, int] = {}
    maxy = 0
    seen = False
    for line in proc.stdout.splitlines():
        m = _PX.match(line)
        if not m:
            continue
        seen = True
        y = int(m.group(2))
        maxy = max(maxy, y)
        if int(m.group(3)[0:2], 16) > 100:
            ink[y] = ink.get(y, 0) + 1
    if not seen:
        return None
    rows = [y for y in sorted(ink) if ink[y] >= 3]
    bands: list[list[int]] = []
    prev: int | None = None
    for y in rows:
        if prev is not None and y - prev <= 3:
            bands[-1].append(y)
        else:
            bands.append([y])
        prev = y
    # A band touching the first or last row of the crop is a text row the crop
    # cut through; its height measures where the crop landed, not the text.
    bands = [b for b in bands if b[0] > 0 and b[-1] < maxy]
    if len(bands) < 4:
        return None
    heights = sorted(
        sum(1 for y in b if ink[y] >= 0.5 * max(ink[v] for v in b)) for b in bands
    )
    return heights[len(heights) // 2]


def geometry(gif: Path) -> tuple[int, int, float, int]:
    """Width, height, duration and frame count of *gif*, from ffprobe."""
    proc = _run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                 "stream=width,height,nb_frames:format=duration",
                 "-of", "default=noprint_wrappers=1:nokey=0", str(gif)])
    vals: dict[str, str] = {}
    for line in proc.stdout.splitlines():
        if "=" in line:
            k, _, v = line.partition("=")
            vals[k] = v
    try:
        return (int(vals["width"]), int(vals["height"]),
                float(vals.get("duration", "0") or 0), int(vals.get("nb_frames", "0") or 0))
    except (KeyError, ValueError):
        print(f"FATAL: ffprobe could not describe {gif}", file=sys.stderr)
        raise SystemExit(2) from None


def sample_frames(gif: Path, into: Path, count: int = 20) -> list[Path]:
    """*count* evenly spaced frames of *gif*, coalesced, as PNGs.

    Coalesced because the encoder writes only each frame's changed rectangle;
    reading a raw frame would measure a partial image and report a colour absent
    from what anyone sees.
    """
    _run([_MAGICK, str(gif), "-coalesce", str(into / "f-%04d.png")])
    frames = sorted(into.glob("f-*.png"))
    if not frames:
        return []
    step = max(1, len(frames) // count)
    return frames[::step]


def fidelity(frames: list[Path]) -> dict[str, tuple[float, int]]:
    """Best distance achieved and pixel count at that distance, per colour."""
    best: dict[str, tuple[float, int]] = {
        label: (float("inf"), 0) for label in MEANING_COLOURS
    }
    for f in frames:
        hist = histogram(f)
        for label, (target, _min_px) in MEANING_COLOURS.items():
            near = min((dist(c, target) for c in hist), default=float("inf"))
            if near > FIDELITY_MAX_DISTANCE:
                if near < best[label][0]:
                    best[label] = (near, 0)
                continue
            px = sum(n for c, n in hist.items() if dist(c, target) <= FIDELITY_MAX_DISTANCE)
            if near < best[label][0] or (near == best[label][0] and px > best[label][1]):
                best[label] = (near, px)
    return best


# ---------------------------------------------------------------------------
# Self-test. Runs before any verdict, so a broken instrument cannot report a
# clean asset. A passing check and a check that stopped looking produce the same
# silence, so each control is asserted in BOTH directions -- and the negative
# controls are the real values that got past the previous check rather than
# invented ones.
# ---------------------------------------------------------------------------
def _swatch(tmp: Path, name: str, colour: tuple[int, int, int]) -> Path:
    p = tmp / name
    _run([_MAGICK, "-size", "80x40", f"xc:{_hex(colour)}", "-depth", "8", str(p)])
    return p


def _text_frame(tmp: Path, name: str, pointsize: int) -> Path:
    """A synthetic frame whose editor half holds text at a known size.

    Regenerated here rather than committed: a reference image in the tree is one
    more thing that can go stale silently, and the property being tested is a
    relationship between a font size and a measurement, which renders fresh.
    """
    p = tmp / name
    label = tmp / f"label-{pointsize}.png"
    _run([_MAGICK, "-background", "#1F1F1F", "-fill", "#CCCCCC",
          "-pointsize", str(pointsize), "label:xxnxx\nxxnxx\nxxnxx\nxxnxx\nxxnxx\nxxnxx",
          "-depth", "8", str(label)])
    # Place it in the right half, where xheight() looks.
    _run([_MAGICK, "-size", "800x450", "xc:#1F1F1F", str(label),
          "-geometry", "+420+130", "-composite", "-depth", "8", str(p)])
    return p


def _self_test() -> bool:
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)

        # --- fidelity, both directions -------------------------------------
        target = MEANING_COLOURS["editorError.foreground (the squiggle)"][0]
        exact = histogram(_swatch(tmp, "exact.png", target))
        if not exact:
            print("self-test FAILED: could not read a histogram at all", file=sys.stderr)
            return False
        d_exact = min(dist(c, target) for c in exact)
        if d_exact > FIDELITY_MAX_DISTANCE:
            print(f"self-test FAILED: exact {_hex(target)} measured {d_exact:.1f} away "
                  f"and would be rejected", file=sys.stderr)
            return False
        for label, bad in (("the previously shipped colour", PREVIOUSLY_SHIPPED),
                           ("markdown-link salmon", SALMON)):
            hist = histogram(_swatch(tmp, "bad.png", bad))
            d_bad = min(dist(c, target) for c in hist)
            if d_bad <= FIDELITY_MAX_DISTANCE:
                print(f"self-test FAILED: {label} {_hex(bad)} measured {d_bad:.1f} away "
                      f"and would PASS a threshold of {FIDELITY_MAX_DISTANCE}",
                      file=sys.stderr)
                return False

        # --- x-height, both directions -------------------------------------
        small = xheight(_text_frame(tmp, "small.png", 16), 800, 450)
        large = xheight(_text_frame(tmp, "large.png", 32), 800, 450)
        if small is None or large is None:
            print(f"self-test FAILED: x-height unmeasurable on synthetic text "
                  f"(16pt={small}, 32pt={large})", file=sys.stderr)
            return False
        if abs(small - PROSE_XHEIGHT) > XHEIGHT_TOLERANCE:
            print(f"self-test FAILED: 16pt text measured x-height {small}, but the gate "
                  f"expects {PROSE_XHEIGHT}+/-{XHEIGHT_TOLERANCE} -- a correct asset "
                  f"would be rejected", file=sys.stderr)
            return False
        if abs(large - PROSE_XHEIGHT) <= XHEIGHT_TOLERANCE:
            print(f"self-test FAILED: 32pt text measured x-height {large} and would PASS. "
                  f"That is the v0.30.x defect; the instrument cannot see it",
                  file=sys.stderr)
            return False

        # --- an unmeasurable frame is not a small one ----------------------
        flat = tmp / "flat.png"
        _run([_MAGICK, "-size", "800x450", "xc:#1F1F1F", "-depth", "8", str(flat)])
        if xheight(flat, 800, 450) is not None:
            print("self-test FAILED: a frame with no text returned a number",
                  file=sys.stderr)
            return False

    print(f"self-test passed: 7 case(s); fidelity threshold {FIDELITY_MAX_DISTANCE} "
          f"rejects {_hex(PREVIOUSLY_SHIPPED)} at "
          f"{dist(PREVIOUSLY_SHIPPED, (0xF1, 0x4C, 0x4C)):.1f}; x-height gate "
          f"{PROSE_XHEIGHT}+/-{XHEIGHT_TOLERANCE} rejects {large}")
    return True


def main() -> int:
    if _MAGICK is None:
        print("FATAL: neither `magick` nor `convert` is on PATH. This gate cannot run, "
              "which is not the same as the asset being wrong -- install ImageMagick.",
              file=sys.stderr)
        return 2
    if not _self_test():
        return 2
    if "--self-test" in sys.argv:
        return 0
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    if len(args) != 1:
        print(__doc__ or "", file=sys.stderr)
        return 2
    gif = Path(args[0])
    if not gif.is_file():
        print(f"FATAL: no such file: {gif}", file=sys.stderr)
        return 2

    w, h, dur, frames_n = geometry(gif)
    print(f"verify-demo-gif: {gif.name}  {w}x{h}  {dur:.2f}s  {frames_n} frames  "
          f"{gif.stat().st_size / 1024:.0f} KB")

    failures: list[str] = []
    with tempfile.TemporaryDirectory() as td:
        frames = sample_frames(gif, Path(td))
        if not frames:
            print("FATAL: the GIF yielded no frames", file=sys.stderr)
            return 2
        print(f"  sampled {len(frames)} frame(s)")

        xh = xheight(frames[0], w, h)
        if xh is None:
            failures.append("the glyph x-height could not be measured on frame 0 -- "
                            "a measurement that cannot be taken is not a pass")
        else:
            verdict = "OK" if abs(xh - PROSE_XHEIGHT) <= XHEIGHT_TOLERANCE else "FAIL"
            print(f"  glyph x-height {xh}px against README prose {PROSE_XHEIGHT}px "
                  f"(+/-{XHEIGHT_TOLERANCE})  [{verdict}]")
            if verdict == "FAIL":
                ratio = xh / PROSE_XHEIGHT
                failures.append(
                    f"glyph x-height is {xh}px where the surrounding prose is "
                    f"{PROSE_XHEIGHT}px -- {ratio:.2f}x. On a rendered README this reads "
                    f"as a layout error. Check that optimize-gif.js was given a --width "
                    f"of exactly (capture width / device scale factor)"
                )

        for label, (near, px) in fidelity(frames).items():
            target, min_px = MEANING_COLOURS[label]
            ok = near <= FIDELITY_MAX_DISTANCE and px >= min_px
            shown = "inf" if near == float("inf") else f"{near:.1f}"
            print(f"  {label}: nearest {shown} from {_hex(target)}, {px}px exact "
                  f"(need <={FIDELITY_MAX_DISTANCE} and >={min_px}px)  "
                  f"[{'OK' if ok else 'FAIL'}]")
            if not ok:
                failures.append(
                    f"{label}: the palette's nearest colour is {shown} from "
                    f"{_hex(target)} with {px}px at that distance. The colour the asset "
                    f"exists to show is not in it. Seed the palette: "
                    f"optimize-gif.js --seed {_hex(target).lstrip('#')}"
                )

    if failures:
        print(f"\nFAILED: {len(failures)} reason(s) this asset must not ship:",
              file=sys.stderr)
        for f in failures:
            print(f"  - {f}", file=sys.stderr)
        return 1
    print("\nPASS: proportion and colour fidelity both verified against the source.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
