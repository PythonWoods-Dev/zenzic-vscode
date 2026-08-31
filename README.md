<!--
SPDX-FileCopyrightText: 2026 PythonWoods <dev@pythonwoods.dev>
SPDX-License-Identifier: Apache-2.0
-->

<p align="center">
  <a href="https://github.com/PythonWoods-Dev/zenzic-vscode">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="./assets/zenzic-wordmark-vscode-dark.png">
      <source media="(prefers-color-scheme: light)" srcset="./assets/zenzic-wordmark-vscode.png">
      <img alt="Zenzic / vscode" src="./assets/zenzic-wordmark-vscode-dark.png" width="350">
    </picture>
  </a>
</p>

<h1 align="center">Zenzic: Real-Time Documentation Quality Platform (DQP) for VS Code</h1>

<p align="center">
  <strong>Formatters handle syntax. Prose linters handle grammar. Zenzic protects the graph—and optionally enforces lightweight editorial policy without a separate tool.</strong><br>
  <em>Instant Language Server diagnostics for Specification-Driven Development (SDD), real-time table contract validation, AST Quick Fixes, and continuous DQS scoring.</em>
</p>

<p align="center">
  <a href="https://github.com/PythonWoods-Dev/zenzic-vscode/releases">
    <img src="https://img.shields.io/github/v/release/PythonWoods-Dev/zenzic-vscode?style=flat-square&label=GitHub%20Release&color=38bdf8" alt="GitHub Release">
  </a>
  <a href="https://opensource.org/licenses/Apache-2.0">
    <img src="https://img.shields.io/badge/license-Apache--2.0-0d9488?style=flat-square" alt="License">
  </a>
</p>

---

## Protect the Documentation Graph as You Write

Writing technical specifications requires real-time integrity verification. **Zenzic for VS Code** integrates the **Documentation Quality Platform (DQP)** directly into your editor, evaluating Markdown & MDX table schemas, cross-file reference graphs, structural topology, accessibility rules, and credential leaks in real time.

- **Instant Visual Feedback**: See inline squiggly underlines (red for critical errors, yellow for warnings) the exact millisecond a defect is introduced.
- **One-Click Quick Fixes (`Ctrl+.` / `Cmd+.`)**: Automatically repair bare URLs, invalid heading punctuation, malformed lists, untagged code blocks, and dead suppressions via the Atomic Mutator.
- **Zero-Latency Authoring**: Built on a pure-function Language Server Protocol (LSP) architecture with sub-50ms response times and zero editor lag.
- **Security-First Protection**: Instantly flags accidental API tokens or secret keys before they hit your git history.
- **Deterministic Quality Score (DQS)**: Track your workspace's documentation quality score directly in the editor's Status Bar, computed on demand from the same deterministic engine used in CI.
- **Zero-Config Installation**: No manual setup required. If the Zenzic CLI is not found, the extension automatically provisions an isolated engine — no changes to your system PATH or shell configuration.

---

## ⚠️ Requirements

**Just VS Code** — that's it for most users. Requires Zenzic Core v0.30.0 or higher.

The extension automatically detects the `zenzic` Python CLI engine. If it is not found, it will prompt you to install it in a **fully isolated environment** managed by the extension itself. No changes are ever made to your system Python, `$PATH`, or shell configuration (`.bashrc` / `.zshrc`).

> **Power User / Corporate Proxy Note:** If you prefer to manage the installation yourself — or if auto-provisioning is blocked by a corporate proxy — install the CLI manually and the extension will use it:
> ```bash
> # Recommended: isolated tool install via uv
> uv tool install zenzic
>
> # Or via standard pip
> pip install --upgrade zenzic
> ```

> **Virtual Environment Note:** If you use a repository virtual environment, pin the path in `.vscode/settings.json`:
> ```json
> { "zenzic.executablePath": "${workspaceFolder}/.venv/bin/zenzic" }
> ```
> To disable auto-provisioning entirely, set `"zenzic.autoProvision": false`.

---

## ⚡ Quick Start (< 60 Seconds)

Get real-time documentation intelligence in three simple steps:

### 1. Install Zenzic CLI Engine

In most cases, **you can skip this step** — the extension handles it automatically on first use.

If you prefer a manual install: `uv tool install zenzic`.

### 2. Install the Extension

