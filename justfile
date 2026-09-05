set shell := ["bash", "-c"]

# just — developer workflow for zenzic-vscode.
#
# Quick reference:
#   just verify          — lint + tsc + test-cov (pre-push gate)
#   just test-cov        — unit tests with coverage gate (src/semver.ts only —
#                           see vitest.config.mts for why)
#   just package         — build and package .vsix archive
#   just release <part> <core>  — bump extension version + align core pin
#   just release-dry <p> <core> — dry-run release orchestration
#   just pin-core <ver>  — realign Zenzic Core pin in README + RELEASE.md + CONTRIBUTING.md
#   just pin-core-dry    — show what pin-core would change (no writes)
#   just versions        — show extension version and pinned core version
#   just audit-release   — verify release metadata/core pin alignment
#   just clean           — remove generated artefacts (out/, *.vsix, .tsbuildinfo)

package:
	npm run build
	npx @vscode/vsce package

# The only mixed-toolchain repository in the ecosystem: the extension itself is
# TypeScript, but the quality gates it runs (zenzic, reuse) are Python, so a
# working clone needs both. This repository has no pyproject.toml -- it is a
# Node project -- so the Python side is a plain venv holding the two tools the
# justfile invokes: Core (editable from the sibling checkout, so gates run
# against live engine code) and reuse, pinned to the same version the
# reuse-tool pre-commit rev provides. `npm ci` rather than `npm install` so the
# lockfile is honoured exactly, matching what CI resolves.
#
# The hook install is part of setup rather than a step to remember: this
# repository was once found with no hooks installed at all, the precondition
# Rule 31 blocks on. Running setup makes that self-healing.
#
# Bootstrap a fresh clone: install dependencies and git hooks.
setup:
    npm ci
    uv venv --allow-existing
    uv pip install --python .venv -e ../zenzic reuse==6.2.0
    uvx pre-commit install -t pre-commit -t pre-push
    @echo "Setup complete. Run 'just verify' to check everything passes."

verify: _check-hooks check
	npm run lint
	# Pinned to the same markdownlint-cli version zenzic Core pins by SHA in
	# pre-commit. An unpinned npx resolves to latest, and .markdownlint.json sets
	# `default: true`, so every rule a newer release adds would fire here as a
	# phantom failure -- observed on Core, where latest reported 76 MD060 findings
	# the authoritative version does not have.
	# _zenzic_core is the Sovereign Resolution chain's CI checkout of Core
	# (02-architecture-models.md, priority 2), not this repo's content. It
	# carries Core's examples/ fixtures, which are deliberately non-compliant.
	# Absent locally -- resolution falls through to ../zenzic -- which is why
	# this passed here and failed in CI.
	npx -y markdownlint-cli@0.41.0 '**/*.md' --ignore node_modules --ignore _zenzic_core
	npx tsc --noEmit
	just test-cov
	@if ! command -v reuse > /dev/null 2>&1; then \
		echo "ERROR: 'reuse' is not installed. Please install it via 'uv tool install reuse' or 'pipx install reuse'."; \
		exit 1; \
	fi
	reuse lint

# Unit tests with coverage gate (thresholds in vitest.config.mts).
test-cov:
	npm run test:coverage

# Run the Zenzic quality gate on extension documentation.
# Shared sovereign model (family repos):
#   1) explicit override via ZENZIC_CORE_PATH
#   2) CI topology at ./_zenzic_core
#   3) sibling dev topology at ../zenzic
# Fail-closed policy is mandatory: PyPI fallback is prohibited.
# ZRT-010 — Sovereign Parity: local == CI.
check:
	#!/usr/bin/env bash
	set -euo pipefail
	CORE_PATH=""
	CHECKED=()

	if [[ -n "${ZENZIC_CORE_PATH:-}" ]]; then
		CHECKED+=("ZENZIC_CORE_PATH -> ${ZENZIC_CORE_PATH}")
		if [[ -d "${ZENZIC_CORE_PATH}/src/zenzic" ]]; then
			CORE_PATH="${ZENZIC_CORE_PATH}"
		fi
	fi

	if [[ -z "$CORE_PATH" ]]; then
		CHECKED+=("_zenzic_core -> _zenzic_core")
		if [[ -d "_zenzic_core/src/zenzic" ]]; then
			CORE_PATH="_zenzic_core"
		fi
	fi

	if [[ -z "$CORE_PATH" ]]; then
		CHECKED+=("../zenzic -> ../zenzic")
		if [[ -d "../zenzic/src/zenzic" ]]; then
			CORE_PATH="../zenzic"
		fi
	fi

	if [[ -z "$CORE_PATH" ]]; then
		echo "❌ [Zenzic] Core repository not found in sovereign search order." >&2
		echo "Required precedence: ZENZIC_CORE_PATH -> ./_zenzic_core -> ../zenzic" >&2
		echo "Each candidate must contain src/zenzic." >&2
		echo "Checked: ${CHECKED[*]}" >&2
		echo "Fail-closed policy active: PyPI fallback is prohibited." >&2
		exit 2
	fi

	echo "🛡️  [Zenzic] Local core detected. Using: $CORE_PATH"
	uv run --project "$CORE_PATH" zenzic check all --strict --no-header


