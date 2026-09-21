// SPDX-FileCopyrightText: 2026 PythonWoods
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Zenzic Auto-Provisioning Engine
 *
 * Detects the zenzic CLI engine and, if absent, prompts the user for consent
 * before installing it into a VS Code-managed isolated environment.
 *
 * Architecture invariants:
 *   - Zero global PATH / shell-config pollution (uses context.globalStorageUri).
 *   - Zero parsing logic — this module only acquires the binary; the Core
 *     handles all document analysis (ADR-075 Radical Unawareness).
 *   - User consent is mandatory before any network or filesystem write.
 *   - uv is the primary installer; python3 -m venv is a Best-Effort fallback.
 */

import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { MIN_CORE_VERSION } from './coreVersion';

// ── Public types ──────────────────────────────────────────────────────────────

export type ProvisioningResult =
    /** Binary was already present on the system. */
    | { status: 'found';       executablePath: string }
    /** Binary was successfully installed by the engine. */
    | { status: 'provisioned'; executablePath: string }
    /** User dismissed the consent prompt. */
    | { status: 'declined' }
    /** `zenzic.autoProvision` is false — engine disabled by user policy. */
    | { status: 'disabled' }
    /** Installation attempt failed with a descriptive error. */
    | { status: 'failed';      error: string };

/**
 * Injected resolver function signature (matches `resolveExecutablePath` in
 * extension.ts). Using dependency injection avoids circular module imports.
 */
export type ResolveExecFn = (
    cmd: string,
    workspaceRoot?: string
) => Promise<string | undefined>;

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Run a child process and return its output.
 * - Rejects  if the binary itself is not found (ENOENT).
 * - Resolves for any other outcome (including non-zero exit codes), so callers
 *   can inspect `exitCode` / `stderr` to decide whether the step succeeded.
 */
function runProcess(
    cmd: string,
    args: string[],
    options: { timeout?: number; cwd?: string } = {}
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
        cp.execFile(
            cmd,
            args,
            { encoding: 'utf-8', timeout: options.timeout ?? 120_000, cwd: options.cwd },
            (err, stdout, stderr) => {
                const out = (stdout as string) ?? '';
                const errStr = (stderr as string) ?? '';

                if (err) {
                    const nodeErr = err as NodeJS.ErrnoException;
                    if (nodeErr.code === 'ENOENT') {
                        reject(new Error(`ENOENT: command not found: '${cmd}'`));
                        return;
                    }
                    // Non-zero exit code — resolve so the caller can inspect
                    const code = typeof nodeErr.code === 'number' ? nodeErr.code : 1;
                    resolve({ exitCode: code, stdout: out, stderr: errStr });
                    return;
                }
                resolve({ exitCode: 0, stdout: out, stderr: errStr });
            }
        );
    });
}

/**
 * Locate the `uv` binary by trying it bare (on PATH) and at known install
 * locations (~/.cargo/bin, ~/.local/bin, ~/.uv/bin).
 * Returns the first usable candidate, or undefined if uv is not available.
 */
async function findUv(): Promise<string | undefined> {
    const home = os.homedir();
    const knownDirs = home ? [
        path.join(home, '.cargo', 'bin'),
        path.join(home, '.local', 'bin'),
        path.join(home, '.uv', 'bin'),
    ] : [];

    const names = process.platform === 'win32' ? ['uv.exe', 'uv'] : ['uv'];

    for (const name of names) {
        // 1. Try bare name first — resolves via $PATH
        try {
            await runProcess(name, ['--version']);
            return name;
        } catch { /* not on PATH */ }

        // 2. Try absolute paths in known installation directories
        for (const dir of knownDirs) {
            const candidate = path.join(dir, name);
            try {
                await runProcess(candidate, ['--version']);
                return candidate;
            } catch { /* not here */ }
        }
    }
    return undefined;
}

/**
 * Return the path of the `zenzic` binary inside a venv/env directory.
 *   Unix:    <envDir>/bin/zenzic
 *   Windows: <envDir>/Scripts/zenzic.exe
 */
