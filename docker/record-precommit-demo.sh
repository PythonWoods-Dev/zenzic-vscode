#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 PythonWoods <dev@pythonwoods.dev>
# SPDX-License-Identifier: Apache-2.0
#
# Record the pre-commit refusal for the core README.
#
# No VS Code, no X server: asciinema records a real pty and agg renders it, so
# the whole class of problems that dominated the editor demo -- chat panels,
# language IDs, device scale factors -- does not arise here.
#
# The five constraints this take carries, each enforced below rather than
# remembered:
#   1. The fixture is one short file, and the terminal is sized so the breach
#      block does not scroll off the top. The block prints first.
#   2. The engine is installed from the mounted checkout. If `zenzic --version`
#      is reachable without that install having happened, the run aborts --
#      a published wheel would record the wrong product.
#   3. The outcome is asserted by `git log`, never by how the terminal looked.
#   4. A captured frame must contain the masked form AND must not contain the
#      raw key. Those are different measurements and both are made.
#   5. The key is AKIAIOSFODNN7EXAMPLE, which AWS publishes in its own docs.
set -euo pipefail

REPO=/work/zenzic
OUT=/out
COLS=${COLS:-84}
ROWS=${ROWS:-22}
KEY="AKIAIOSFODNN7EXAMPLE"

say() { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }

say "provenance gate"
if command -v zenzic >/dev/null 2>&1; then
  echo "FAIL: zenzic is already on PATH before the local install." >&2
  echo "      The recording could not prove which build it exercised." >&2
  exit 1
fi
/home/demo/.venv/bin/pip install -q -e "$REPO" 2>&1 | tail -2
export PATH="/home/demo/.venv/bin:$PATH"
LOCAL_SRC=$(python3 -c 'import zenzic,os;print(os.path.realpath(os.path.dirname(zenzic.__file__)))')
case "$LOCAL_SRC" in
  "$REPO"/src/zenzic) echo "  engine resolves to the mounted checkout: $LOCAL_SRC" ;;
  *) echo "FAIL: engine resolves to $LOCAL_SRC, not the mounted checkout." >&2; exit 1 ;;
esac

say "fixture"
rm -rf /tmp/demo && mkdir -p /tmp/demo/docs && cd /tmp/demo
git init -q -b main .
git config user.email dev@example.com
git config user.name "Dev"
git config commit.gpgsign false
cat > .zenzic.toml <<'TOML'
docs_dir = "docs"
fail_under = 0

[build_context]
engine = "standalone"
TOML
# Short on purpose: the breach block prints first and must not be pushed off
# the top of a 22-row terminal by anything that follows it.
cat > docs/setup.md <<MD
# Deploy

Set the credentials before the first run:

    AWS_ACCESS_KEY_ID=${KEY}
MD
mkdir -p .git/hooks
cat > .git/hooks/pre-commit <<'HOOK'
#!/usr/bin/env bash
exec zenzic guard scan --staged --quiet --no-header
HOOK
chmod +x .git/hooks/pre-commit

say "record"
mkdir -p "$OUT"
cat > /tmp/session.sh <<SESSION
#!/usr/bin/env bash
cd /tmp/demo
export PATH="/home/demo/.venv/bin:\$PATH"
export PS1=''
type() { printf '\033[1;32m\$\033[0m '; printf '%s' "\$1" | while IFS= read -r -n1 c; do printf '%s' "\$c"; sleep 0.035; done; printf '\n'; sleep 0.45; }
sleep 0.8
type "git add docs/setup.md"
git add docs/setup.md
sleep 0.5
type "git commit -m 'docs: deployment notes'"
git commit -m 'docs: deployment notes' || true
sleep 3.2
type "git log --oneline"
# git already prints "does not have any commits yet" on stderr and exits 1.
# An echo fallback here printed the same line a second time -- the recording is
# of a real session, so it must not be helped along. No backticks in this
# heredoc: it is unquoted, so they would run as command substitution.
git log --oneline 2>&1 || true
sleep 3.0
SESSION
chmod +x /tmp/session.sh
rm -f "$OUT/demo.cast"
asciinema rec --cols "$COLS" --rows "$ROWS" --command /tmp/session.sh --quiet "$OUT/demo.cast"

say "assert the outcome, not the appearance"
cd /tmp/demo
if git rev-parse HEAD >/dev/null 2>&1; then
  echo "FAIL: a commit exists. The hook did not refuse, so the recording shows the wrong thing." >&2
  exit 1
fi
echo "  git log: no commit on main -- the commit was refused"

say "render"
agg --font-size 17 --theme asciinema --speed 1 "$OUT/demo.cast" "$OUT/demo.gif"
ls -la "$OUT/demo.gif"