release part core_version:
	#!/usr/bin/env bash
	set -euo pipefail
	case "{{ part }}" in
		patch|minor|major) ;;
		*) echo "Invalid part '{{ part }}'. Use patch|minor|major"; exit 2 ;;
	esac
	just _validate-semver "{{core_version}}"
	uvx --from "bump-my-version==1.2.6" bump-my-version bump {{ part }} --no-commit
	just _pin-core-apply "{{core_version}}"
	version="$(uvx --from "bump-my-version==1.2.6" bump-my-version show current_version)"
	git add -u
	git commit -S -s -m "release: bump version to ${version} (core {{core_version}})"

release-dry part core_version *args:
	#!/usr/bin/env bash
	set -euo pipefail
	just _validate-semver "{{core_version}}"
	_short=false
	for _arg in {{args}}; do [[ "$_arg" == "--short" ]] && _short=true; done
	if $_short; then
		uvx --from "bump-my-version==1.2.6" bump-my-version bump {{part}} --dry-run --allow-dirty --verbose 2>&1 \
			| grep -E 'current version|New version will be|Dry run'
	else
		uvx --from "bump-my-version==1.2.6" bump-my-version bump {{part}} --dry-run --allow-dirty --verbose
	fi
	echo ""
	just pin-core-dry "{{core_version}}"

# Show the current extension version and the pinned Zenzic Core version
versions:
	#!/usr/bin/env bash
	set -euo pipefail
	PINNED=$(grep -oP '\*\*Pinned Core\*\* \| `zenzic>=\K[0-9.]+' RELEASE.md)
	EXT_MIN=$(grep -oP "MIN_CORE_VERSION = '\K[0-9.]+" src/coreVersion.ts)
	echo "extension:   $(uvx --from 'bump-my-version==1.2.6' bump-my-version show current_version)"
	echo "core-pinned: $PINNED (RELEASE.md)"
	echo "min-core-ts: $EXT_MIN (src/coreVersion.ts)"

audit-release:
	#!/usr/bin/env bash
	set -euo pipefail
	EXT="$(uvx --from 'bump-my-version==1.2.6' bump-my-version show current_version)"
	PKG="$(grep -oP '"version":\s*"\K[0-9.]+' package.json | head -n1)"
	LOCK="$(grep -oP '"version":\s*"\K[0-9.]+' package-lock.json | head -n1)"
	REL="$(grep -oP '\*\*Extension Version\*\* \| \K[0-9.]+' RELEASE.md)"
	CORE_REL="$(grep -oP '\*\*Pinned Core\*\* \| `zenzic>=\K[0-9.]+' RELEASE.md)"
	CORE_TS="$(grep -oP "MIN_CORE_VERSION = '\K[0-9.]+" src/coreVersion.ts)"
	CORE_CONTRIB="$(grep -oP '\| \*\*Zenzic Core\*\* \| ≥ \K[0-9.]+' CONTRIBUTING.md)"
	if [[ -z "$PKG" || -z "$LOCK" || -z "$REL" || -z "$CORE_REL" || -z "$CORE_TS" || -z "$CORE_CONTRIB" ]]; then
		echo "audit-release failed: missing expected release/core markers"
		exit 1
	fi
	if [[ "$EXT" != "$PKG" || "$EXT" != "$LOCK" || "$EXT" != "$REL" ]]; then
		echo "audit-release failed: extension version mismatch (bump/package/lock/release)"
		echo "  bump=$EXT package.json=$PKG package-lock.json=$LOCK RELEASE.md=$REL"
		exit 1
	fi
	if [[ "$CORE_REL" != "$CORE_TS" || "$CORE_REL" != "$CORE_CONTRIB" ]]; then
		echo "audit-release failed: core pin mismatch (RELEASE/coreVersion.ts/CONTRIBUTING)"
		echo "  RELEASE.md=$CORE_REL coreVersion.ts=$CORE_TS CONTRIBUTING.md=$CORE_CONTRIB"
		exit 1
	fi
	grep -q "Zenzic Core v$CORE_REL or higher" README.md
	# Exhaustive README sweep: every Core version reference must equal the pin.
	# A prose line or install command that pin-core's patterns fail to reach would
	# otherwise keep a stale version silently -- the ADR-092 drift class. This asserts
	# the outcome (no wrong number survives) rather than trusting the patterns.
	STALE="$(grep -oE 'zenzic[>=]=[0-9]+\.[0-9]+\.[0-9]+|Zenzic Core v[0-9]+\.[0-9]+\.[0-9]+' README.md \
		| grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | sort -u | grep -v "^${CORE_REL}$" || true)"
	if [[ -n "$STALE" ]]; then
		echo "audit-release failed: README.md has Core version(s) not matching the pin ($CORE_REL):"
		echo "$STALE" | sed 's/^/  stale: /'
		echo "  Run 'just pin-core $CORE_REL', or extend _pin-core-apply if a pattern does not reach the line."
		exit 1
	fi
	echo "✅ audit-release: release metadata and core pin alignment are coherent."

