#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 PythonWoods <dev@pythonwoods.dev>
# SPDX-License-Identifier: Apache-2.0
#
# The encoding half of the demo asset: MP4 -> palette -> seeded palette -> GIF
# -> verified, or nothing.
#
# WHY THIS RUNS IN THE CONTAINER AND NOT ON THE HOST. Not tidiness --
# determinism. `palettegen` allocates 256 slots by frequency, and which colour
# wins a slot is precisely the property being controlled here. A different
# ffmpeg on the host, arriving with a system update, can allocate differently
# and silently undo the fidelity work. The image pins ffmpeg, so the asset is
# reproducible from it.
#
# WHY IT IS A SEPARATE SCRIPT from record-demo.sh. The capture costs minutes --
# npm ci, vsce package, the extension install, the diagnostics settle, the
# unrecorded probe sweep. Encoding costs seconds. Separating them means a
# palette or dithering change can be re-measured against an EXISTING recording
# without re-capturing, which is what made measuring six strategies feasible at
# all. record-demo.sh calls this at the end, so the full path is still one
# command.
#
# THE GATE WRITES NOTHING ON FAILURE, and that is the point rather than a
# nicety. An asset on disk looks finished regardless of how it got there: the
# previous one sat in images/ for a release cycle with a pale pink squiggle and
# text at 1.9x the surrounding prose. So the GIF is built under a staging name
# and only ever becomes `demo.gif` after verify_demo_gif.py accepts it.
set -uo pipefail

OUT=${OUT:-/out}
EXT=${EXT_DIR:-/mnt/zenzic-vscode}
MP4=${MP4:-$OUT/demo.mp4}
FPS=${GIF_FPS:-12}
# The output width, and the one number the shipped asset got wrong. It must be
# the capture width divided by the device scale factor, so the supersampled
# capture is downscaled by exactly that factor and the editor's logical text
# size survives into the GIF. 1600 / 2 = 800.
WIDTH=${GIF_WIDTH:-800}
STAGING="$OUT/.staging-demo.gif"
FINAL="$OUT/demo.gif"

die() { echo "FAIL: $*" >&2; exit 1; }

command -v node >/dev/null || die "node is not in this image; optimize-gif.js cannot run"
command -v ffmpeg >/dev/null || die "ffmpeg is not in this image"
[ -s "$MP4" ] || die "no recording at $MP4 -- run record-demo.sh first, or mount an existing demo.mp4 into \$OUT"
[ -f "$EXT/optimize-gif.js" ] || die "no optimize-gif.js under $EXT"
[ -f "$EXT/scripts/verify_demo_gif.py" ] || die "no verify_demo_gif.py under $EXT"

echo "### E1. ffmpeg this asset is reproducible from"
ffmpeg -version 2>/dev/null | head -1

echo
echo "### E2. encode: palettegen, seed the meaning-carrying colours, paletteuse"
# --seed and --dither carry their defaults from optimize-gif.js rather than
# being repeated here: two places holding one number is how they diverge.
rm -f "$STAGING"
node "$EXT/optimize-gif.js" "$MP4" "$STAGING" --fps "$FPS" --width "$WIDTH" \
    || die "encoding failed"
[ -s "$STAGING" ] || die "the encoder reported success and wrote no file"

echo
echo "### E3. GATE -- proportion and colour fidelity, on the encoded file"
# This is the only place either can be checked: record-demo.sh never sees the
# GIF, and both defects are introduced at encoding time. The verifier
# self-tests before rendering a verdict, including a control asserting that the
# colour the previous asset actually shipped (#C96256) now FAILS.
if python3 "$EXT/scripts/verify_demo_gif.py" "$STAGING"; then
    mv "$STAGING" "$FINAL"
    echo
    echo "### E4. accepted"
    ffprobe -v error -select_streams v:0 \
        -show_entries stream=width,height,nb_frames -show_entries format=duration \
        -of default=noprint_wrappers=1 "$FINAL"
    stat -c 'demo.gif bytes=%s' "$FINAL"
    sha256sum "$FINAL"
else
    rm -f "$STAGING"
    die "the encoded GIF did not pass the proportion and fidelity gate; nothing was written.
  The staging file has been deleted on purpose: an asset that fails verification
  must not exist on disk, because the next person to find it cannot tell."
fi