Search for **Zenzic** in the VS Code Extensions Marketplace (`Ctrl+Shift+X`) and click **Install**.

### 3. Open Any Markdown File

Open your documentation repository. Type a broken link or an unformatted URL:

```markdown
<!-- Type this into any Markdown file -->
See our [guide](missing-page.md) or visit https://zenzic.dev
```

You will immediately see:
1. **Red underline** on `missing-page.md` (`Z101: Link Broken` — cataloged as `Z104: File Not Found`, but the current engine reports missing-file links under the consolidated `Z101` code).
2. **Yellow underline** on `https://zenzic.dev` (`Z515: Bare URL Used`).
3. Press **`Ctrl+.`** (or **`Cmd+.`** on macOS) on the bare URL to automatically format it into `<https://zenzic.dev>`.

---

## 🎯 Key Features at a Glance

Zenzic for VS Code delivers comprehensive documentation intelligence directly inside the editor:

### 1. Real-Time Link & Asset Validation
Move a file or rename a heading in one document, and Zenzic's Virtual Site Map (VSM) instantly flags broken cross-references and orphan pages across your entire workspace without saving or rebuilding.

### 2. Instant Security & Credential Scanning
Detects leaked API keys, tokens (e.g., GitHub, AWS, Stripe), and path traversal sequences in milliseconds using Google RE2 non-backtracking safety contracts.

### 3. Native Semantic & Accessibility Linting
- **Duplicate Headings (`Z513`)**: Prevents anchor collision and broken URL fragments.
- **Generic Image Alt Text (`Z514`)**: Enforces descriptive alternative text for accessibility.
- **Bare URLs (`Z515`)**: Detects unformatted raw URLs with instant auto-fix.
- **Single H1 Hierarchy (`Z516`)**: Enforces clean semantic HTML document structure.
- **Heading Punctuation (`Z517`)**: Flags trailing periods, colons, or semicolons in headings with instant auto-fix.
- **Malformed Lists (`Z520`)**: Automatically converts pseudo-lists into clean Markdown bullet lists.

### 4. Policy-as-Code & Editorial Style Governance
Enforce organizational standards directly in the editor:
- Required or forbidden frontmatter metadata (`Z610`–`Z613`).
- Zero-Trust external domain whitelisting (`Z614`, `Z615`).
- Cross-namespace boundary restrictions (`Z616`).
- Passive voice heuristics (`Z518`) and weasel word eradication (`Z519`).
- Forbidden terminology patterns (`Z617`) and document complexity caps (`Z619`).

### 5. Automated Inline Suppressions
Need a temporary strategic exception? Press `Ctrl+.` on any finding to insert an inline suppression comment (`<!-- zenzic:ignore ZXXX -->`) that tracks technical debt transparently.

