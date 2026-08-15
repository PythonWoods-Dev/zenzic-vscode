# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

*Upcoming changes for the next release.*

### Added

- **Zenzic Core v0.30.0 Support**: Full Language Server Protocol (LSP) diagnostics and editor feedback for the new AST Semantic Linting suite (`Z513`–`Z520`) and Policy-as-Code Editorial Style governance (`Z617`–`Z619`).
- **Expanded Atomic Quick Fixes (`Ctrl+.` / `Cmd+.`)**: Real-time automated remediation for bare URLs (`Z515`), invalid heading punctuation (`Z517`), and malformed paragraph lists (`Z520`).

## [0.29.1] - 2026-08-14

### Changed

- **Core Baseline Alignment**: Realigned pinned Zenzic Core dependency to `v0.29.1`, inheriting core engine fixes for `Z401` (Missing Directory Index) false positives on dynamic directories.


## [0.29.0] - 2026-08-13

Release notes for the `v0.29.0` release series of the Zenzic VS Code Extension.

### Added

- **Real-Time Policy-as-Code LSP Support (`Z612`–`Z616`)**: Integrated real-time Language Server Protocol (LSP) diagnostics and editor feedback for all newly added Policy-as-Code governance rules (`Z612` Forbidden Frontmatter Key, `Z613` Frontmatter Schema Mismatch, `Z614` Unapproved Domain Reference, `Z615` Forbidden URL Scheme, and `Z616` Cross-Namespace Link Forbidden).

## Historical Releases

- v0.28.x archive: [changelogs/v0.28.x.md](./changelogs/v0.28.x.md)
- v0.27.x archive: [changelogs/v0.27.x.md](./changelogs/v0.27.x.md)
- v0.26.x archive: [changelogs/v0.26.x.md](./changelogs/v0.26.x.md)
- v0.25.x archive: [changelogs/v0.25.x.md](./changelogs/v0.25.x.md)
- v0.24.x archive: [changelogs/v0.24.x.md](./changelogs/v0.24.x.md)
- v0.23.x archive: [changelogs/v0.23.x.md](./changelogs/v0.23.x.md)
- v0.22.x archive: [changelogs/v0.22.x.md](./changelogs/v0.22.x.md)
- v0.21.x archive: [changelogs/v0.21.x.md](./changelogs/v0.21.x.md)
