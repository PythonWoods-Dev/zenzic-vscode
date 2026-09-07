# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

*Upcoming changes for the next release.*

### Added

- **Extension-Host Test Suite (`npm run test:host`)**: fourteen tests that launch a real VS Code
  via `@vscode/test-electron`, load the extension in development mode and drive a live
  `zenzic lsp`. They cover activation on Markdown, registration of every contributed command,
  a published `Z101` diagnostic, and auto-fix-on-save rewriting a bare URL. Auto-repair-on-rename
  is exercised across a single rename, a batch rename, two links to one target and a folder
  rename (skipped by design). Two more renames turn on letter case: a lowercase href to a
  mixed-case file, and a rename that changes only case. The first failed on the suite's first
  Windows run and led to a server-side fix (see the core CHANGELOG). The second found, from
  the Windows trace, that VS Code canonicalises a case-only target requested through
  `WorkspaceEdit.renameFile` onto the existing file: the participant receives the old URI
  twice and nothing is renamed. On that platform the test therefore pins the editor's
  behaviour, and that the server answers such an identity rename with no edit. Both run on
  every platform.
  Two documented limits are pinned too: an unsaved just-typed link
  is not repaired, because the link index is built from disk, and a canonical-URL collision is
  rewritten without being detected. CI runs the suite on the
  Linux job under `xvfb-run` and natively on the Windows job, in about 30 seconds each. Locally, point `ZENZIC_HOST_TEST_EXECUTABLE`
  at a `zenzic` binary; the launcher writes it into a throwaway copy of the fixture workspace,
  because VS Code rebuilds the extension host's environment from the login shell and ignores an
  inherited `PATH`. The suite also pins one behaviour the settings' descriptions do not state:
  a rename repair lands in the editor buffer and leaves the linking file dirty. It is not
  written to disk until saved.
  The suite runs against the `engines.vscode` floor (1.91.0) by default, with
  `VSCODE_TEST_VERSION` to override; see `CONTRIBUTING.md` for the version policy.
- **`Zenzic: Report Finding as GitHub Issue` Command**: opens a prefilled GitHub issue form for the finding under the cursor — carrying the finding code, file and line, the diagnostic message, and the extension and VS Code versions. Invoked from anywhere else in a file, it lists that file's findings and asks which to report. Implemented with `vscode.env.openExternal` and a query-string URL: no authentication, no token storage, no GitHub API call, and therefore no rate limit and no sign-in step. With no network it is the browser that reports the failure rather than the editor, and nothing is submitted until the prefilled form is reviewed and sent by hand. The issue body is bounded by construction (truncated to stay well inside GitHub's URL limit) rather than relying on finding messages being short.

- **Unit Test Suite & Coverage Gate**: previously this extension had zero automated tests of any
  kind — only `eslint`/`tsc --noEmit`. Added `vitest` + `@vitest/coverage-v8`, a real test suite
  (`test/semver.test.ts`, 8 cases, 100% coverage) for the version-comparison logic that gates LSP
  activation, and a coverage threshold (90% lines/branches/functions/statements) wired into
  `just verify`/CI via a new `just test-cov` recipe. `compareSemver` was extracted from
  `extension.ts` into its own `vscode`-import-free module (`src/semver.ts`, mirroring
  `coreVersion.ts`'s existing pattern) specifically so it can be loaded by a plain Node test
  runner — `vscode` is a virtual module that only resolves inside a running Extension Host.
  Extension-Host behaviour is covered separately by the `@vscode/test-electron` suite below.
- **`zenzic.autoFixOnSave` Setting — Auto-Apply Quick Fixes on Save (Opt-In, Off by Default)**:
  - New boolean setting; when enabled, saving a Markdown/MDX file auto-applies Zenzic's deterministic Quick Fixes (bare URLs, untagged code blocks, empty link text, malformed lists, heading punctuation). Off by default: silently rewriting file content on every save can surprise a workflow or conflict with another formatter also running on save. All trigger and fix logic lives server-side (Zenzic Core's LSP now implements `textDocument/willSaveWaitUntil`) — the extension only reads the setting, passes it via `initializationOptions` at startup, and forwards live changes through `workspace/didChangeConfiguration`, no server restart needed. The actual save hook is `vscode-languageclient`'s standard, automatic `workspace.onWillSaveTextDocument` → `textDocument/willSaveWaitUntil` forwarding — no client-side save-handling code was written, consistent with the Thin Client Architecture (ADR-075).
- **`zenzic.autoRepairLinksOnRename` Setting — Auto-Repair Inbound Links on Rename (Opt-In, Off by Default)**:
  - New boolean setting; when enabled, renaming or moving a Markdown/MDX file automatically rewrites relative links in every file that linked to it. Off by default — more invasive than auto-fix-on-save, since it can rewrite files you didn't directly touch. Docs-root-relative (`/...`) and `@site/...` alias links are always left untouched, and files excluded via `.zenzic.toml` are never rewritten. All trigger and fix logic lives server-side (Zenzic Core's LSP now implements `workspace/willRenameFiles`) — the extension only reads the setting and forwards it the same way as `zenzic.autoFixOnSave`, via `initializationOptions` and `workspace/didChangeConfiguration`. The rename hook is `vscode-languageclient`'s standard, automatic `workspace.onWillRenameFiles` → `workspace/willRenameFiles` forwarding — no client-side rename-handling code was written.
