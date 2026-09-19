// SPDX-FileCopyrightText: 2026 PythonWoods
//
// SPDX-License-Identifier: Apache-2.0

/**
 * What Zenzic takes the open workspace to be: the engine a scan runs, and the
 * documentation generator detected in the repository.
 *
 * Both came from `zenzic env --json`, which reports them as of core v0.31.0.
 * Before that the engine appeared in exactly one place a person could read it
 * — the telemetry line of a `zenzic check` run — so the editor showed
 * diagnostics produced by an engine it could not name.
 *
 * Kept in its own module, with zero `vscode` import, so it can be unit-tested
 * with vitest rather than the Extension Host — the same reason `semver.ts`
 * lives apart.
 */

export interface ProjectIdentity {
    /** The engine a scan actually runs; `auto` is already resolved by the core. */
    engine: string;
    /** How it was chosen: `configured`, `auto-detected`, or `default`. */
    engineSource: string;
    /** The detected documentation generator, or null when none was found. */
    generator: string | null;
}

/**
 * Parse the stdout of `zenzic env --json`.
 *
 * Returns null rather than throwing on anything unexpected: this feeds a
 * status bar, and a status bar that throws takes the extension's activation
 * with it. An older core that does not report these fields is not an error —
 * it is simply a core with nothing to say here, and the caller falls back to
 * the plain health text.
 */
export function parseProjectIdentity(raw: string): ProjectIdentity | null {
    const start = raw.indexOf('{');
    if (start < 0) { return null; }
    let data: unknown;
    try {
        data = JSON.parse(raw.slice(start));
    } catch {
        return null;
    }
    if (typeof data !== 'object' || data === null) { return null; }
    const obj = data as Record<string, unknown>;
    if (typeof obj.engine !== 'string' || obj.engine === '') { return null; }
    return {
        engine: obj.engine,
        engineSource: typeof obj.engine_source === 'string' ? obj.engine_source : 'unknown',
        generator: typeof obj.generator === 'string' ? obj.generator : null
    };
}

/** Title-case a generator name for display: `astro` → `Astro`. */
function displayGenerator(generator: string): string {
    return generator.charAt(0).toUpperCase() + generator.slice(1);
}

/**
 * The status bar text.
 *
 * The health of the language server is carried by the icon — `$(check)`,
 * `$(error)`, `$(sync~spin)` — so the words are spent on what the icon cannot
 * say. With no identity to show, the previous wording is kept.
 */
export function statusBarText(identity: ProjectIdentity | null): string {
    if (identity === null) { return '$(check) Zenzic: Running'; }
    const suffix = identity.generator ? ` · ${displayGenerator(identity.generator)}` : '';
    return `$(check) Zenzic: ${identity.engine}${suffix}`;
}

/**
 * True when a generator was detected and the engine is not reading its routes.
 *
 * This is a working state, not an error: the scan runs and reports real
 * findings. It is worth surfacing because the site map it builds is derived
 * from the filesystem rather than from the generator's own routing, so a
 * project whose URLs are not one-to-one with its paths — a locale prefix, a
 * slug in frontmatter — is being checked against a map that is not quite its
 * site's.
 */
export function isEngineGeneratorMismatch(identity: ProjectIdentity | null): boolean {
    if (identity === null || identity.generator === null) { return false; }
    return identity.engine !== 'prebuilt';
}

/** The identity lines appended to the status bar's hover tooltip. */
export function identityTooltipLines(identity: ProjectIdentity | null): string[] {
    if (identity === null) { return []; }
    const lines = [
        `- **Engine**: \`${identity.engine}\` (${identity.engineSource})`,
        `- **Generator**: ${identity.generator ? `\`${identity.generator}\`` : '_none detected_'}`
    ];
    if (isEngineGeneratorMismatch(identity)) {
        lines.push(
            '',
            `${displayGenerator(identity.generator as string)} was detected and the engine is ` +
            `\`${identity.engine}\`, which derives URLs from file paths rather than reading a ` +
            'route manifest. Analysis runs; the site map may not match the published site.'
        );
    }
    return lines;
}
