# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

*Upcoming changes for the next release.*

## [0.30.0] - 2026-08-15

### Added

- **Zenzic Core v0.30.0 Support**: Full Language Server Protocol (LSP) diagnostics and editor feedback for the new AST Semantic Linting suite (`Z513`–`Z520`) and Policy-as-Code Editorial Style governance (`Z617`–`Z619`).
- **Expanded Atomic Quick Fixes (`Ctrl+.` / `Cmd+.`)**: Real-time automated remediation for bare URLs (`Z515`), invalid heading punctuation (`Z517`), and malformed paragraph lists (`Z520`).
- **Zero-Config Auto-Provisioning Engine**: The extension now automatically detects and provisions an isolated Zenzic CLI engine if one is not found on your system. On first activation with a missing binary, a consent prompt is shown and the engine is installed via `uv` (primary) or `python3 -m venv` (fallback) into a sandboxed directory managed by the extension. No changes are made to the user's system `$PATH`, `~/.bashrc`, or any shell configuration.
- **Smart Workspace Resolver**: Robust `${workspaceFolder}` resolution across all active workspace folders for multi-root and umbrella-folder setups.
- **Telemetry Dashboard**: Rich Status Bar tooltip displaying core version, extension version, active executable path, and auto-provisioning status.
- **Context-Aware Status Bar (`zenzic.showStatus`)**: Interactive Status Bar item that re-triggers actionable recovery dialogs on error states and opens a quick action menu when running normally.
- **Troubleshoot & Repair Setup Wizard (`zenzic.troubleshoot`)**: Automated 4-point diagnostic wizard in the Command Palette to verify custom paths, system `$PATH`, isolated provisioning environments, and Core version health with 1-click self-healing remedies.
- **`zenzic.autoProvision` Setting**: New boolean setting (default: `true`) to opt out of automatic engine provisioning for corporate proxy environments or policy-restricted machines.
- **Standardized Packaging Automation**: Added `just package` recipe to `justfile` for building and packaging production `.vsix` artifacts via `@vscode/vsce package`.

### Fixed

- **Notification Freeze & Deadlock Fix**: Resolved UI thread deadlocks by executing `restartServer` asynchronously via `setTimeout` in notification action handlers ("Clear Setting" and "Troubleshoot"), allowing notification promises to resolve immediately.
- **Custom Path UX Trap**: Prevents infinite error loops by offering a "Clear Setting" fallback when an invalid custom `zenzic.executablePath` is configured.
- **Type Safety & Version Fallback**: Added robust string fallback in `createErrorTooltip` for `versionResult.error` when the core binary reports an unformatted or missing version string.


## [0.29.1] - 2026-08-14

### Changed

- **Core Baseline Alignment**: Realigned pinned Zenzic Core dependency to `v0.29.1`, inheriting core engine fixes for `Z401` (Missing Directory Index) false positives on dynamic directories.


## [0.29.0] - 2026-08-13

Release notes for the `v0.29.0` release series of the Zenzic VS Code Extension.

### Added

- **Real-Time Policy-as-Code LSP Support (`Z612`–`Z616`)**: Integrated real-time Language Server Protocol (LSP) diagnostics and editor feedback for all newly added Policy-as-Code governance rules (`Z612` Forbidden Frontmatter Key, `Z613` Frontmatter Schema Mismatch, `Z614` Unapproved Domain Reference, `Z615` Forbidden URL Scheme, and `Z616` Cross-Namespace Link Forbidden).

## Historical Releases

- v0.29.x archive: [changelogs/v0.29.x.md](./changelogs/v0.29.x.md)
- v0.28.x archive: [changelogs/v0.28.x.md](./changelogs/v0.28.x.md)
- v0.27.x archive: [changelogs/v0.27.x.md](./changelogs/v0.27.x.md)
- v0.26.x archive: [changelogs/v0.26.x.md](./changelogs/v0.26.x.md)
- v0.25.x archive: [changelogs/v0.25.x.md](./changelogs/v0.25.x.md)
- v0.24.x archive: [changelogs/v0.24.x.md](./changelogs/v0.24.x.md)
- v0.23.x archive: [changelogs/v0.23.x.md](./changelogs/v0.23.x.md)
- v0.22.x archive: [changelogs/v0.22.x.md](./changelogs/v0.22.x.md)
- v0.21.x archive: [changelogs/v0.21.x.md](./changelogs/v0.21.x.md)
