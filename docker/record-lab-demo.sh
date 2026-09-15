#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 PythonWoods <dev@pythonwoods.dev>
# SPDX-License-Identifier: Apache-2.0
#
# Record `zenzic lab z201` -- the detection, where the first asset records the
# refusal. Same pipeline as record-precommit-demo.sh: asciinema records a real
# pty and agg renders it, so the .cast is the complete source of every pixel and
# a token absent from it cannot appear in a frame.
#
# `lab` is the right subject because it carries its own fixture: no repository
# has to be built first, and the viewer does not have to imagine one with a
# secret in it.
set -euo pipefail

REPO=/work/zenzic
OUT=/out
COLS=${COLS:-88}
ROWS=${ROWS:-42}

say() { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }

say "provenance gate"
if command -v zenzic >/dev/null 2>&1; then
  echo "FAIL: zenzic is on PATH before the local install; the recording could not" >&2
  echo "      prove which build it exercised." >&2
  exit 1
fi
/home/demo/.venv/bin/pip install -q -e "$REPO" 2>&1 | tail -2
export PATH="/home/demo/.venv/bin:$PATH"
SRC=$(python3 -c 'import zenzic,os;print(os.path.realpath(os.path.dirname(zenzic.__file__)))')
case "$SRC" in
  "$REPO"/src/zenzic) echo "  engine resolves to the mounted checkout: $SRC" ;;
  *) echo "FAIL: engine resolves to $SRC, not the mounted checkout." >&2; exit 1 ;;
esac

say "assert the exit code from the process, before recording anything"
# The picture cannot be trusted for this and the inner report is actively
# misleading: it prints "Exit code 2 is mandatory", which is the *scenario's*
# contract. `lab` itself exits 0 when the scenario meets its expectation, and 0
# is what the alt text must describe.
cd /tmp
set +e
zenzic lab z201 >/tmp/lab.txt 2>&1
LAB_RC=$?
set -e
echo "  zenzic lab z201 -> exit ${LAB_RC}"
if [ "$LAB_RC" -ne 0 ]; then
  echo "FAIL: expected exit 0 (expectation met); got ${LAB_RC}." >&2
  exit 1
fi
grep -q 'expectation met' /tmp/lab.txt || { echo "FAIL: no LAB RESULT line." >&2; exit 1; }
grep -q 'SECURITY BREACH DETECTED' /tmp/lab.txt || { echo "FAIL: no breach block." >&2; exit 1; }
# Size the terminal to the output rather than trusting it fits.
NEEDED=$(( $(wc -l < /tmp/lab.txt) + 4 ))
if [ "$NEEDED" -gt "$ROWS" ]; then
  echo "  output needs ${NEEDED} rows; raising ROWS from ${ROWS}"
  ROWS=$NEEDED
fi
echo "  terminal: ${COLS}x${ROWS} for $(wc -l < /tmp/lab.txt) lines of output"

say "record"
mkdir -p "$OUT"
cat > /tmp/session.sh <<SESSION
#!/usr/bin/env bash
cd /tmp
export PATH="/home/demo/.venv/bin:\$PATH"
export PS1=''
type() { printf '\033[1;32m\$\033[0m '; printf '%s' "\$1" | while IFS= read -r -n1 c; do printf '%s' "\$c"; sleep 0.04; done; printf '\n'; sleep 0.4; }
sleep 0.8
type "zenzic lab z201"
zenzic lab z201
sleep 4.0
SESSION
chmod +x /tmp/session.sh
rm -f "$OUT/lab.cast"
asciinema rec --cols "$COLS" --rows "$ROWS" --command /tmp/session.sh --quiet "$OUT/lab.cast"

say "the two credential measurements, both made on the cast"
python3 - "$OUT/lab.cast" <<'PY'
import json, sys
raw, masked = "AKIAIOSFODNN7EXAMPLE", "AKIA************MPLE"
s = "".join(json.loads(l)[2] for i, l in enumerate(open(sys.argv[1])) if i and json.loads(l)[1] == "o")
nraw, nmask = s.count(raw), s.count(masked)
print(f"  raw key in the whole output stream : {nraw}  (must be 0)")
print(f"  masked form                        : {nmask}  (must be >= 1)")
if nraw or not nmask:
    sys.exit("FAIL: credential rendering is wrong; refusing to ship this asset.")
PY

say "render"
agg --font-size 16 --theme asciinema --speed 1 "$OUT/lab.cast" "$OUT/lab.gif"
ls -la "$OUT/lab.gif"
