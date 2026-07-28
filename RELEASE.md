<!-- SPDX-FileCopyrightText: 2026 PythonWoods <dev@pythonwoods.dev> -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
# Release Procedure — Zenzic VS Code Extension

> **[MAINTAINER SOP]** *This document contains the Standard Operating Procedure for compiling and publishing a new release of the Zenzic VS Code Extension. It is automatically synchronized by the bump tool.*

## Release Metadata

| Field | Value |
| :--- | :--- |
| **Extension Version** | 0.26.2 |
| **Pinned Core** | `zenzic>=0.26.3` |
| **Date** | 2026-07-11 |

## 1. Pre-Flight Checklist

Before bumping the version, ensure the workspace is pristine:

- [ ] `just verify` — exits 0 (ESLint, TSC, REUSE compliance verified)
- [ ] `CHANGELOG.md` — `[Unreleased]` section contains all new features and fixes
- [ ] `package.json` — dependencies are secure and lockfile is synced (`npm ci`)

## 2. Bump Version

Do not manually edit version strings. Rely on the automated pipeline.

```bash
# Automate version bump (updates package.json, README.md, CHANGELOG, RELEASE.md, and CONTRIBUTING.md)
just release <patch|minor|major>
```

## 3. Tag & Push

> [!IMPORTANT]
> The tag **must** be pushed **after** the bump commit is already on `origin/main`.
> Tagging a local commit that has not yet been pushed causes the tag to point to a commit
> unknown to GitHub, which silently skips the `release.yml` trigger.

```bash
# 1. Merge the release branch into main via PR first!
# 2. Switch to main and pull latest
git checkout main
git pull origin main

# 3. Create the immutable signed tag pointing to the HEAD of origin/main
git tag -s -m "Release v0.26.2" v0.26.2
git push origin v0.26.2
```

## 4. Distribute (Automated)

Distribution is fully automated via GitHub Actions (`.github/workflows/release.yml`).

1. **GitHub Release:** The CI pipeline intercepts the tag push, automatically builds the `.vsix` package, creates the official GitHub Release, and attaches the binary asset. **No manual upload is required.**
2. **VS Marketplace (Public Only):** Automated Marketplace publication is currently deferred until the repository transitions to public status.
