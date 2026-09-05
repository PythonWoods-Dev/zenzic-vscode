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

<h1 align="center">Zenzic: Markdown Link Checker &amp; Docs Linter for VS Code</h1>

<p align="center">
  <strong>Catches broken links, missing anchors, orphan pages, and leaked credentials in Markdown and MDX — inline, as you type.</strong>
</p>

<p align="center">
  <em>Formatters handle syntax. Prose linters handle grammar. Zenzic protects the graph—and optionally enforces lightweight editorial policy without a separate tool.</em><br>
  For documentation whose Markdown carries contracts: table-schema validation, AST-powered quick fixes, and workspace quality scoring, all inline in VS Code.
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

A link to a page that no longer exists, an anchor renamed out from under its references, a page
orphaned by a moved file — these break between files, so a single-file checker never sees them.
Zenzic builds a graph of your whole workspace and re-checks it on every keystroke, marking
breakage inline the moment you introduce it. No save, no rebuild.

It runs the same engine as the Zenzic CLI and your CI pipeline, so what you see underlined in the
editor is exactly what the pull request gate will report.

---

## ⚡ Quick Start (< 30 Seconds)

Get real-time link, structure, and credential checking in three simple steps:

### 1. Install Zenzic CLI Engine

In most cases, **you can skip this step** — the extension handles it automatically on first use.

If you prefer a manual install (a one-off alternative, not the default): `uv tool install "zenzic>=0.30.0"`.

### 2. Install the Extension

Search for **Zenzic** in the VS Code Extensions Marketplace (`Ctrl+Shift+X`) and click **Install**.

### 3. Open Any Markdown File

Open your documentation repository. Type a broken link or an unformatted URL:

```markdown
<!-- Type this into any Markdown file -->
See our [guide](missing-page.md) or visit https://zenzic.dev
```

You will immediately see:

1. **Red underline** on `missing-page.md` (`Z101: Link Broken`).
2. **Yellow underline** on `https://zenzic.dev` (`Z515: Bare URL Used`).
3. Press **`Ctrl+.`** (or **`Cmd+.`** on macOS) on the bare URL to automatically format it into `<https://zenzic.dev>`.

---

## Requirements

**Just VS Code** — that's it for most users. Requires Zenzic Core v0.30.0 or higher.

The extension automatically detects the `zenzic` Python CLI engine. If it is not found, it will prompt you to install it in a **fully isolated environment** managed by the extension itself. No changes are ever made to your system Python, `$PATH`, or shell configuration (`.bashrc` / `.zshrc`).

> **Power User / Corporate Proxy Note:** If you prefer to manage the installation yourself — or if auto-provisioning is blocked by a corporate proxy — install the CLI manually (a one-off alternative, not the default) and the extension will use it:
>
> ```bash
> # Recommended: isolated tool install via uv
> uv tool install "zenzic>=0.30.0"
>
> # Or via standard pip
> pip install --upgrade "zenzic>=0.30.0"
> ```

<!-- Two distinct callouts, deliberately separate blocks. -->

> **Virtual Environment Note:** If you use a repository virtual environment, pin the path in `.vscode/settings.json`:
>
> ```json
> { "zenzic.executablePath": "${workspaceFolder}/.venv/bin/zenzic" }
> ```
>
> To disable auto-provisioning entirely, set `"zenzic.autoProvision": false`.

---

## 🎯 What It Catches

Everything below runs on the same keystroke-speed pass. The first two are the reason to install
the extension; the rest come along with them.

### The graph, as you type

Move a file or rename a heading, and Zenzic's Virtual Site Map instantly flags broken
cross-references, missing anchors, and orphan pages across the whole workspace — no save, no
rebuild. This is the class of defect no single-file checker can see, because it only exists
between files.

### Credentials, before they reach git

Leaked API keys and tokens (GitHub, AWS, Stripe) and path-traversal sequences are flagged the
moment they're typed, using Google RE2 non-backtracking matching. These findings are never
suppressible.

### Everything else it flags while it's there

| Area | Codes | What you get |
| :--- | :--- | :--- |
| **Accessibility & semantics** | `Z513`–`Z517`, `Z520` | Duplicate headings, generic image alt text, bare URLs, multiple H1s, heading punctuation, malformed lists — most with a one-key fix. |
| **Editorial policy** | `Z610`–`Z619` | Required/forbidden frontmatter, external-domain allowlisting, cross-namespace limits, forbidden terms, document complexity caps. |
| **Prose heuristics** | `Z518`, `Z519` | Passive voice and weasel words. RE2 pattern matching, not NLP — it flags candidates ("was reviewed by", "it is believed that"), not every instance a human editor would catch. |

### Fixing what it finds

