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
| **[zenzic](https://github.com/PythonWoods/zenzic)** | Python Core analysis engine & CLI (`src/zenzic`) | Python 3.10+, `uv`, `pytest`, `mypy` |
| **[zenzic-vscode](https://github.com/PythonWoods/zenzic-vscode)** (this repo) | Official VS Code Extension (LSP Thin Client) | TypeScript, Node.js 24+, VS Code API |
| **[zenzic-action](https://github.com/PythonWoods/zenzic-action)** | Official GitHub Action CI/CD Wrapper | YAML, Bash, SARIF Upload |

---

## Architecture Principles

- **Thin Client Sovereignty**: `zenzic-vscode` contains **zero** AST parsing, regex checks, or link validation rules. All analysis logic resides in Zenzic Core (`zenzic lsp`).
- **Protocol Parity**: The extension communicates via standard Language Server Protocol (LSP) over stdio.
- **Minimum Core Baseline**: Currently pinned to **Zenzic Core `v0.27.1`** (`MIN_CORE_VERSION = '0.27.1'` in `src/extension.ts`).

---

## Enterprise Governance & Contribution Policy

To maintain security, architectural integrity, and legal compliance, all contributions must adhere to these guidelines:

1. **Issue-First Policy**: No Pull Request will be reviewed or merged unless it is preceded by an Issue formally discussed and approved by maintainers. Link the approved Issue in your PR description.
2. **Mandatory Cryptographic Commit Signatures**: Every commit must be cryptographically signed using GPG, SSH, or S/MIME keypairs (appearing as **Verified** on GitHub). Unsigned commits will be rejected by branch rulesets.
3. **No AI Slop Clause**: We enforce a strict policy against unverified AI-generated code. Contributors must fully understand, explain, and architecturally justify every single line of code proposed in a PR.
4. **Developer Certificate of Origin (DCO)**: All commits must include a `Signed-off-by:` line (using `git commit -s`) certifying compliance with the DCO.
5. **Conventional Commits**: Commit messages must strictly follow the Conventional Commits specification (e.g., `feat(vscode): add status bar DQS tooltip (#45)`).

---

## Prerequisites

| Requirement | Version | Notes |
|:---|:---|:---|
| **Node.js** | ≥ 24 | Extension runtime & build system |
| **npm** | required | Package manager |
| **just** | required | Task runner — `cargo install just` or via OS package manager |
| **reuse** | required | SPDX license auditor (`uv tool install reuse`) |
| **Zenzic Core** | ≥ 0.27.1 | Core engine (`uv tool install zenzic`) |

---

## Local Development Workflow

```bash
# 1. Clone repository
git clone git@github.com:PythonWoods/zenzic-vscode.git
cd zenzic-vscode

# 2. Install dependencies
npm install

# 3. Verify license headers and build
just verify
```

`just verify` runs linting (`eslint`), TypeScript type-checking (`tsc --noEmit`), and REUSE compliance verification.

---

## Useful Commands (`justfile`)

| Task | Command | Description |
|:---|:---|:---|
| Verify | `just verify` | Run `eslint`, `tsc --noEmit`, and `reuse lint` (pre-push gate) |
| Core Pin | `just pin-core <ver>` | Realign Zenzic Core version pin across docs & `extension.ts` |
| Core Pin Dry-Run | `just pin-core-dry <ver>` | Preview file changes for core realignment |
| Show Versions | `just versions` | Display extension version and pinned core version |
| Release Dry-Run | `just release-dry minor 0.26.3` | Preview version bump + core-pin orchestration |
| Release | `just release minor 0.26.3` | Orchestrate extension bump + core-pin alignment in one signed commit |
| Release Audit | `just audit-release` | Verify release metadata and core pin alignment |
| Clean | `just clean` | Remove `out/` and build artifacts |

---

## Licensing & REUSE Compliance

All source files must contain an explicit SPDX header:

```typescript
// SPDX-FileCopyrightText: 2026 PythonWoods <dev@pythonwoods.dev>
// SPDX-License-Identifier: Apache-2.0
```

Run `reuse lint` or `just verify` to validate compliance before pushing.
