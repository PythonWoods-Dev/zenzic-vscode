<p align="center">
  <img src="images/logo.png" width="128" alt="Zenzic Logo">
</p>

<h1 align="center">Zenzic: Deterministic Document Integrity (VS Code Extension)</h1>

<p align="center">
  <strong>Deterministic Document Integrity Engine and SAST for Markdown/MDX graphs in VS Code.</strong>
</p>

---

Zenzic brings the exact same $O(N)$ SAST engine used in your CI/CD pipelines directly into your authoring environment, providing sub-50ms topological feedback and real-time diagnostic reporting as you type.

## Thin Client Architecture

This extension is a strictly **Thin Client**. It contains zero parsing logic, zero regex engines, and zero validation rules. It communicates via the Language Server Protocol (LSP) over standard I/O directly with the `zenzic` Python binary installed on your system.

---

## Key Features

### 1. Security Scanning (SAST)
Hardcoded credentials (Z201) and path traversal sequences (Z202/Z203) are flagged in milliseconds using RE2 validation engine rules, preventing secret leaks before files are committed.

### 2. Graph Topology Analysis (VSM)
Modify a heading or link in one file, and Zenzic's Virtual Site Map (VSM) instantly invalidates any broken links, orphan pages, or dead navigation nodes across your entire workspace using $O(K)$ incremental graph patching.

### 3. Adapter-Driven Config Hot-Reloading (`v0.25.0`)
When framework configuration files (e.g. `mkdocs.yml`, `zensical.toml`, `.zenzic.toml`) are modified, the Language Server automatically reloads adapter metadata and rebuilds the Virtual Site Map without requiring an extension or editor restart.

### 4. Inline Diagnostics & Quick Fixes
Hover over any diagnostic to view the exact Z-Code, DQS score penalty, and remediation guidance. Apply automated Quick Fixes via `textDocument/codeAction` directly from the editor lightbulb menu.

### 5. DQS Workspace UI
Stream Document Quality Score (DQS) updates directly to the status bar, providing real-time visibility into overall repository health.

### Real-Time Diagnostics vs. Global DQS

To guarantee sub-50ms performance, Zenzic operates with a strict separation of concerns in the editor:

- **Real-Time Diagnostics (PROBLEMS Panel):** AST rules (e.g., Z502, Z505) and local topology checks are executed incrementally in memory on every keystroke.
- **Global DQS (Status Bar):** The Documentation Quality Score requires a full repository audit. To prevent editor lag, the DQS is computed *on-demand*. Click the `Zenzic DQS` item in the Status Bar to execute a background CLI bridge and update the global score.

---

## Requirements

This extension requires **Zenzic Core v0.26.0 or higher**.

We recommend installing or updating the global binary via `uv`:

```bash
uv tool install --force zenzic
```

Or via `pip`:

```bash
pip install --upgrade zenzic
```

---

## Extension Settings

By default, the extension resolves the `zenzic` executable from your system `$PATH`.

If you use a local virtual environment or custom installation path, configure the executable path in your workspace or user `settings.json`:

```json
{
  "zenzic.executablePath": "${workspaceFolder}/.venv/bin/zenzic",
  "zenzic.trace.server": "verbose"
}
```

---

## Troubleshooting

### Zenzic: Outdated Core

- **Cause**: The executable resolved by the extension is older than the minimum required Core version (`v0.26.0`).
- **Remediation**: Upgrade your global binary:
  ```bash
  uv tool install --force zenzic
  ```
  Or point `zenzic.executablePath` in `settings.json` to a virtual environment containing Core `v0.26.0` or higher.


### Zenzic: Not Found (ENOENT)

- **Cause**: The `zenzic` executable is not present in the system `$PATH`. This commonly occurs in Flatpak, Snap, or isolated terminal environments where user binary directories (`~/.local/bin`) are omitted from process environments.
- **Remediation**: Specify the absolute path to the binary in `settings.json`:
  ```json
  {
    "zenzic.executablePath": "/home/user/.local/bin/zenzic"
  }
  ```

---

## Architectural Guarantees

- **Zero Telemetry:** Zenzic operates entirely locally. No data is sent to external servers.
- **Zero LLMs:** All analysis is mathematically deterministic. No probabilistic guessing.
- **Sub-50ms Latency:** Incremental $O(K)$ graph patching ensures instant feedback regardless of workspace scale.
- **100% CLI Parity:** Shared core governance pipeline ensures bit-for-bit identical diagnostics between VS Code and CI/CD.

---

## License & Support

Licensed under Apache-2.0. For complete finding taxonomy and developer guides, visit [zenzic.dev](https://zenzic.dev).
