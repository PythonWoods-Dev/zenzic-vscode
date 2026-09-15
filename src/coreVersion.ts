// SPDX-FileCopyrightText: 2026 PythonWoods
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Minimum Zenzic Core version required by this extension.
 *
 * Single source of truth — imported by both extension.ts (version handshake
 * before starting the LSP client) and provisioning.ts (the version pin used
 * when auto-installing zenzic). Kept in its own module specifically so
 * neither of those two files needs to import from the other for this value.
 *
 * Updated automatically by `just pin-core <version>` / `just release <part>
 * <core>` (see justfile's _pin-core-apply) — not by `.bumpversion.toml`,
 * which bumps this extension's own release version, a different concept
 * from the minimum required core version.
 */
export const MIN_CORE_VERSION = '0.30.0';
