# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

*Upcoming changes for the next release.*

## [0.28.0] - 2026-08-11

### Added

- **Policy-as-Code Diagnostics (`V0.28-01`)**: Real-time support for inline Policy-as-Code diagnostics (`Z610` REQUIRED_FRONTMATTER_MISSING and `Z611` FORBIDDEN_DOMAIN_REFERENCE) in the VS Code editor diagnostic panel when declared in `.zenzic.toml`.
- **Custom Rule SDK v3 Integration (`V0.28-02`)**: Seamless rendering of custom diagnostics emitted by SDK v3 `ZenzicRuleV3` rules.

### Fixed

- **Path Sovereignty & AST Determinism**: Aligned core engine dependency to enforce strict workspace boundary checks (`Z202`) for symlink traversal and preserve line-offset precision across multiline AST comment blocks.

### Changed

- **Brand & Positioning Alignment (`V0.27-13`)**: Realigned extension description (`package.json`) and README to position Zenzic as a **Deterministic Document Integrity Engine** in VS Code, eradicating misleading "SAST" terminology (**Mirror Law ADR-020**).
- **Dependencies Bump**: Updated `@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser` to `^8.66.0`, and `github/codeql-action` to `v4.37.6`.

## Historical Releases

- v0.27.x archive: [changelogs/v0.27.x.md](./changelogs/v0.27.x.md)
- v0.26.x archive: [changelogs/v0.26.x.md](./changelogs/v0.26.x.md)
- v0.25.x archive: [changelogs/v0.25.x.md](./changelogs/v0.25.x.md)
- v0.24.x archive: [changelogs/v0.24.x.md](./changelogs/v0.24.x.md)
- v0.23.x archive: [changelogs/v0.23.x.md](./changelogs/v0.23.x.md)
- v0.22.x archive: [changelogs/v0.22.x.md](./changelogs/v0.22.x.md)
- v0.21.x archive: [changelogs/v0.21.x.md](./changelogs/v0.21.x.md)
