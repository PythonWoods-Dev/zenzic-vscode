<!--
SPDX-FileCopyrightText: 2026 PythonWoods <dev@pythonwoods.dev>
SPDX-License-Identifier: Apache-2.0
-->

<p align="center">
  <img src="images/logo.png" width="128" alt="Zenzic Logo">
</p>

<h1 align="center">Zenzic: Real-Time Documentation Quality for VS Code</h1>

<p align="center">
  <strong>Catch broken links, leaked credentials, and documentation defects directly in your editor.</strong><br>
  <em>Instant wavy-line feedback, one-click Quick Fixes, and deterministic quality scoring as you type.</em>
</p>

---

## Stop Broken Docs Before You Commit

Writing technical documentation shouldn't feel like guessing. **Zenzic for VS Code** brings the power of a deterministic compiler directly to Markdown and MDX files, eliminating broken references, accessibility defects, and security leaks in real time.

- **Instant Visual Feedback**: See inline squiggly underlines (red for critical errors, yellow for warnings) the exact millisecond a defect is introduced.
- **One-Click Quick Fixes (`Ctrl+.` / `Cmd+.`)**: Automatically repair bare URLs, invalid heading punctuation, malformed lists, untagged code blocks, and dead suppressions via the Atomic Mutator.
- **Zero-Latency Authoring**: Built on a pure-function Language Server Protocol (LSP) architecture with sub-50ms response times and zero editor lag.
- **Security & Privacy Guard**: Instantly flags accidental API tokens, secret keys, or internal private paths before files hit git.
- **Documentation Quality Score (DQS)**: Track your workspace's overall health score (0–100) directly in the VS Code Status Bar.

---

## ⚡ Quick Start (< 60 Seconds)

Get real-time documentation intelligence in three simple steps:

### 1. Install Zenzic CLI Engine

The VS Code extension communicates with the Zenzic core engine. Install or update it globally:

```bash
uv tool install zenzic
# or: pip install --upgrade zenzic
```

### 2. Install the Extension

Search for **Zenzic** in the VS Code Extensions Marketplace (`Ctrl+Shift+X`) and click **Install**.

### 3. Open Any Markdown File

Open your documentation repository. Type a broken link or an unformatted URL:

```markdown
<!-- Type this into any Markdown file -->
See our [guide](missing-page.md) or visit https://zenzic.dev
```

You will immediately see:
1. **Red underline** on `missing-page.md` (`Z104: File Not Found`).
2. **Yellow underline** on `https://zenzic.dev` (`Z515: Bare URL Used`).
3. Press **`Ctrl+.`** (or **`Cmd+.`** on macOS) on the bare URL to automatically format it into `<https://zenzic.dev>`.

---

## 🎯 Key Features at a Glance

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

---

## ⚙️ Extension Settings & Commands

### Settings

| Setting | Default | Description |
| :--- | :--- | :--- |
| `zenzic.executablePath` | `"zenzic"` | Path to the `zenzic` executable or virtual-environment binary. Supports `${workspaceFolder}` and leading `~/` or `~\`. |
| `zenzic.trace.server` | `"off"` | Trace communication between VS Code and the Language Server (`off`, `messages`, `verbose`). |

### Command Palette

The extension contributes the following commands (`Ctrl+Shift+P` / `Cmd+Shift+P`):

| Command | Identifier | Description |
| :--- | :--- | :--- |
| **Zenzic: Restart Server** | `zenzic.restartServer` | Restarts the Language Server and re-indexes all workspace documents. |
| **Zenzic: Compute Global DQS** | `zenzic.computeDQS` | Executes on-demand global audit and updates the Status Bar score. |
| **Zenzic: Start Server** | `zenzic.startServer` | Starts the ZLS Language Server background process. |
| **Zenzic: Stop Server** | `zenzic.stopServer` | Stops the Language Server process. |

### Workspace Configuration Example

Configure a repository virtual environment in `.vscode/settings.json`:

```json
{
  "zenzic.executablePath": "${workspaceFolder}/.venv/bin/zenzic"
}
```

---

## 🏗️ Under the Hood: The Thin Client Architecture

Zenzic for VS Code is designed with strict adherence to the **Thin Client Architecture** (**ADR-075 Radical Unawareness**).

The extension itself contains zero parsing logic, zero regex matching engines, and zero hardcoded validation rules. Instead, it acts as a high-performance Language Server Protocol (LSP) client that communicates directly with the local `zenzic` Python binary via JSON-RPC over standard input/output (`stdio`).

This architecture guarantees:
- **100% Behavioral Parity**: Diagnostics, finding codes, and auto-fixes in your editor match your local CLI runs and CI/CD pipelines bit-for-bit.
- **Zero Editor Bloat**: All AST indexing, Virtual Site Map graph updates, and regex computations execute in the compiled Python core, keeping VS Code lightweight and responsive.
- **Instant Engine Upgrades**: Upgrading the `zenzic` CLI immediately equips the VS Code extension with all newly released rules and mutations without waiting for extension marketplace releases.

---

## 📦 Ecosystem Integration

Zenzic provides a unified quality platform across your entire development lifecycle:

- **[Zenzic CLI (Core Engine)](https://github.com/PythonWoods/zenzic)**: High-speed terminal static analyzer, batch auto-fixer, and DQS scoring engine.
- **[Zenzic GitHub Action](https://github.com/PythonWoods/zenzic-action)**: Zero-config CI/CD quality gate with SARIF code scanning and PR annotations.
- **[Official Documentation](https://zenzic.dev)**: For deep architectural explanations, full finding taxonomies, and configuration playbooks, visit [zenzic.dev](https://zenzic.dev).

---

## 📄 License

Licensed under the [Apache License, Version 2.0](LICENSE).
Copyright (c) 2026 PythonWoods `<dev@pythonwoods.dev>`.