function getEnvBinaryPath(envDir: string): string {
    return process.platform === 'win32'
        ? path.join(envDir, 'Scripts', 'zenzic.exe')
        : path.join(envDir, 'bin', 'zenzic');
}

/**
 * Install zenzic into `envDir` using `uv venv` + `uv pip install`.
 * Reports incremental progress to the VS Code notification progress bar.
 * Throws a descriptive Error on failure.
 */
async function installWithUv(
    uv: string,
    envDir: string,
    progress: vscode.Progress<{ message?: string; increment?: number }>
): Promise<string> {
    progress.report({ message: 'Creating isolated environment with uv…', increment: 5 });

    const venvResult = await runProcess(uv, ['venv', '--seed', envDir]);
    if (venvResult.exitCode !== 0) {
        throw new Error(
            `uv venv failed (exit ${venvResult.exitCode}):\n` +
            (venvResult.stderr || venvResult.stdout).trim()
        );
    }

    progress.report({ message: `Installing zenzic >= ${MIN_CORE_VERSION}…`, increment: 40 });

    const pythonBin = process.platform === 'win32'
        ? path.join(envDir, 'Scripts', 'python.exe')
        : path.join(envDir, 'bin', 'python');

    const installResult = await runProcess(
        uv,
        ['pip', 'install', '--python', pythonBin, `zenzic>=${MIN_CORE_VERSION}`]
    );
    if (installResult.exitCode !== 0) {
        throw new Error(
            `uv pip install failed (exit ${installResult.exitCode}):\n` +
            (installResult.stderr || installResult.stdout).trim()
        );
    }

    progress.report({ message: 'Verifying installation…', increment: 40 });
    return getEnvBinaryPath(envDir);
}

/**
 * Install zenzic into `envDir` using `python3 -m venv` + `pip install`.
 *
 * ⚠️  Best-Effort Fallback — may fail on:
 *   - Windows MS Store Python (requires `--copies`)
 *   - Linux without `python3-venv` system package
 *   - macOS with XCode CLT Python (potentially outdated)
 *
 * A clear, actionable error message is thrown on any failure so that the
 * caller can surface it via `ProvisioningResult.status = 'failed'`.
 */
