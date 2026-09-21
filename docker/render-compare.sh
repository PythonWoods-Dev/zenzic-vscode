#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 PythonWoods <dev@pythonwoods.dev>
# SPDX-License-Identifier: Apache-2.0
# Phase 0.4: judge rendering. Capture the SAME frame at 1x and at 2x-then-
# downscaled, so the comparison is like-for-like rather than a claim.
set -uo pipefail
GEOM="${1:-1280x800}"
ZOOM="${2:-0}"
OUTNAME="${3:-shot}"
pip install --quiet -e /mnt/zenzic-core 2>&1 | tail -1
cp -r /mnt/zenzic-vscode /home/demo/ext
cd /home/demo/ext && npm ci --no-audit --no-fund >/dev/null 2>&1
npx --yes @vscode/vsce package --allow-missing-repository -o /home/demo/l.vsix >/dev/null 2>&1
code --install-extension /home/demo/l.vsix >/dev/null 2>&1
WS=/home/demo/z108; rm -rf "$WS"; cp -r /mnt/zenzic-core/examples/z108-empty-link-text "$WS"

python3 - "$ZOOM" <<'PY'
import json, sys, pathlib
p = pathlib.Path("/home/demo/.config/Code/User/settings.json")
s = json.loads(p.read_text())
s["window.zoomLevel"] = float(sys.argv[1])
p.write_text(json.dumps(s, indent=2))
print("window.zoomLevel =", s["window.zoomLevel"])
PY

/usr/share/code/code --no-sandbox --disable-gpu --disable-dev-shm-usage \
  --new-window --disable-workspace-trust --skip-release-notes --skip-welcome \
  "$WS" "$WS/docs/index.md" >/home/demo/code.log 2>&1 &
win=""
for _ in $(seq 1 90); do
  win="$(xdotool search --onlyvisible --class code 2>/dev/null | head -1)"; [ -n "$win" ] && break; sleep 1
done
[ -n "$win" ] || { echo "no window"; exit 1; }

# VS Code restores its last window size, so on a larger virtual screen it
# leaves the rest as desktop. Resize it to fill the screen before capturing --
# a capture that is mostly wallpaper is not a rendering comparison.
SW="${GEOM%%x*}"; SH="${GEOM##*x}"
xdotool windowsize "$win" "$SW" "$SH"
xdotool windowmove "$win" 0 0
# Zoom level 2 makes VS Code render every glyph at ~2x device pixels, so the
# downscale below is a genuine supersample rather than a resize of 1x pixels.
sleep 28
ffmpeg -loglevel error -f x11grab -video_size "$GEOM" -i :99 -frames:v 1 -y "/out/${OUTNAME}-native.png"
stat -c "${OUTNAME}-native.png bytes=%s" "/out/${OUTNAME}-native.png"