- **Specification-Driven Development (SDD) IntelliSense & Schema Support**:
  - Synchronized `zenzic.schema.json` with the 4 new SDD policy definitions in `PoliciesConfig` (`required_table_columns`, `table_cell_enums`, `required_heading_order`, `traceability_targets`), enabling instant auto-complete and validation inside `.zenzic.toml`.
- **Core Engine v0.31.0 Integration**:
  - Integrated Zenzic Core v0.31.0 Language Server Protocol diagnostics for GFM Table AST parsing and real-time squiggles for rules `Z521`, `Z522`, `Z523`, and `Z412`.

### Changed

- **Brand & Positioning Alignment**:
  - Updated extension description and README value proposition: *"Formatters handle syntax. Prose linters handle grammar. Zenzic protects the graph—and optionally enforces lightweight editorial policy without a separate tool."*

### Fixed

- **Stale GitHub Org Slug (`PythonWoods/zenzic-vscode` → `PythonWoods-Dev/zenzic-vscode`)**: the org was renamed at some point. `README.md`'s release badge and cross-repo links, `package.json` (`repository`/`bugs`/`homepage`), `CONTRIBUTING.md`, `SECURITY.md`, `ci.yml`'s real checkout/`ls-remote` steps against the `zenzic` Core sibling repo, and `zenzic.schema.json`'s example string all still referenced the old org. Non-breaking today (GitHub 301-redirects; live-verified via `curl`/`gh api`), but non-canonical. Same defect class already fixed in `zenzic` Core's own files this session.
- **Missing Third-Party Attribution for Bundled LSP Client Packages**:
  - esbuild bundles `vscode-languageclient` and its 4 transitive dependencies (`vscode-jsonrpc`, `vscode-languageserver-protocol`, `vscode-languageserver-textdocument`, `vscode-languageserver-types` — all MIT, Microsoft Corporation) directly into `out/extension.js`. Since `node_modules/` is excluded from the packaged `.vsix` (`.vscodeignore`), these packages' own `LICENSE` files were not otherwise preserved anywhere in the distributed extension. Added a `NOTICE` file (mirroring the `zenzic` Core repository's existing convention) listing all 5 packages' copyright and license, now shipped inside the `.vsix` alongside `LICENSE`.
- **Phantom `/docs/`-Prefixed Finding-Codes URL**:
  - The Z201 security-breach notification's "Reference" link pointed to `https://zenzic.dev/docs/reference/finding-codes#Z201`, which 404s — corrected to `https://zenzic.dev/reference/finding-codes/#z201`. Found via a global phantom-URL sweep across all four ecosystem repos; same defect class as an already-fixed `zenzic` core `README.md` issue.
- **Topological Suppression CodeAction Determinism (ADR-093)**:
  - The LSP server emits informative `disabled` CodeActions with `disabled.reason` for graph-level and topological finding codes (`Z401`, `Z402`, `Z404`, `Z405`, `Z406`, `Z410`, `Z411`, `Z412`, `Z620`) pointing users to `.zenzic.toml` instead of generating ineffective inline suppressions.
- **Quick-Start Walkthrough Drift**:
  - The README quick-start example claimed the extension shows `Z104: File Not Found` for a broken relative link, but the Core engine reports missing-file links under the consolidated `Z101 LINK_BROKEN` code — updated to match.
- **CI Packaging Leak**: the CI dogfooding checkout of `zenzic` Core (`_zenzic_core/`) was not excluded from either `reuse lint`'s file discovery or the packaged VSIX. This caused a REUSE compliance failure, since third-party package metadata got scanned as this project's own code. It also produced a 188.77 MB VSIX (7428 files) instead of the expected ~245 KB. Fixed by adding `_zenzic_core/` to `.gitignore` and `.vscodeignore`. A CI size guard now also fails the build if the packaged VSIX exceeds 5 MB, so this regression can't silently reach a published release again.

### Known Limitations

- **README Overclaim Corrected**: the README previously stated "100% Behavioral Parity... bit-for-bit" between the LSP and CLI/CI. This was inaccurate: most of the underlying engine (rule execution, config loading, adapter resolution) genuinely is shared, but topology detection (orphan/dead-end pages) currently runs on two independent algorithms — `Z402` (CLI, nav-membership-based) and `Z410`/`Z411` (LSP, VSM-graph-reachability-based). Softened to describe what's actually shared; the topology divergence is tracked as an open architectural decision in the Core repository's ADR vault, not silently accepted.

## Historical Releases

- v0.30.x archive: [changelogs/v0.30.x.md](./changelogs/v0.30.x.md)
- v0.29.x archive: [changelogs/v0.29.x.md](./changelogs/v0.29.x.md)
- v0.28.x archive: [changelogs/v0.28.x.md](./changelogs/v0.28.x.md)
- v0.27.x archive: [changelogs/v0.27.x.md](./changelogs/v0.27.x.md)
- v0.26.x archive: [changelogs/v0.26.x.md](./changelogs/v0.26.x.md)
- v0.25.x archive: [changelogs/v0.25.x.md](./changelogs/v0.25.x.md)
- v0.24.x archive: [changelogs/v0.24.x.md](./changelogs/v0.24.x.md)
- v0.23.x archive: [changelogs/v0.23.x.md](./changelogs/v0.23.x.md)
- v0.22.x archive: [changelogs/v0.22.x.md](./changelogs/v0.22.x.md)
- v0.21.x archive: [changelogs/v0.21.x.md](./changelogs/v0.21.x.md)
