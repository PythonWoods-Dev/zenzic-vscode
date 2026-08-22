# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