_validate-semver version:
	#!/usr/bin/env bash
	set -euo pipefail
	if [[ ! "{{version}}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
		echo "Invalid version '{{version}}'. Use MAJOR.MINOR.PATCH"
		exit 2
	fi

_pin-core-apply version:
	#!/usr/bin/env bash
	set -euo pipefail
	sed -i 's/uv tool install "zenzic>=[0-9.]*"/uv tool install "zenzic>={{version}}"/g' README.md
	sed -i 's/pip install --upgrade "zenzic>=[0-9.]*"/pip install --upgrade "zenzic>={{version}}"/g' README.md
	sed -i 's/uv tool install zenzic==[0-9.]*/uv tool install zenzic=={{version}}/g' README.md
	sed -i 's/pip install zenzic==[0-9.]*/pip install zenzic=={{version}}/g' README.md
	sed -i 's/Zenzic Core v[0-9.]* or higher/Zenzic Core v{{version}} or higher/g' README.md
	sed -i 's/minimum required Core version (`v[0-9.]*`)/minimum required Core version (`v{{version}}`)/g' README.md
	sed -i 's/virtual environment containing Core `v[0-9.]*` or higher/virtual environment containing Core `v{{version}}` or higher/g' README.md
	sed -i 's/| \*\*Pinned Core\*\* | .* |/| **Pinned Core** | `zenzic>={{version}}` |/' RELEASE.md
	sed -i "s/\*\*Zenzic Core \`v[0-9.]*\`\*\* (\`MIN_CORE_VERSION = '[0-9.]*'\` in \`src\\/coreVersion.ts\`)./**Zenzic Core \`v{{version}}\`** (\`MIN_CORE_VERSION = '{{version}}'\` in \`src\\/coreVersion.ts\`)./g" CONTRIBUTING.md
	sed -i 's/| \*\*Zenzic Core\*\* | ≥ [0-9.]* |/| **Zenzic Core** | ≥ {{version}} |/' CONTRIBUTING.md
	sed -i "s/export const MIN_CORE_VERSION = '[0-9.]*';/export const MIN_CORE_VERSION = '{{version}}';/g" src/coreVersion.ts

# Realign the Zenzic Core pin in README.md, RELEASE.md, CONTRIBUTING.md, and src/coreVersion.ts.
# Usage: just pin-core <version>
pin-core version:
	#!/usr/bin/env bash
	set -euo pipefail
	just _validate-semver "{{version}}"
	if [ -n "$(git status --porcelain)" ]; then
		echo "Working tree is not clean. Commit or stash changes before pin-core."
		exit 3
	fi
	echo "Aligning Zenzic Core pin to {{version}}..."
	just _pin-core-apply "{{version}}"
	git add README.md RELEASE.md CONTRIBUTING.md src/coreVersion.ts
	git commit -S -s -m "chore(deps): pin zenzic core to {{version}}"

# Simulate a Zenzic Core pin realignment and print the diff without writing files.
# Usage: just pin-core-dry <version>
pin-core-dry version:
	#!/usr/bin/env bash
	set -euo pipefail
	just _validate-semver "{{version}}"
	echo "==> Dry-run: changes that 'just pin-core {{version}}' would apply"
	echo ""
	echo "--- README.md ---"
	grep -nE 'zenzic[>=]=[0-9.]*|Zenzic Core v[0-9.]+ or higher|minimum required Core version \(`v[0-9.]+`\)|virtual environment containing Core `v[0-9.]+` or higher' README.md \
		| sed -E \
			-e 's/zenzic>=[0-9.]*/zenzic>={{version}}/g' \
			-e 's/zenzic==[0-9.]*/zenzic=={{version}}/g' \
			-e 's/Zenzic Core v[0-9.]+ or higher/Zenzic Core v{{version}} or higher/g' \
			-e 's/minimum required Core version \(`v[0-9.]+`\)/minimum required Core version (`v{{version}}`)/g' \
			-e 's/virtual environment containing Core `v[0-9.]+` or higher/virtual environment containing Core `v{{version}}` or higher/g' || echo "  (no occurrences)"
	echo ""
	echo "--- RELEASE.md ---"
	grep -n 'Pinned Core' RELEASE.md \
		| sed 's/zenzic>=[0-9.]*/zenzic>={{version}}/' || echo "  (no occurrences)"
	echo ""
	echo "--- CONTRIBUTING.md ---"
	grep -nE 'Minimum Core Baseline|\| \*\*Zenzic Core\*\* \|' CONTRIBUTING.md \
		| sed -E "s/\*\*Zenzic Core \`v[0-9.]+\`\*\*/**Zenzic Core \`v{{version}}\`**/g; s/MIN_CORE_VERSION = '[0-9.]+'/MIN_CORE_VERSION = '{{version}}'/g; s/\| \*\*Zenzic Core\*\* \| ≥ [0-9.]+ \|/| **Zenzic Core** | ≥ {{version}} |/g" || echo "  (no occurrences)"
	echo ""
	echo "--- src/coreVersion.ts ---"
	grep -n "MIN_CORE_VERSION = '[0-9.]*';" src/coreVersion.ts \
		| sed "s/MIN_CORE_VERSION = '[0-9.]*';/MIN_CORE_VERSION = '{{version}}';/" || echo "  (no occurrences)"

# Remove generated artefacts
clean:
	rm -rf out/ .tsbuildinfo
	find . -maxdepth 1 -name '*.vsix' -delete

# Blocking gate, not a warning. A pre-commit hook that is merely declared in
# .pre-commit-config.yaml runs nothing: the hook has to be installed into
# .git/hooks for the commit-time gate to exist at all. Three of the four
# ecosystem repositories were found with no hook installed, so every commit
# in them bypassed markdownlint, REUSE and the formatter silently.
#
# A missing pre-commit hook cannot block its own commit -- there is nothing
# installed to run -- so this check fails `just verify` instead, which is the
# pre-push path and what CI runs. Exit 1, never a warning: the previous
# version of this recipe printed the same diagnosis and let the work proceed.
# Blocking gate, not a warning. A pre-commit hook that is merely declared in
# .pre-commit-config.yaml runs nothing: the hook has to be installed into
# .git/hooks for the commit-time gate to exist at all. Three of the four
# ecosystem repositories were found with no hook installed, so every commit
# in them bypassed markdownlint, REUSE and the formatter silently.
#
# A missing pre-commit hook cannot block its own commit -- there is nothing
# installed to run -- so this check fails `just verify` instead, which is the
# pre-push path and what CI runs. Exit 1, never a warning: the previous
# version of this recipe printed the same diagnosis and let the work proceed.
_check-hooks:
    #!/usr/bin/env bash
    set -euo pipefail
    # CI checks out a bare working tree and never commits from it, so git hooks
    # are meaningless there -- and requiring them would fail every run for a
    # condition no CI job can or should fix. The gate exists for the machine
    # where commits are actually authored.
    if [ -n "${CI:-}" ]; then
        echo "CI environment: git-hook check skipped (hooks gate local commits only)"
        exit 0
    fi
    _missing=0
    for _h in pre-commit pre-push; do
        if [ ! -f ".git/hooks/${_h}" ] || ! grep -qi "pre-commit" ".git/hooks/${_h}"; then
            echo -e "\033[31mBLOCKED: the ${_h} hook is not installed (or is not pre-commit's).\033[0m"
            echo "  Without it the ${_h} gate does not run, and defects reach the remote."
            echo "  Fix: uvx pre-commit install -t ${_h}"
            _missing=1
        fi
    done
    if [ "${_missing}" -ne 0 ]; then
        echo ""
        echo "Refusing to continue with an uninstalled git hook. See Rule 31."
        exit 1
    fi
    echo "git hooks installed (pre-commit, pre-push)"
