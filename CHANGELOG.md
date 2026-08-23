# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

*Upcoming changes for the next release.*

### Added

- **Specification-Driven Development (SDD) IntelliSense & Schema Support**:
  - Synchronized `zenzic.schema.json` with the 4 new SDD policy definitions in `PoliciesConfig` (`required_table_columns`, `table_cell_enums`, `required_heading_order`, `traceability_targets`), enabling instant auto-complete and validation inside `.zenzic.toml`.
- **Core Engine v0.31.0 Integration**:
  - Integrated Zenzic Core v0.31.0 Language Server Protocol diagnostics for GFM Table AST parsing and real-time squiggles for rules `Z521`, `Z522`, `Z523`, and `Z412`.

### Changed

- **Brand & Positioning Alignment**:
  - Updated extension description and README value proposition: *"Formatters handle syntax. Prose linters handle grammar. Zenzic protects the graph—and optionally enforces lightweight editorial policy without a separate tool."*

### Fixed

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
