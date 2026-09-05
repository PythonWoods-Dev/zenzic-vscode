// SPDX-FileCopyrightText: 2026 PythonWoods
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Compare two SemVer version strings.
 *
 * Returns a negative number if v1 < v2, positive if v1 > v2, zero if equal.
 * Only the major.minor.patch triple is compared (pre-release/build metadata
 * suffixes, if present, are ignored by the underlying regex match).
 *
 * Kept in its own module, with zero `vscode` import, specifically so it can
 * be unit-tested with a plain Node test runner rather than the Extension
 * Host — `extension.ts`/`provisioning.ts` import `vscode` at module scope,
 * which only resolves inside a running VS Code instance.
 */
export function compareSemver(v1: string, v2: string): number {
    const parse = (v: string) => {
        const match = v.match(/^(\d+)\.(\d+)\.(\d+)/);
        if (!match) {
            throw new Error(`Invalid SemVer format: '${v}'`);
        }
        return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
    };

    const [major1, minor1, patch1] = parse(v1);
    const [major2, minor2, patch2] = parse(v2);

    if (major1 !== major2) { return major1 - major2; }
    if (minor1 !== minor2) { return minor1 - minor2; }
    return patch1 - patch2;
}
