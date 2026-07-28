# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.26.1] - 2026-07-27

### Changed

- **Core Parity Alignment (`VSCODE-ALIGN-007`)**: Realigned the VS Code extension release notes with Zenzic Core `0.26.1`, including adapter contract formalization (`CORE-FIX-005`) and VSM URL route parity improvements (`CORE-FIX-003`).

### Fixed
- **Tilde Expansion (`VSCODE-FIX-006`)**: Implemented native tilde (`~`) and `${workspaceFolder}` expansion for the `zenzic.executablePath` setting, eradicating `ENOENT` errors when configuring custom binary paths in Unix-like environments.
- **Documentation (`DOCS-VSCODE-001`)**: Added factual documentation explaining the architectural split between real-time incremental diagnostics (PROBLEMS panel) and the on-demand global DQS computation (Status Bar).

## [0.26.0] - 2026-07-26

### Added

- **Async DQS Status Bar Bridge (`ECOSYSTEM-FEAT-002`)**: Restored the Documentation Quality Score (DQS) in the VS Code Status Bar (`$(dashboard) Zenzic DQS: {score}/100`) via an asynchronous `child_process.execFile` execution bridge calling `zenzic score --json`, guaranteeing 100% mathematical determinism with CI/CD without blocking LSP performance.
- **Command Palette Contributed Command**: Added `zenzic.computeDQS` ("Zenzic: Compute Global DQS") command to manually trigger workspace score evaluation on demand.

## [0.25.4] - 2026-07-26

### Fixed

- **Status Bar DQS Deprecation (`LSP-FIX-014`)**: Removed misleading DQS Status Bar notification display and listener to preserve the Determinism invariant between incremental LSP mode and CLI batch mode. Restored stable `Zenzic: Running` status indicator.

## [0.25.3] - 2026-07-26

### Changed

- **Core Parity Alignment (`VSCODE-ALIGN-006`)**: Realigned pinned Zenzic Core baseline to `0.25.3`, inheriting fixes for Zensical static asset resolution, dynamic blog route classification, and PolyglotExtractor AST reference link definition extraction (`CORE-FIX-001`).


## [0.25.2] - 2026-07-26

### Changed

- **Core Parity Alignment (`VSCODE-ALIGN-005`)**: Realigned pinned Zenzic Core baseline to `0.25.2`, inheriting the `Z202` (Path Traversal) security fix for `docs_root`-boundary escape detection in editor sessions.


## [0.25.1] - 2026-07-26

### Changed

- **Core Parity Alignment (`VSCODE-ALIGN-004`)**: Realigned pinned Zenzic Core baseline to `0.25.1`, inheriting LSP fixes for inline suppression parity (`Z603`) and adapter-level `material/blog` plugin recognition (`Z103`/`Z402`).


## [0.25.0] - 2026-07-25

### Changed

- **Core Parity Alignment (`VSCODE-ALIGN-003`)**: Realigned pinned Zenzic Core baseline to `0.25.0`, delivering LSP fixes for centralized core governance filtering and adapter-driven configuration hot-reloading (`LSP-FIX-009`).


## [0.24.4] - 2026-07-24

### Changed

- **Core Parity Alignment**: Realigned pinned Zenzic Core baseline to `0.24.4`, ensuring editor LSP client compatibility with Core user exclusion enforcement (`LSP-FIX-007`).

## [0.24.3] - 2026-07-24

### Changed

- **Core Parity Alignment**: Realigned pinned Zenzic Core baseline to `0.24.3`, delivering LSP fixes for `docs_root` fallback and VS Code-specific build directory exclusions (`out`, `.vscode-test`).

## [0.24.2] - 2026-07-24

### Changed

- **Core Parity Alignment (`VSCODE-ALIGN-002`)**: Realigned pinned Zenzic Core baseline to `0.24.2`, ensuring editor LSP client compatibility with Core exclusion enforcement and asset VSM resolution.

## [0.24.1] - 2026-07-24

### Fixed

- **Remediation Command Auto-Execution (`VSCODE-FIX-004`)**: Fixed terminal execution parameter (`addNewLine = true`) in `terminal.sendText('uv tool install --force zenzic', true)`, ensuring remediation actions execute automatically without unsubmitted command prompts.

### Changed

