<!--
SPDX-FileCopyrightText: 2026 PythonWoods <dev@pythonwoods.dev>
SPDX-License-Identifier: Apache-2.0
-->

# Security Policy — zenzic-vscode

This document defines the security disclosure process for `zenzic-vscode`. For the Zenzic Core security policy, see [github.com/PythonWoods-Dev/zenzic](https://github.com/PythonWoods-Dev/zenzic/blob/main/SECURITY.md).

## Scope

This policy covers **zenzic-vscode** — the official VS Code extension, a strictly Thin
Client that communicates with Zenzic Core over the Language Server Protocol (LSP). The
extension itself contains **zero** AST parsing, regex checks, or link validation rules;
all analysis logic lives in Zenzic Core.

For vulnerabilities in the **Zenzic engine** (Python, credential scanner, path-traversal
protection), see the [core security policy](https://github.com/PythonWoods-Dev/zenzic/blob/main/SECURITY.md).

---

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report privately via:

- **GitHub Security Advisories** (preferred): [github.com/PythonWoods-Dev/zenzic-vscode/security/advisories](https://github.com/PythonWoods-Dev/zenzic-vscode/security/advisories)
- **Email**: `dev@pythonwoods.dev` — subject line: `[SECURITY] zenzic-vscode — <brief description>`

Include a clear description of the vulnerability, steps to reproduce, potential impact,
and a suggested fix if available.

We will acknowledge your report within **72 hours** and aim to release a patch within
**14 days** of confirming the issue.

---

## In-Scope Areas

| Area | Description |
|------|-------------|
| **Executable path resolution** | A condition under which `zenzic.executablePath` (which supports `${workspaceFolder}` interpolation) resolves to and executes a binary the user did not intend, without a workspace-trust prompt. |
| **Auto-provisioning integrity** | A scenario where `zenzic.autoProvision` installs the Zenzic CLI engine from an unexpected source, or without the isolation (`uv`/venv, no system Python/PATH changes) the setting's own description promises. |
| **LSP message handling** | A crafted diagnostic, code action, or other message from a Language Server response that causes the extension to execute code, write outside the workspace, or otherwise exceed its Thin Client role. |
| **Credential exposure in extension state** | A scenario where a secret detected by Core's credential scanner is persisted, logged, or displayed by the extension beyond the diagnostic message Core itself already redacts. |
| **Dependency CVE** | A known CVE in `vscode-languageclient` or another `npm` dependency that affects the extension's security posture. |

Out-of-scope: false-positive/false-negative findings from Zenzic Core's own checks (report
those against [zenzic](https://github.com/PythonWoods-Dev/zenzic/security/advisories/new)),
cosmetic UI issues, or documentation errors.

---

## Security Design Notes

`zenzic-vscode` is a **Thin Client**: it holds no analysis logic of its own and delegates
every diagnostic, Quick Fix, and DQS score to Zenzic Core via LSP (`zenzic lsp`). This
bounds the extension's own attack surface to process management and message-passing, not
document parsing.

**Workspace-relative executable paths**: `zenzic.executablePath` accepts `${workspaceFolder}`
expansion, so a workspace's own settings could in principle point the extension at a
binary inside that workspace. The extension does not declare
`capabilities.untrustedWorkspaces` in `package.json`, so it inherits VS Code's default
behavior for undeclared extensions: it does not activate in an untrusted workspace until
the user explicitly grants trust. This is a real, load-bearing part of the extension's
threat model, not an incidental detail — a report showing this boundary can be bypassed is
in scope above.

**Auto-provisioning**: when enabled (default: on), `zenzic.autoProvision` installs the
Zenzic CLI via `uv` or a `python3` venv, isolated from the system Python installation, PATH,
and shell configuration, per the setting's own description in `package.json`.

---

## Supported Versions

| Version | Support status |
|---------|----------------|
| `0.30.x` (current) | ✅ All security fixes |
| `< 0.30.0` | ❌ End of life — no support |

---

## Disclosure Policy

We follow a **coordinated disclosure** model. We ask that you allow up to 14 days for a
patch to be released before any public disclosure. Confirmed reporters will be credited in
the release changelog unless they prefer to remain anonymous.

---

See also: [README](README.md)