Press `Ctrl+.` (`Cmd+.`) on any finding for a deterministic Quick Fix — bare URLs, heading
punctuation, malformed lists, untagged code fences, dead suppressions — or to insert an inline
`<!-- zenzic:ignore ZXXX -->` when an exception is genuinely warranted. Two workspace behaviors
extend this and are **off by default**: `zenzic.autoFixOnSave` applies those same fixes on every
save, and `zenzic.autoRepairLinksOnRename` rewrites inbound relative links when you move a file.

Your workspace's DQS (Documentation Quality Score) sits in the Status Bar, computed exactly as
your CI computes it — the number you see locally is the number CI will report. **Zenzic: Compute
Global DQS** refreshes it; the **Quality Status Panel** breaks down suppression-cap usage and
baseline freshness.

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
| `zenzicLanguageServer.trace.server` | `"off"` | Trace communication between VS Code and the Language Server (`off`, `messages`, `verbose`). Set it in `settings.json` — it is provided by the language-client library rather than contributed by the extension, so it does not appear in the Settings UI. |

### Command Palette

The extension contributes the following commands (`Ctrl+Shift+P` / `Cmd+Shift+P`):

| Command | Identifier | Description |
| :--- | :--- | :--- |
| **Zenzic: Restart Server** | `zenzic.restartServer` | Restarts the Language Server and re-indexes all workspace documents. |
| **Zenzic: Compute Global DQS** | `zenzic.computeDQS` | Executes on-demand global audit and updates the Status Bar score. |
| **Zenzic: Show Quality Status Panel** | `zenzic.showQualityPanel` | Opens a WebView showing Quality Score, Suppression Cap Usage, and Baseline Freshness as governance metrics — reuses the same `zenzic score --json` result already fetched by `zenzic.computeDQS`, no additional process spawned. |
| **Zenzic: Start Server** | `zenzic.startServer` | Starts the Zenzic Language Server background process. |
| **Zenzic: Stop Server** | `zenzic.stopServer` | Stops the Language Server process. |
| **Zenzic: Show Status / Recovery** | `zenzic.showStatus` | Re-triggers error recovery dialogs or opens the quick action menu. |
| **Zenzic: Troubleshoot & Repair Setup** | `zenzic.troubleshoot` | Runs automated environment diagnostics and offers 1-click self-healing repairs. |
| **Zenzic: Report Finding as GitHub Issue** | `zenzic.reportFindingAsIssue` | Opens a prefilled GitHub issue for the finding under the cursor (code, file, line, message, versions). No sign-in and no API call — it opens a URL you review before submitting. |

### Workspace Configuration Example

Configure a repository virtual environment in `.vscode/settings.json`:

```json
{
  "zenzic.executablePath": "${workspaceFolder}/.venv/bin/zenzic"
}
```

> **Note:** If you configure an invalid custom `zenzic.executablePath`, the extension will prompt you to clear the setting to safely fall back to the auto-provisioned engine.

---

## 🏗️ Under the Hood

The extension contains no parsing logic, no regex engines, and no validation rules of its own. It is a thin Language Server Protocol (LSP) client that talks to your local `zenzic` Python binary over JSON-RPC on stdio — fast enough to run on every keystroke without noticeable lag.

Two consequences worth knowing:

- **One engine, everywhere.** The editor runs the same rules, config loader, and adapters as your CLI and CI, so a finding means the same thing in all three. One exception: orphan and dead-end page detection currently uses two independent algorithms in the LSP and the CLI — see the Core's [`CHANGELOG.md` Known Limitations](https://github.com/PythonWoods-Dev/zenzic/blob/main/CHANGELOG.md#unreleased).
- **Upgrades need no extension release.** Upgrading the `zenzic` CLI gives the extension every new rule and fix immediately.

Full architecture: [zenzic.dev](https://zenzic.dev).

---

## 📦 Ecosystem Integration

Zenzic provides a unified quality platform across your entire development lifecycle:

- **[Zenzic CLI (Core Engine)](https://github.com/PythonWoods-Dev/zenzic)**: High-speed terminal static analyzer, batch auto-fixer, and quality-scoring engine.
- **[Zenzic GitHub Action](https://github.com/PythonWoods-Dev/zenzic-action)**: Zero-config CI/CD quality gate with SARIF code scanning and PR annotations.
- **[Official Documentation](https://zenzic.dev)**: For deep architectural explanations, full finding taxonomies, and configuration playbooks, visit [zenzic.dev](https://zenzic.dev).

---

## 📄 License

Licensed under the [Apache License, Version 2.0](https://opensource.org/licenses/Apache-2.0).
Copyright (c) 2026 PythonWoods `<dev@pythonwoods.dev>`.

---

## Legal Disclaimer

*Visual Studio Code, VS Code, and the Visual Studio Code logo are trademarks of Microsoft Corporation. Zenzic and the `zenzic-vscode` extension are independent, open-source projects and are not affiliated with, endorsed by, or sponsored by Microsoft Corporation.*
