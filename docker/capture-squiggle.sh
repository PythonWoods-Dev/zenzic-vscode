#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 PythonWoods <dev@pythonwoods.dev>
# SPDX-License-Identifier: Apache-2.0
#
# Phase 0.3: open the Z108 fixture, prove the extension activated, capture the
# red squiggle. Every claim here is an execution, not a configuration reading.
set -uo pipefail

CORE=/mnt/zenzic-core
EXT_SRC=/mnt/zenzic-vscode
OUT=${OUT:-/out}
mkdir -p "$OUT"

echo "### 1. engine: editable install from the mounted local repo"
pip install --quiet -e "$CORE" 2>&1 | tail -2
# --version is printed for the record only. It cannot discriminate a local
# checkout from the published release -- the bump is the last step of a
# release, so the two carry the same number for the whole dev cycle.
zenzic --version

echo
echo "### 2. extension: package locally, install the .vsix"
cp -r "$EXT_SRC" /home/demo/ext
cd /home/demo/ext
npm ci --no-audit --no-fund >/dev/null 2>&1
npx --yes @vscode/vsce package --allow-missing-repository -o /home/demo/local.vsix >/dev/null 2>&1
code --install-extension /home/demo/local.vsix >/dev/null 2>&1
code --list-extensions --show-versions | grep -i zenzic

echo
echo "### 2b. PROVENANCE GATE -- the checks that actually discriminate"
if [ -f "$CORE/.claude/scripts/verify_local_provenance.py" ]; then
    PROV="$CORE/.claude/scripts/verify_local_provenance.py"
else
    PROV=/home/demo/verify_local_provenance.py
fi
if [ -f "$PROV" ]; then
    python3 "$PROV" --mount "$CORE" --extensions /home/demo/.vscode/extensions || {
        echo "REFUSING TO CAPTURE: this is not provably the local build." >&2
        exit 1
    }
else
    echo "verify_local_provenance.py not found -- provenance UNVERIFIED" >&2
    exit 1
fi

echo
echo "### 3. workspace: a writable copy of the Z108 fixture"
WS=/home/demo/z108
rm -rf "$WS"
cp -r "$CORE/examples/z108-empty-link-text" "$WS"
sed -n '10p' "$WS/docs/index.md"

echo
echo "### 4. launch VS Code on the fixture"
# The `code` wrapper backgrounds the app and returns, so its exit status says
# nothing; launch the Electron binary directly and keep the PID. --no-sandbox
# and --disable-gpu are required in a container (no user namespaces, no GPU) --
# without them the process exits before mapping a window and prints nothing.
/usr/share/code/code \
     --no-sandbox --disable-gpu --disable-dev-shm-usage \
     --new-window \
     --disable-workspace-trust \
     --skip-release-notes --skip-welcome \
     --log info \
     "$WS" "$WS/docs/index.md" >/home/demo/code.log 2>&1 &

# Wait for a real window to be mapped, rather than sleeping a fixed time.
# `xdotool search` exits 0 with EMPTY output when it finds nothing, so the
# exit status alone is not a test -- grep for an actual id.
win=""
for _ in $(seq 1 90); do
    win="$(xdotool search --onlyvisible --class code 2>/dev/null | head -1)"
    [ -n "$win" ] && break
    sleep 1
done
[ -n "$win" ] || { echo "no VS Code window ever mapped"; exit 1; }
echo "window mapped: id=$win name=$(xdotool getwindowname "$win")"

# The language server starts after the window; diagnostics arrive after that.
sleep 25

echo
echo "### 5. did the extension genuinely activate? (log, not silence)"
find /home/demo/.config/Code/logs -type f -name '*.log' 2>/dev/null \
    | xargs grep -ilE 'zenzic' 2>/dev/null | head -10

echo
echo "### 6. capture"
# The output directory is bind-mounted from the host and owned by the host
# user, so it is the one path where a uid mismatch still bites. Prove it is
# writable BEFORE capturing: otherwise ffmpeg fails, `stat` reports whatever
# file was left there by an earlier run, and the script announces a byte count
# for an image this run never produced -- a check whose result is a stale fact.
if ! touch "$OUT/.write-probe" 2>/dev/null; then
    echo "FAIL: $OUT is not writable by uid $(id -u)." >&2
    echo "  Run with:  --user \$(id -u):\$(id -g)  or chown the output dir." >&2
    exit 1
fi
rm -f "$OUT/.write-probe"

rm -f "$OUT/squiggle.png"
ffmpeg -loglevel error -f x11grab -video_size 1280x800 -i :99 -frames:v 1 -y "$OUT/squiggle.png"
if [ ! -s "$OUT/squiggle.png" ]; then
    echo "FAIL: no capture was written." >&2
    exit 1
fi
stat -c 'squiggle.png bytes=%s' "$OUT/squiggle.png"