- **Strict Quality Gate Verification (`VSCODE-CI-002`)**: Enforced strict REUSE check in `justfile` `verify` recipe, failing deterministically with exit code 1 if `reuse` is not installed.

## [0.24.0] - 2026-07-24

### Added

- **Real-Time DQS Status Bar Integration (`VSCODE-CLIENT-005`)**: Registered `zenzic/dqsUpdate` notification handler on Language Client to display live DQS score and penalty metrics in the VS Code Status Bar.

## [0.23.7] - 2026-07-23

### Fixed

- **Core Version Handshake Pinning (`VSCODE-CLIENT-004`)**: Updated `just pin-core` and `just versions` commands to manage `MIN_CORE_VERSION` in `src/extension.ts`, ensuring version handshake parity with Zenzic Core 0.23.3.

## [0.23.6] - 2026-07-23

## [0.23.5] - 2026-07-23

### Fixed

- **Language Client Document Selector (`VSCODE-CLIENT-003`)**: Restricted documentSelector file scheme targets to explicit `.md` and `.mdx` filename patterns (`pattern: '**/*.{md,mdx,markdown}'`), preventing non-markdown files from triggering language server events.

## [0.23.4] - 2026-07-22

### Fixed
- **Executable Resolution (`VSCODE-CLIENT-002`)**: Formalized `resolveExecutablePath` in `src/extension.ts` with cross-platform fallback logic using `os.homedir()` and `path.join()`. Automatically inspects `~/.local/bin`, `~/.cargo/bin`, and `~/.uv/bin` to ensure binary discovery when VS Code is launched via desktop GUI environment.

## [0.23.3] - 2026-07-22

### Changed
- **Toolchain Modernization**: Migrated to official `@vscode/vsce` package and modernized prepublish scripts (`node esbuild.js --production`), eliminating `DEP0190` shell injection deprecation warnings (`VSCODE-PR-023-3-OPTIMIZATION`).

### Fixed
- **Package Sanitization**: Configured `.vscodeignore` to exclude development artifacts (`.architect/`, `.zenzic_cache/`, `example/`), pointer governance files (`ROADMAP.md`), and placeholder images (`images/demo*.gif`), producing an ultra-lean VSIX payload of 8 required files (`VSCODE-PKG-002`, `VSCODE-PKG-003`).

## [0.23.2] - 2026-07-22

### Added
- **Strict Core Version Handshake**: Added pre-initialization version check (`checkCoreVersion`) using `child_process.execFile` to verify Zenzic Core version `>= 0.23.1` before launching the LSP client, preventing silent failures with stale binaries (`VSCODE-CLIENT-001-VERSION-HANDSHAKE`).

### Fixed
- **Marketplace Asset Integrity**: Updated `.vscodeignore` to exclude `.pytest_cache` and build artifacts while ensuring `images/logo.png` is correctly bundled in extension packages (`VSCODE-PKG-001-ASSET-INTEGRITY`).

## [0.23.1] - 2026-07-22

### Added
- **LSP Diagnostic Formatting Support**: Surfaced Z-Code diagnostic message prefixes (`[{code}]`) and LSP 3.16/3.17 `codeDescription` documentation links emitted by Zenzic Core 0.23.1.

## [0.23.0] - 2026-07-18

### Changed
- **LSP Diagnostics Integration:** Updated to support Zenzic Core's new graph-wide diagnostic sync. Modifications to a single buffer now immediately trigger validation updates across dependent files via the new transport-agnostic `IncrementalAnalysisEngine`.
- **Hover Resolution:** Hover metadata is now accurately mapped and presented based on the exact character position by querying the underlying deterministic Virtual Site Map via the Zenzic Language Server.

## [0.22.3] - 2026-07-14

### Highlights
This release synchronizes the VS Code extension with the **Zenzic Core v0.22.3** patch, restoring 100% diagnostic parity between the editor and the CLI.

### Core Improvements Inherited
By updating to `v0.22.3` (and ensuring your local Zenzic installation is updated to `>=0.22.3`), the Language Server now correctly surfaces the following real-time diagnostics that were previously masked in the editor:
- **`Z603` (Dead Suppression):** Unused `zenzic:ignore` comments are now highlighted in real-time.
- **`Z501` / `Z502` (Content Hygiene):** Placeholder text and short content warnings now correctly fire even in workspaces without a `.zenzic.toml` configuration file.
- **Strict URP Ordering:** Security path traversal attempts (`Z202`/`Z203`) are now correctly prioritized over standard broken link (`Z101`) errors in the editor UI.

