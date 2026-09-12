<!--
SPDX-FileCopyrightText: 2026 PythonWoods <dev@pythonwoods.dev>
SPDX-License-Identifier: Apache-2.0
-->

# Contributing to zenzic-vscode

Thank you for contributing to the official Zenzic VS Code Extension!

`zenzic-vscode` is a strictly **Thin Client** extension providing real-time inline diagnostics, Quick Fixes, and DQS scoring in VS Code by communicating via Language Server Protocol (LSP) with Zenzic Core.

---

## Multi-Repo Ecosystem Architecture

Zenzic is structured across three independent, dedicated repositories:

| Repository | Purpose | Primary Stack |
|:---|:---|:---|
| **[zenzic](https://github.com/PythonWoods-Dev/zenzic)** | Python Core analysis engine & CLI (`src/zenzic`) | Python 3.10+, `uv`, `pytest`, `mypy` |
| **[zenzic-vscode](https://github.com/PythonWoods-Dev/zenzic-vscode)** (this repo) | Official VS Code Extension (LSP Thin Client) | TypeScript, Node.js 24+, VS Code API |
| **[zenzic-action](https://github.com/PythonWoods-Dev/zenzic-action)** | Official GitHub Action CI/CD Wrapper | YAML, Bash, SARIF Upload |

---

## Architecture Principles

- **Thin Client Sovereignty**: `zenzic-vscode` contains **zero** AST parsing, regex checks, or link validation rules. All analysis logic resides in Zenzic Core (`zenzic lsp`).
- **Protocol Parity**: The extension communicates via standard Language Server Protocol (LSP) over stdio.
- **Minimum Core Baseline**: Currently pinned to **Zenzic Core `v0.30.0`** (`MIN_CORE_VERSION = '0.30.0'` in `src/coreVersion.ts`).

---

## Enterprise Governance & Contribution Policy

To maintain security, architectural integrity, and legal compliance, all contributions must adhere to these guidelines:

1. **Issue-First Policy**: No Pull Request will be reviewed or merged unless it is preceded by an Issue formally discussed and approved by maintainers. Link the approved Issue in your PR description.
2. **Mandatory Cryptographic Commit Signatures**: Every commit must be cryptographically signed using GPG, SSH, or S/MIME keypairs (appearing as **Verified** on GitHub). Unsigned commits will be rejected by branch rulesets. An official tool can remove this property while reporting success — GitHub's own `gh pr update-branch --rebase` re-creates commits server-side and the result verifies as `unsigned`, so re-do such an update locally with signing configured.
3. **Linear History — No Merge Commits**: the default branch ruleset enforces a linear history, so a merge commit on a branch targeting it is **rejected at push time** with `GH013: ... This branch must not contain merge commits`. Bring a branch up to date with `git rebase origin/main`, never `git merge origin/main`; if you have already made the merge, reset to the commit before it and rebase instead. This is stated here because the rule is enforced by the platform and was, until 2026-09-12, documented nowhere — a contributor met it only by being refused. Every requirement in this list is imposed by this repository's **ruleset**. The older per-branch protection API declares nothing here and is not used anywhere in this ecosystem. To see exactly which rules apply to you, run `gh api repos/PythonWoods-Dev/zenzic-vscode/rules/branches/main`.
4. **No AI Slop Clause**: We enforce a strict policy against unverified AI-generated code. Contributors must fully understand, explain, and architecturally justify every single line of code proposed in a PR.
5. **Developer Certificate of Origin (DCO)**: All commits must include a `Signed-off-by:` line (using `git commit -s`) certifying compliance with the DCO.
6. **Conventional Commits**: Commit messages must strictly follow the Conventional Commits specification (e.g., `feat(vscode): add status bar DQS tooltip (#45)`).

---

## Issue Templates

Opening a new issue offers two templates:

| Template | Use for |
|:---|:---|
| **Bug Report** | Unexpected behaviour or errors in the extension — diagnostics, Quick Fixes, DQS status bar, or LSP communication with Zenzic Core. |
| **Feature Request** | Proposing a new feature, command, or enhancement. |

For a security vulnerability, see [SECURITY.md](SECURITY.md) instead of opening a public issue.

---

## Prerequisites

| Requirement | Version | Notes |
|:---|:---|:---|
| **Node.js** | ≥ 24 | Extension runtime & build system |
| **npm** | required | Package manager |
| **just** | required | Task runner — `cargo install just` or via OS package manager |
| **reuse** | required | SPDX license auditor (`uv tool install reuse`) |
| **Zenzic Core** | ≥ 0.30.0 | Core engine (`uv tool install zenzic`) |

---

## Local Development Workflow

```bash
# 1. Clone repository
git clone git@github.com:PythonWoods-Dev/zenzic-vscode.git
cd zenzic-vscode

# 2. Install dependencies
npm install

# 3. Verify license headers and build
just verify
```

`just verify` runs linting (`eslint`), TypeScript type-checking (`tsc --noEmit`), unit tests with a
coverage gate (`vitest`), and REUSE compliance verification.

---

## Testing

Unit tests (`test/*.test.ts`, run via `vitest`, configured in [`vitest.config.mts`](vitest.config.mts)) currently cover `src/semver.ts` only. Any module
that imports `vscode` at the top level — which is most of `src/` — cannot be loaded by a plain
Node test runner. `vscode` is a virtual module VS Code injects at runtime, not a real npm package.
It only resolves inside a running Extension Host. Pure, `vscode`-independent logic (like the
version-comparison helper in `semver.ts`) is deliberately kept in its own module for exactly this
reason, mirroring `coreVersion.ts`'s existing pattern — extract before you can unit-test.

Extension Host integration tests live in `src/test/host/` and run with `npm run test:host`,
which downloads a VS Code build once (cached under `.vscode-test/`), loads the extension in
development mode and drives a real `zenzic lsp`. Point `ZENZIC_HOST_TEST_EXECUTABLE` at the
`zenzic` binary to use (for example a sibling core checkout's `.venv/bin/zenzic`); the launcher
writes it into a throwaway copy of the fixture workspace. On headless Linux wrap the command in
`xvfb-run -a`, which is what CI does. The fixture under `src/test/host/fixtures/` is deliberately
tiny and deliberately broken and is excluded from this repository's own lint and audit gates.

### Which VS Code the suite runs against

The suite is **pinned to the `engines.vscode` floor** in `package.json` (currently 1.91.0).
The launcher reads that field, so there is one number to maintain. The floor is the oldest
host the extension claims to support, and therefore the one most likely to lack an API the
code has started to use. Testing there catches a floor regression that a newer host would
tolerate silently. Floating on the latest release would do the opposite: an upstream change
could break the suite outside this project's control, and a genuine floor regression would
stay hidden.

Set `VSCODE_TEST_VERSION` to run against something else — `stable`, `insiders`, or an exact
version — for an on-demand check before a release or after an upstream change.

**Why the floor is 1.91.0.** Not because of this extension's own calls: of the 37 VS Code
APIs it uses, 34 exist since at least 1.60 and the newest three (`LogOutputChannel`,
`LogLevel`) arrived in 1.74. The binding constraint is `vscode-languageclient` 10.x, which
declares `engines.vscode ^1.91.0` and carries the file-operation forwarding the rename
feature depends on. Lowering the floor would mean downgrading the language client, which
is not worth a fourteen-month-old host.

**When to bump the floor.** Bump `engines.vscode` (and `@types/vscode` with it) when the
code needs an API the current floor lacks, or when the floor is older than what users
realistically run. Never bump it only to make the suite pass.

**What to check when bumping.** Run the suite on the new floor *and* on `stable`. Check
the test runner's own dependencies against the floor's Node version, not just the
extension: the floor's Electron ships an older Node, and a runner dependency that is
ESM-only will fail to load there with `ERR_REQUIRE_ESM` before a single test runs. That is
why `mocha` is held on the 11.x line.

---

## The Nightly Stable Run, and How to Trigger It by Hand

`Zenzic VS Code CI` runs the extension-host suite against the `engines.vscode`
floor — the oldest host we claim to support, and where a regression hides.
That floor is not what users run, so a separate workflow,
`.github/workflows/nightly-stable.yml`, runs the same suite against VS Code's
**stable** channel on a schedule.

It is deliberately not part of the pull-request gate: `stable` is a moving
target we do not control, and an upstream release breaking something would put
a red X on a pull request whose author did nothing wrong. A red X that means
"not your fault" is learned as noise.

**To run it by hand** — before a release, or to confirm an upstream breakage:

> GitHub → **Actions** → **Nightly (VS Code stable)** → **Run workflow** →
> pick the branch → **Run workflow**.

That button exists because the workflow declares a `workflow_dispatch` trigger;
without it the schedule would be the only way to run it.

Or from the CLI:

```bash
gh workflow run nightly-stable.yml --repo PythonWoods/zenzic-vscode
gh run list --workflow nightly-stable.yml --limit 1   # then watch it
```

A failure here means the extension breaks on the VS Code version users actually
have, while the PR gate stays green against the floor. That combination is the
signal this workflow exists to produce, and it belongs to the maintainer rather
than to whoever pushed last.

## Useful Commands (`justfile`)

| Task | Command | Description |
|:---|:---|:---|
| Verify | `just verify` | Run `eslint`, `tsc --noEmit`, `test-cov`, and `reuse lint` (pre-push gate) |
| Test | `just test-cov` | Run unit tests with a coverage gate (configured in `vitest.config.mts`) |
| Package | `just package` | Build and package extension into `.vsix` archive |
| Core Pin | `just pin-core <ver>` | Realign Zenzic Core version pin across docs & `coreVersion.ts` |
| Core Pin Dry-Run | `just pin-core-dry <ver>` | Preview file changes for core realignment |
| Show Versions | `just versions` | Display extension version and pinned core version |
| Release Dry-Run | `just release-dry minor 0.26.3` | Preview version bump + core-pin orchestration |
| Release | `just release minor 0.26.3` | Orchestrate extension bump + core-pin alignment in one signed commit |
| Release Audit | `just audit-release` | Verify release metadata and core pin alignment |
| Clean | `just clean` | Remove `out/` and build artifacts |

---

## Editor Tooling vs the Gate

**`just verify` is the authority on every finding; the editor is an interactive aid.**
The committed `.vscode/settings.json` pins `typescript.tsdk` to `node_modules/typescript/lib`,
so the editor's TypeScript language service uses the exact compiler version `npm` resolves
for the build — not the copy VS Code itself ships, which drifts with each VS Code update.
The ESLint extension (recommended in `.vscode/extensions.json`) resolves the workspace's
own `eslint` from `node_modules` by design, matching `npm run lint`.

One asymmetry cannot be closed: **markdownlint**. `just verify` pins `markdownlint-cli`
to the version the ecosystem gates on, while the VS Code markdownlint extension bundles
its own engine (`markdownlint-cli2`) and exposes no setting that points it at another
version. Both read the same `.markdownlint.json`, but behaviour can diverge in either
direction — mostly the editor flagging findings the gate's engine does not have. When
they disagree, the gate is right by definition: a squiggle the gate does not report needs
no code change, and a clean editor does not excuse a red `just verify`.

## Licensing & REUSE Compliance

All source files must contain an explicit SPDX header:

```typescript
// SPDX-FileCopyrightText: 2026 PythonWoods <dev@pythonwoods.dev>
// SPDX-License-Identifier: Apache-2.0
```

Run `reuse lint` or `just verify` to validate compliance before pushing.