### 6. Opt-In Auto-Fix on Save & Auto-Repair on Rename
Beyond manual Quick Fix, two workspace behaviors are available but **off by default**: `zenzic.autoFixOnSave` applies the same deterministic Quick Fixes automatically whenever you save; `zenzic.autoRepairLinksOnRename` rewrites inbound relative links across the workspace whenever you rename or move a file. See the [Settings section](#settings) below.

---

## ⚙️ Extension Settings & Commands

Customize language client execution and invoke extension commands through standard VS Code workflows:

### Settings

| Setting | Default | Description |
| :--- | :--- | :--- |
| `zenzic.executablePath` | `"zenzic"` | Path to the `zenzic` executable or virtual-environment binary. Supports leading `~/` or `~\` and `${workspaceFolder}` (intelligently scans across all active workspace folders in multi-root setups). |
| `zenzic.autoProvision` | `true` | Automatically install the Zenzic CLI in an isolated environment if not found. Set to `false` to opt out. |
| `zenzic.autoFixOnSave` | `false` | Automatically apply Zenzic's deterministic Quick Fixes (bare URLs, untagged code blocks, empty link text, malformed lists, heading punctuation, dead suppressions) when a Markdown/MDX file is saved. Off by default — rewrites file content on every save, which can surprise a workflow or conflict with another on-save formatter. |
| `zenzic.autoRepairLinksOnRename` | `false` | Automatically rewrite inbound relative links when a Markdown/MDX file is renamed or moved. Off by default — unlike auto-fix-on-save, this can rewrite files you didn't directly touch. Docs-root-relative (`/...`) and `@site/...` alias links are always left untouched. |
| `zenzic.trace.server` | `"off"` | Trace communication between VS Code and the Language Server (`off`, `messages`, `verbose`). |

### Command Palette

The extension contributes the following commands (`Ctrl+Shift+P` / `Cmd+Shift+P`):

| Command | Identifier | Description |
| :--- | :--- | :--- |
| **Zenzic: Restart Server** | `zenzic.restartServer` | Restarts the Language Server and re-indexes all workspace documents. |
| **Zenzic: Compute Global DQS** | `zenzic.computeDQS` | Executes on-demand global audit and updates the Status Bar score. |
| **Zenzic: Show Quality Status Panel** | `zenzic.showQualityPanel` | Opens a WebView showing Quality Score, Suppression Cap Usage, and Baseline Freshness as governance metrics — reuses the same `zenzic score --json` result already fetched by `zenzic.computeDQS`, no additional process spawned. |
| **Zenzic: Start Server** | `zenzic.startServer` | Starts the ZLS Language Server background process. |
| **Zenzic: Stop Server** | `zenzic.stopServer` | Stops the Language Server process. |
| **Zenzic: Show Status / Recovery** | `zenzic.showStatus` | Re-triggers error recovery dialogs or opens the quick action menu. |
| **Zenzic: Troubleshoot & Repair Setup** | `zenzic.troubleshoot` | Runs automated environment diagnostics and offers 1-click self-healing repairs. |

### Workspace Configuration Example

Configure a repository virtual environment in `.vscode/settings.json`:

```json
{
  "zenzic.executablePath": "${workspaceFolder}/.venv/bin/zenzic"
}
```

> **Note:** If you configure an invalid custom `zenzic.executablePath`, the extension will prompt you to clear the setting to safely fall back to the Auto-Provisioning engine.

---

## 🏗️ Under the Hood: The Thin Client Architecture

Zenzic for VS Code is designed with strict adherence to the **Thin Client Architecture** (**ADR-075 Radical Unawareness**).

The extension itself contains zero parsing logic, zero regex matching engines, and zero hardcoded validation rules. Instead, it acts as a high-performance Language Server Protocol (LSP) client that communicates directly with the local `zenzic` Python binary via JSON-RPC over standard input/output (`stdio`).

This architecture guarantees:

- **Shared Engine, Shared Rules**: the extension runs the same rule engine, config loader, and adapter resolution as your local CLI and CI/CD pipeline — diagnostics and finding codes come from one Core, not a reimplementation in the extension. Topology detection (orphan/dead-end pages) is the one area where the LSP and the CLI currently use two independent algorithms rather than one shared primitive; see the Core's [`CHANGELOG.md` Known Limitations](https://github.com/PythonWoods-Dev/zenzic/blob/main/CHANGELOG.md#unreleased) for details.
- **Zero Editor Bloat**: All AST indexing, Virtual Site Map graph updates, and regex computations execute in the compiled Python core, keeping VS Code lightweight and responsive.
- **Instant Engine Upgrades**: Upgrading the `zenzic` CLI immediately equips the VS Code extension with all newly released rules and mutations without waiting for extension marketplace releases.

---

## 📦 Ecosystem Integration

Zenzic provides a unified quality platform across your entire development lifecycle:

- **[Zenzic CLI (Core Engine)](https://github.com/PythonWoods-Dev/zenzic)**: High-speed terminal static analyzer, batch auto-fixer, and DQS scoring engine.
- **[Zenzic GitHub Action](https://github.com/PythonWoods-Dev/zenzic-action)**: Zero-config CI/CD quality gate with SARIF code scanning and PR annotations.
- **[Official Documentation](https://zenzic.dev)**: For deep architectural explanations, full finding taxonomies, and configuration playbooks, visit [zenzic.dev](https://zenzic.dev).

---

## 📄 License

Licensed under the [Apache License, Version 2.0](https://opensource.org/licenses/Apache-2.0).
Copyright (c) 2026 PythonWoods `<dev@pythonwoods.dev>`.

---

## Legal Disclaimer

*Visual Studio Code, VS Code, and the Visual Studio Code logo are trademarks of Microsoft Corporation. Zenzic and the `zenzic-vscode` extension are independent, open-source projects and are not affiliated with, endorsed by, or sponsored by Microsoft Corporation.*