## [0.22.2] - 2026-07-14

## [0.22.1] - 2026-07-14

## [0.22.0] - 2026-07-12

### Changed

- **Core Dependency:** Pinned `zenzic>=0.22.0`. The extension now requires Zenzic Core v0.22.0, which grants the Language Server (ZLS) real-time global topological awareness via the Virtual Site Map (VSM).

### Added

- **Real-Time Structural Validation (via Core):** Upgrading to Core v0.22.0 unlocks live feedback for structural Z-Codes (`Z101 Broken Link`, `Z104 File Not Found`, `Z105 Absolute Path`) directly in the editor as files are created or deleted in the workspace.

### Documentation

- Translated `ROADMAP.md` entirely into English to comply with ADR-022 (English-Only documentation invariant).
- Marked the Real-Time Global Context (VSM) milestone as `Completed` and scheduled Code Actions (Quick Fixes) for `v0.23.0`.

## [0.21.5] - 2026-07-12

## [0.21.4] - 2026-07-11

## [0.21.3] - 2026-07-11

### Fixed
- **Extension host:** Prevented `vscode-languageclient` from automatically injecting an unsupported `--stdio` flag into the Zenzic startup arguments, which previously caused a fatal crash and infinite restart loop on startup.
## [0.21.2] - 2026-07-11

## [0.21.2] — 2026-07-11
### Fixed
- **Extension host — A1:** Replaced `catch (error: any)` with `catch (err: unknown)` and a proper `instanceof Error` type guard, preventing silent `"Error: undefined"` messages when a non-Error value was thrown.
- **Extension host — A2:** Added an idempotent guard flag to `restartServer()` to prevent concurrent restart calls from spawning multiple LSP client instances simultaneously (race condition).
- **Extension host — A3:** Added `.catch(() => {})` to `client.stop()` in `deactivate()` so a rejection from an already-exited server process no longer surfaces as an unhandled error.
- **Extension host — A4:** Typed `statusBarItem` as `vscode.StatusBarItem | undefined` to align the declaration with its actual lifecycle (initialized inside `activate()`).
- **Extension host — A5:** Documented the intentional `debug: run` configuration (thin-client design decision — server-side debugging is done by attaching directly to the zenzic process).
- **Extension host — A6:** Added pre-flight validation for non-default `executablePath` settings: if the binary is not found/executable before attempting to spawn the LSP, an immediate, user-friendly error notification is shown instead of a cryptic LSP crash message.
- **CI/CD — C1:** Aligned `release.yml` action versions with `ci.yml` (`actions/checkout@v7`, `actions/setup-node@v6`).
- **CI/CD — C2:** Removed redundant `npm run build` step from `release.yml`; `vsce package` already runs `vscode:prepublish` (which calls `npm run build --production`) internally — previously caused two consecutive builds.
- **CI/CD — C3:** Upgraded `softprops/action-gh-release` from `v2` to `v3` for Node 24 runtime compatibility.
- **Tooling — E1:** Removed stale reference to `.eslintrc.json` from `REUSE.toml` (file was deleted during ESLint Flat Config migration in `0.21.1`).
- **Tooling — B2:** Re-enabled `@typescript-eslint/no-explicit-any` and `@typescript-eslint/no-unused-vars` as `warn` (were incorrectly set to `off`).
- **Tooling — B1:** Added comprehensive documentation to the `Module._load` shim in `eslint.config.mjs` explaining the workaround's scope, risk, and removal criteria.
- **Tooling — F1:** Removed redundant `noImplicitAny: true` from `tsconfig.json` (already enabled by `strict: true`).
- **Tooling — F2:** Bumped `tsconfig.json` `target` and `lib` from `es2020` to `es2022` to align with the Node 24 runtime.

## [0.21.1] — 2026-07-11
### Changed
- **Infrastructure:** Consolidated major dependency upgrades across the repository. Bumped TypeScript to v7, migrated ESLint to Flat Config (`eslint.config.mjs`), and updated `vscode-languageclient` to v10. Updated GitHub Actions runner environments to latest LTS versions.


## [0.21.0] - 2026-07-11

### Added
- Initial VS Code Extension Thin Client Release.
