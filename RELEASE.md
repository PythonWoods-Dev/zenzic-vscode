<!-- SPDX-FileCopyrightText: 2026 PythonWoods <dev@pythonwoods.dev> -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
# Release Procedure — Zenzic VS Code Extension

> **[MAINTAINER SOP]** *This document contains the Standard Operating Procedure for compiling and publishing a new release of the Zenzic VS Code Extension. It is automatically synchronized by the bump tool.*

## Release Metadata

| Field | Value |
| :--- | :--- |
| **Extension Version** | 0.30.0 |
| **Pinned Core** | `zenzic>=0.30.0` |
| **Date** | 2026-07-11 |

## 1. Pre-Flight Checklist

Before bumping the version, ensure the workspace is pristine:

- [ ] `just verify` — exits 0 (ESLint, TSC, REUSE compliance verified)
- [ ] `CHANGELOG.md` — `[Unreleased]` section contains all new features and fixes
- [ ] `package.json` — dependencies are secure and lockfile is synced (`npm ci`)

## 2. Bump Version

Do not manually edit version strings. `bump-my-version` rewrites 8 files in one
step; editing one by hand leaves the others stale, and `just audit-release` then
fails on the mismatch.

```bash
# Same thing, writing nothing — run this first
just release-dry <patch|minor|major>

# Orchestrated release: bump extension version + align core pin in one flow
just release <patch|minor|major> <core-version>
```

Validate before tag/push:

```bash
just audit-release
```

## 3. Tag & Push

> [!IMPORTANT]
> The tag **must** be pushed **after** the bump commit is already on `origin/main`.
> Tagging a local commit that has not yet been pushed causes the tag to point to a commit
> unknown to GitHub, which silently skips the `release.yml` trigger.

```bash
# 1. Merge the release branch into main via PR. SQUASH — see below.
# 2. Switch to main and pull latest
git checkout main
git pull origin main

# 3. Create the immutable signed tag pointing to the HEAD of origin/main
just release-tag            # always -s, and verifies its own output
git push origin v0.30.0
```

### Where the pre-squash commits go

Pull requests are merged with **squash**: it is the only one of GitHub's merge
methods this repository's rules allow. A merge commit is rejected, and a rebase
merge is refused with `Base branch requires signed commits. Rebase merges
cannot be automatically signed by GitHub`.

The individual commits of a pull request remain available afterwards, including
once its branch has been deleted:

```bash
git fetch origin refs/pull/88/head:refs/heads/pr-88-history
git log pr-88-history
```

### Why the tag has a recipe

A lightweight `git tag v0.30.0` produces an object GitHub reports as type
`commit`, with no signature of its own, and it still triggers the release
workflow. `just release-tag` always uses `-s` and verifies that its own output
is annotated and signed before anything is pushed.

## 4. Distribute (Automated)

Distribution is fully automated via GitHub Actions (`.github/workflows/release.yml`).

1. **GitHub Release:** The CI pipeline intercepts the tag push, automatically builds the `.vsix` package, creates the official GitHub Release, and attaches the binary asset. **No manual upload is required.**
2. **VS Marketplace (Public Only):** Automated Marketplace publication is currently deferred until the repository transitions to public status.