async function installWithPython3(
    envDir: string,
    progress: vscode.Progress<{ message?: string; increment?: number }>
): Promise<string> {
    // Find a usable Python interpreter
    let python: string | undefined;
    for (const candidate of ['python3', 'python']) {
        try {
            const r = await runProcess(candidate, ['--version']);
            if (r.exitCode === 0) {
                python = candidate;
                break;
            }
        } catch { /* try next */ }
    }
    if (!python) {
        throw new Error(
            'No Python 3 interpreter found. Install Python 3.9+ or uv to enable auto-provisioning.\n' +
            'Alternatively, install zenzic manually: `uv tool install zenzic`'
        );
    }

    progress.report({ message: `Creating isolated environment with ${python}…`, increment: 5 });

    const venvResult = await runProcess(python, ['-m', 'venv', envDir]);
    if (venvResult.exitCode !== 0) {
        throw new Error(
            `python3 -m venv failed (exit ${venvResult.exitCode}). ` +
            `On Debian/Ubuntu, install the missing package: sudo apt install python3-venv\n` +
            (venvResult.stderr || venvResult.stdout).trim()
        );
    }

    progress.report({ message: `Installing zenzic >= ${MIN_CORE_VERSION} via pip…`, increment: 40 });

    const pip = process.platform === 'win32'
        ? path.join(envDir, 'Scripts', 'pip.exe')
        : path.join(envDir, 'bin', 'pip');

    const pipResult = await runProcess(pip, ['install', '--upgrade', `zenzic>=${MIN_CORE_VERSION}`]);
    if (pipResult.exitCode !== 0) {
        throw new Error(
            `pip install failed (exit ${pipResult.exitCode}):\n` +
            (pipResult.stderr || pipResult.stdout).trim()
        );
    }

    progress.report({ message: 'Verifying installation…', increment: 40 });
    return getEnvBinaryPath(envDir);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Auto-Provisioning Engine entry point.
 *
 * Detection order (Phase 1):
 *   1. Configured path / system PATH / known fallback dirs (via `resolveExecFn`).
 *   2. Binary previously provisioned by this engine (`context.globalState`).
 *
 * If the binary is not found and `zenzic.autoProvision` is true (Phase 2),
 * the user is prompted for consent (Phase 3). On approval, zenzic is installed
 * into `context.globalStorageUri/env/` (Phase 4) and the result is persisted
 * so that subsequent activations skip re-installation (Phase 5).
 *
 * @param context        VS Code extension context — provides globalStorageUri
 *                       and globalState for persisting the provisioned path.
 * @param configuredPath The value of `zenzic.executablePath` (default: 'zenzic').
 * @param workspaceRoot  First workspace folder fsPath, or undefined.
 * @param resolveExecFn  Injected resolution function (avoids circular imports).
 */
export async function ensureZenzicEngine(
    context: vscode.ExtensionContext,
    configuredPath: string,
    workspaceRoot: string | undefined,
    resolveExecFn: ResolveExecFn
): Promise<ProvisioningResult> {

    // ── Phase 1: Detection ─────────────────────────────────────────────────────
    // 1a. User-configured path / system PATH / known fallback dirs
    const found = await resolveExecFn(configuredPath, workspaceRoot);
    if (found) {
        return { status: 'found', executablePath: found };
    }

    // 1b. Binary previously installed by this engine (persisted across sessions)
    const persisted = context.globalState.get<string>('zenzic.provisionedBinaryPath');
    if (persisted) {
        try {
            await fs.promises.access(persisted, fs.constants.X_OK);
            return { status: 'found', executablePath: persisted };
        } catch {
            // Persisted path is stale (e.g., env was deleted) — fall through to re-provision
            await context.globalState.update('zenzic.provisionedBinaryPath', undefined);
        }
    }

    // ── Phase 2: Check autoProvision policy ────────────────────────────────────
    const config = vscode.workspace.getConfiguration('zenzic');
    if (!config.get<boolean>('autoProvision', true)) {
        return { status: 'disabled' };
    }

    // ── Phase 3: User Consent ──────────────────────────────────────────────────
    const answer = await vscode.window.showInformationMessage(
        'Zenzic CLI not found. Install it automatically in an isolated environment? ' +
        '(No changes will be made to your system Python, PATH, or shell config.)',
        { modal: false },
        'Install',
        'Cancel'
    );
    if (answer !== 'Install') {
        return { status: 'declined' };
    }

    // ── Phase 4: Installation ──────────────────────────────────────────────────
    const envDir = path.join(context.globalStorageUri.fsPath, 'env');

    // Ensure the globalStorage directory exists before writing into it.
    await fs.promises.mkdir(context.globalStorageUri.fsPath, { recursive: true });

    let installedBinaryPath: string;

    try {
        installedBinaryPath = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Zenzic: Auto-Provisioning Engine',
                cancellable: false
            },
            async (progress) => {
                const uv = await findUv();

                if (uv) {
                    progress.report({ message: `Found uv — using hermetic install path…`, increment: 5 });
                    return await installWithUv(uv, envDir, progress);
                } else {
                    progress.report({
                        message: 'uv not found — falling back to python3 venv (Best-Effort)…',
                        increment: 5
                    });
                    return await installWithPython3(envDir, progress);
                }
            }
        );
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { status: 'failed', error: message };
    }

    // ── Phase 5: Verify binary exists and persist the path ────────────────────
    try {
        await fs.promises.access(installedBinaryPath, fs.constants.X_OK);
    } catch {
        return {
            status: 'failed',
            error:
                `Installation completed but binary not found at '${installedBinaryPath}'. ` +
                `Try installing manually: uv tool install zenzic`
        };
    }

    // Persist so that future extension activations skip re-installation.
    await context.globalState.update('zenzic.provisionedBinaryPath', installedBinaryPath);

    vscode.window.showInformationMessage(
        `✅ Zenzic engine installed at '${installedBinaryPath}'. The Language Server is starting.`
    );

    return { status: 'provisioned', executablePath: installedBinaryPath };
}
