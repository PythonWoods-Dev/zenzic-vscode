<!-- SPDX-FileCopyrightText: 2026 PythonWoods <dev@pythonwoods.dev> -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- markdownlint-disable MD041 -->

## Description
<!-- Describe the architectural intent of the changes and provide context. -->
Fixes #

## Type of Change

- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Breaking change (fix or feature breaking backward compatibility)
- [ ] Documentation update
- [ ] Refactoring / Tech Debt removal
- [ ] UX / DevEx improvement

## Governance & Compliance Checklist

- [ ] **DCO & Signatures:** All commits are signed with DCO (`git commit -s`) and GPG/SSH (`git commit -S`).
- [ ] **Issue-First:** This PR addresses an explicitly approved Issue.
- [ ] **Changelog:** I have updated `CHANGELOG.md` under the `## [Unreleased]` section.
- [ ] **Commit Standards:** Commit messages strictly follow the Conventional Commits specification.
- [ ] **Absolute Ownership:** I have verified and can architecturally justify every single line of code. No unreviewed AI-generated code is included.

## Architectural Quality Gates (VS Code Extension)

- [ ] **Thin Client (ADR-075 Radical Unawareness):** I have not added Markdown parsing logic, regex linters, or AST traversals to the TypeScript extension. All analysis remains delegated to Zenzic Core (`zenzic lsp`).
- [ ] **Local Quality Pipeline:** `npm run lint`, `npm run build`, and `just verify` pass without errors or warnings.
- [ ] **Packaging & VSIX Verification:** `just package` (or `npm run package`) builds the `.vsix` bundle cleanly.
- [ ] **REUSE Compliance:** `reuse lint` passes with 100% SPDX license header compliance.
