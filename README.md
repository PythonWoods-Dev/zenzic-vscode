<p align="center">
  <img src="images/logo.png" width="128" alt="Zenzic Logo">
</p>

<h1 align="center">Zenzic: Deterministic Document Integrity (VS Code Extension)</h1>

<p align="center">
  <strong>Deterministic Document Integrity Engine for Markdown/MDX graphs in VS Code.</strong>
</p>

---

Zenzic brings the exact same $O(N)$ document integrity engine used in your CI/CD pipelines directly into your authoring environment, providing sub-50ms topological feedback and real-time diagnostic reporting as you type.

## Thin Client Architecture

This extension is a strictly **Thin Client**. It contains zero parsing logic, zero regex engines, and zero validation rules. It communicates via the Language Server Protocol (LSP) over standard I/O directly with the `zenzic` Python binary installed on your system.

---

## Key Features

### 1. Security Scanning

Hardcoded credentials (Z201) and path traversal sequences (Z202/Z203) are flagged in milliseconds using RE2 validation engine rules, preventing secret leaks before files are committed.

### 2. Graph Topology Analysis (VSM)

Modify a heading or link in one file, and Zenzic's Virtual Site Map (VSM) instantly invalidates any broken links, orphan pages, or dead navigation nodes across your entire workspace using $O(K)$ incremental graph patching.

### 3. Adapter-Driven Config Hot-Reloading

When framework configuration files (e.g. `mkdocs.yml`, `zensical.toml`, `.zenzic.toml`) are modified, the Language Server automatically reloads adapter metadata and rebuilds the Virtual Site Map without requiring an extension or editor restart.

### 4. Inline Diagnostics, Quick Fixes & Automated Suppressions

Hover over any diagnostic to view the exact Z-Code, DQS score penalty, and remediation guidance. Apply automated Quick Fixes or insert Automated Inline Suppressions (`<!-- zenzic:ignore:ZXXX -->`, except for `Z2xx` Security findings) via `textDocument/codeAction` directly from the editor lightbulb menu.

### 5. DQS Workspace UI & Status Tooltip

Stream Document Quality Score (DQS) updates directly to the status bar with versioning tooltips, providing real-time visibility into overall repository health and active Zenzic Core engine version.

### 6. Real-Time Policy-as-Code Diagnostics

Evaluates declarative `[policies]` rules line-by-line in real time as you edit, surfacing governance findings directly in the PROBLEMS panel. The full policy surface covered includes:

- **Metadata Validation** (`Z610`–`Z613`): required frontmatter keys, forbidden keys, and RE2 schema pattern enforcement.
- **Zero-Trust Link Governance** (`Z614`, `Z615`): external links not matching the `allowed_external_domains` whitelist, and links using disallowed URL schemes, are flagged inline as you type.
- **Cross-Namespace Boundary Violations** (`Z616`): links crossing restricted topological boundaries (defined via `cross_namespace_restrictions` in `.zenzic.toml`) are surfaced in real time using the Virtual Site Map (VSM).


### Real-Time Diagnostics vs. Global DQS

To guarantee sub-50ms performance, Zenzic operates with a strict separation of concerns in the editor:

- **Real-Time Diagnostics (PROBLEMS Panel):** AST rules (e.g., Z502, Z505) and local topology checks are executed incrementally in memory on every keystroke.
- **Global DQS (Status Bar):** The Documentation Quality Score requires a full repository audit. To prevent editor lag, the DQS is computed *on-demand*. Click the `Zenzic DQS` item in the Status Bar to execute a background CLI bridge and update the global score.

---

## Requirements

This extension requires **Zenzic Core v0.29.0 or higher**.

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

The extension currently contributes one user-facing setting:

- `zenzic.executablePath`: path to the `zenzic` executable or to the virtual-environment binary you want the extension to use. The extension expands `${workspaceFolder}` and a leading `~/` or `~\` automatically.

If you use a local virtual environment or custom installation path, configure it in your workspace or user `settings.json`:

```json
{
  "zenzic.executablePath": "${workspaceFolder}/.venv/bin/zenzic"
}
```

User-scoped home-directory paths are also supported:

```json
{
  "zenzic.executablePath": "~/custom_path/.venv/bin/zenzic"
}
```

## Commands

The extension contributes the following commands to the Command Palette:

- `Zenzic: Start Server`
- `Zenzic: Stop Server`
- `Zenzic: Restart Server`
- `Zenzic: Compute Global DQS`

---

## Troubleshooting

### Zenzic: Outdated Core

- **Cause**: The executable resolved by the extension is older than the minimum required Core version (`v0.29.0`).
- **Remediation**: Upgrade your global binary:

  ```bash
  uv tool install --force zenzic
  ```

  Or point `zenzic.executablePath` in `settings.json` to a virtual environment containing Core `v0.29.0` or higher.

### Zenzic: Not Found (ENOENT)

- **Cause**: The `zenzic` executable is not present in the system `$PATH`. This commonly occurs in Flatpak, Snap, or isolated terminal environments where user binary directories (`~/.local/bin`) are omitted from process environments.
- **Remediation**: Specify an explicit path to the binary in `settings.json`. `${workspaceFolder}` and leading `~/` / `~\` are expanded automatically:

  ```json
  {
    "zenzic.executablePath": "~/custom_path/.venv/bin/zenzic"
  }
  ```

- **Null-workspace note**: `${workspaceFolder}` requires an open workspace folder. If you open a standalone file without a workspace, use an absolute path or a `~/...` path instead.

### Logs and Observability

The extension creates the `Zenzic Language Server` output channel. Use it to inspect startup failures, transport errors, and language-server logs when diagnostics do not appear as expected.

---

## Architectural Guarantees

- **Zero Telemetry:** Zenzic operates entirely locally. No data is sent to external servers.
- **Zero LLMs:** All analysis is mathematically deterministic. No probabilistic guessing.
- **Sub-50ms Latency:** Incremental $O(K)$ graph patching ensures instant feedback regardless of workspace scale.
- **100% CLI Parity:** Shared core governance pipeline ensures bit-for-bit identical diagnostics between VS Code and CI/CD.

---

## License & Support

Licensed under Apache-2.0. For complete finding taxonomy and developer guides, visit [zenzic.dev](https://zenzic.dev).
