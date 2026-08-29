// SPDX-FileCopyrightText: 2026 PythonWoods
//
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    Executable
} from 'vscode-languageclient/node';
import { ensureZenzicEngine } from './provisioning';
import { showQualityPanel, updateQualityPanel, QualityPanelReport } from './qualityPanel';
import { MIN_CORE_VERSION } from './coreVersion';

// A4 fix: typed as | undefined — initialized in activate(), disposed via subscriptions.
let client: LanguageClient | undefined;
let statusBarItem: vscode.StatusBarItem | undefined;
let dqsStatusBarItem: vscode.StatusBarItem | undefined;
// A2 fix: guard flag prevents concurrent restart calls.
let restarting = false;
// Cache for the active zenzic binary path (found or provisioned). Allows
// computeDQS to reuse the same binary without a second full PATH scan,
// covering the case where the binary lives in the extension's isolated
// globalStorageUri environment (not on the system PATH).
let activeZenzicPath: string | undefined;
// Last successfully parsed `zenzic score --json` report — shared between the
// DQS status bar item and the Quality Status webview panel so opening the
// panel does not require a second, redundant subprocess call.
let lastQualityReport: QualityPanelReport | undefined;

/**
 * Expand supported user-facing path variables in zenzic.executablePath.
 * Returns undefined when ${workspaceFolder} is configured but no workspace is open.
 */
export function expandConfiguredPath(filePath: string, workspaceRoot?: string): string | undefined {
    let expandedPath = filePath;

    if (expandedPath.includes('${workspaceFolder}')) {
        if (!workspaceRoot) {
            return undefined;
        }
        expandedPath = expandedPath.replace(/\$\{workspaceFolder\}/g, workspaceRoot);
    }

    if (expandedPath.startsWith('~/') || expandedPath.startsWith('~\\')) {
        expandedPath = path.join(os.homedir(), expandedPath.slice(2));
    }

    return expandedPath;
}

/**
 * Safely resolve the Zenzic executable path with cross-platform fallback logic.
 * Order of precedence:
 * 1. Explicit user/workspace setting (zenzic.executablePath containing path separator or absolute)
 * 2. System $PATH
 * 3. Standard user binary fallback directories (~/.local/bin, ~/.cargo/bin, ~/.uv/bin) via os.homedir()
 */
export async function resolveExecutablePath(cmd: string, workspaceRoot?: string): Promise<string | undefined> {
    const isWindows = process.platform === 'win32';
    const exts = isWindows ? ['.exe', '.cmd', '.bat', ''] : [''];

    const checkPath = async (p: string): Promise<string | undefined> => {
        for (const ext of exts) {
            try {
                await fs.promises.access(p + ext, fs.constants.X_OK);
                return p + ext;
            } catch {
                // Ignore and try next extension or path
            }
        }
        return undefined;
    };

    // Smart Workspace Resolver: If the path contains ${workspaceFolder},
    // iteratively scan across all active workspace folders in multi-root
    // or umbrella configurations to find the first valid executable.
    if (cmd.includes('${workspaceFolder}')) {
        const folders = vscode.workspace.workspaceFolders;
        if (folders && folders.length > 0) {
            for (const folder of folders) {
                let candidate = cmd.replace(/\$\{workspaceFolder\}/g, folder.uri.fsPath);
                if (candidate.startsWith('~/') || candidate.startsWith('~\\')) {
                    candidate = path.join(os.homedir(), candidate.slice(2));
                }
                const resolved = await checkPath(candidate);
                if (resolved) {
                    return resolved;
                }
            }
            return undefined;
        }

        if (workspaceRoot) {
            let candidate = cmd.replace(/\$\{workspaceFolder\}/g, workspaceRoot);
            if (candidate.startsWith('~/') || candidate.startsWith('~\\')) {
                candidate = path.join(os.homedir(), candidate.slice(2));
            }
            return await checkPath(candidate);
        }
        return undefined;
    }

    const expandedCmd = expandConfiguredPath(cmd, workspaceRoot);
    if (!expandedCmd) {
        return undefined;
    }

    if (path.isAbsolute(expandedCmd) || expandedCmd.includes(path.sep) || (isWindows && expandedCmd.includes('/'))) {
        return await checkPath(expandedCmd);
    }

    const home = os.homedir();
    const systemPaths = (process.env.PATH || '').split(path.delimiter);
    const fallbackPaths = home
        ? [
            path.join(home, '.local', 'bin'),
            path.join(home, '.cargo', 'bin'),
            path.join(home, '.uv', 'bin')
        ]
        : [];

    const searchDirs = [...systemPaths, ...fallbackPaths];
    for (const dir of searchDirs) {
        if (!dir) continue;
        const fullPath = path.join(dir, expandedCmd);
        const resolved = await checkPath(fullPath);
        if (resolved) {
            return resolved;
        }
    }
    return undefined;
}

/**
 * Compare two SemVer strings (MAJOR.MINOR.PATCH).
 * Returns > 0 if v1 > v2, < 0 if v1 < v2, and 0 if v1 === v2.
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

export interface CoreVersionCheckResult {
    status: 'ok' | 'outdated' | 'not_found' | 'error';
    version?: string;
    error?: string;
}

/**
 * Safely verify the core binary version via execFile (preventing shell injection)
 * and compare against MIN_CORE_VERSION.
 */
export async function checkCoreVersion(executablePath: string): Promise<CoreVersionCheckResult> {
    const cp = await import('child_process');
    return new Promise((resolve) => {
        cp.execFile(executablePath, ['--version'], { encoding: 'utf-8' }, (err, stdout, stderr) => {
            if (err) {
                if ((err as { code?: string }).code === 'ENOENT') {
                    return resolve({ status: 'not_found', error: `Binary not found at '${executablePath}'` });
                }
                return resolve({
                    status: 'error',
                    error: err.message || stderr || 'Failed to execute zenzic --version'
                });
            }

            const output = (stdout || '').trim() || (stderr || '').trim();
            const match = output.match(/(\d+\.\d+\.\d+)/);
            if (!match) {
                return resolve({
                    status: 'error',
                    error: `Could not parse version from output: '${output}'`
                });
            }

            const foundVersion = match[1];
            try {
                if (compareSemver(foundVersion, MIN_CORE_VERSION) < 0) {
                    return resolve({
                        status: 'outdated',
                        version: foundVersion
                    });
                }
                return resolve({
                    status: 'ok',
                    version: foundVersion
                });
            } catch (cmpErr: unknown) {
                const msg = cmpErr instanceof Error ? cmpErr.message : String(cmpErr);
                return resolve({ status: 'error', error: msg });
            }
        });
    });
}

export async function activate(context: vscode.ExtensionContext) {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = '$(sync~spin) Zenzic: Starting';
    statusBarItem.command = 'zenzic.showStatus';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // ECOSYSTEM-FEAT-002: DQS Status Bar — separate from the LSP health bar.
    // Shows the workspace Documentation Quality Score computed on demand by
    // running the CLI (`zenzic score --json`) asynchronously via execFile.
    // Visible only when at least one workspace folder is open.
    dqsStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
    dqsStatusBarItem.text = '$(sync) Zenzic DQS: --/100';
    dqsStatusBarItem.command = 'zenzic.computeDQS';
    dqsStatusBarItem.tooltip = 'Click to compute workspace Documentation Quality Score (runs zenzic score --json)';
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        dqsStatusBarItem.show();
    }
    context.subscriptions.push(dqsStatusBarItem);

    let lastErrorPrompt: (() => Promise<void>) | undefined;

    const getExtVersion = (): string => {
        return (context.extension?.packageJSON as { version?: string })?.version || 'unknown';
    };

    const createSuccessTooltip = (coreVersion: string | undefined, activePath: string): vscode.MarkdownString => {
        const extVersion = getExtVersion();
        const isAutoProvisioned = activePath.includes(context.globalStorageUri.fsPath);
        const coreVerStr = coreVersion ? `v${coreVersion}` : 'unknown';
        const lines = [
            '**Zenzic Language Server** is running.',
            '',
            `- **Core Version**: \`${coreVerStr}\``,
            `- **Extension Version**: \`v${extVersion}\``,
            `- **Executable Path**: \`${activePath}\``,
            `- **Auto-Provisioned**: \`${isAutoProvisioned ? 'Yes' : 'No'}\``
        ];
        const tip = new vscode.MarkdownString(lines.join('  \n'), true);
        tip.isTrusted = true;
        return tip;
    };

    const createErrorTooltip = (header: string, attemptedPath: string, reason: string): vscode.MarkdownString => {
        const extVersion = getExtVersion();
        const lines = [
            `**${header}**`,
            '',
            `- **Extension Version**: \`v${extVersion}\``,
            `- **Attempted Path**: \`${attemptedPath}\``,
            `- **Error**: ${reason}`
        ];
        const tip = new vscode.MarkdownString(lines.join('  \n'), true);
        tip.isTrusted = true;
        return tip;
    };

    const clearExecutablePathSetting = async () => {
        const config = vscode.workspace.getConfiguration('zenzic');
        const inspection = config.inspect<string>('executablePath');
        if (inspection) {
            if (inspection.workspaceFolderValue !== undefined) {
                await config.update('executablePath', undefined, vscode.ConfigurationTarget.WorkspaceFolder);
            }
            if (inspection.workspaceValue !== undefined) {
                await config.update('executablePath', undefined, vscode.ConfigurationTarget.Workspace);
            }
            if (inspection.globalValue !== undefined) {
                await config.update('executablePath', undefined, vscode.ConfigurationTarget.Global);
            }
        }
    };

    const startServer = async () => {
        const config = vscode.workspace.getConfiguration('zenzic');
        const executablePath = config.get<string>('executablePath') || 'zenzic';
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        const isCustomPath = executablePath.trim() !== '' && executablePath.trim() !== 'zenzic';

        let resolvedPath: string;

        if (isCustomPath) {
            const resolvedCustom = await resolveExecutablePath(executablePath, workspaceRoot);
            if (!resolvedCustom) {
                statusBarItem!.text = '$(error) Zenzic: Custom Path Not Found';
                statusBarItem!.tooltip = createErrorTooltip(
                    'Zenzic: Custom Path Not Found',
                    executablePath,
                    'Binary not found at configured custom path.'
                );
                const prompt = async () => {
                    const action = await vscode.window.showErrorMessage(
                        `Zenzic binary not found at custom path: '${executablePath}'. ` +
                        `Clear the setting to use auto-provisioning, or install it manually in that environment.`,
                        'Clear Setting',
                        'Open Settings',
                        'Open Docs'
                    );
                    if (action === 'Clear Setting') {
                        await clearExecutablePathSetting();
                        vscode.window.showInformationMessage('Custom path cleared. Restarting server...');
                        setTimeout(() => { vscode.commands.executeCommand('zenzic.restartServer'); }, 100);
                    } else if (action === 'Open Settings') {
                        vscode.commands.executeCommand('workbench.action.openSettings', 'zenzic.executablePath');
                    } else if (action === 'Open Docs') {
                        vscode.env.openExternal(vscode.Uri.parse(
                            'https://github.com/PythonWoods/zenzic-vscode#requirements'
                        ));
                    }
                };
                lastErrorPrompt = prompt;
                await prompt();
                return;
            }
            resolvedPath = resolvedCustom;
        } else {
            // Auto-Provisioning Engine. Replaces the bare `resolveExecutablePath`
            // call + manual error message with a consent-gated, isolated install flow.
            // Dependency injection of `resolveExecutablePath` avoids circular imports.
            const provisionResult = await ensureZenzicEngine(
                context,
                executablePath,
                workspaceRoot,
                resolveExecutablePath
            );

            if (provisionResult.status === 'declined') {
                statusBarItem!.text = '$(circle-slash) Zenzic: Installation Declined';
                statusBarItem!.tooltip = createErrorTooltip(
                    'Zenzic: Installation Declined',
                    executablePath,
                    'User declined automatic engine installation.'
                );
                const prompt = async () => {
                    const action = await vscode.window.showInformationMessage(
                        'Zenzic engine installation was declined. Would you like to install it now or configure a custom path?',
                        'Install Now',
                        'Configure Path',
                        'Open Docs'
                    );
                    if (action === 'Install Now') {
                        setTimeout(() => { vscode.commands.executeCommand('zenzic.restartServer'); }, 100);
                    } else if (action === 'Configure Path') {
                        vscode.commands.executeCommand('workbench.action.openSettings', 'zenzic.executablePath');
                    } else if (action === 'Open Docs') {
                        vscode.env.openExternal(vscode.Uri.parse(
                            'https://github.com/PythonWoods/zenzic-vscode#requirements'
                        ));
                    }
                };
                lastErrorPrompt = prompt;
                return;
            }

            if (provisionResult.status === 'disabled') {
                // autoProvision is false — mirror the previous manual-install UX.
                statusBarItem!.text = '$(error) Zenzic: Not Found';
                statusBarItem!.tooltip = createErrorTooltip(
                    'Zenzic: Engine Not Found',
                    executablePath,
                    'Executable not found on system PATH and auto-provisioning is disabled.'
                );
                const prompt = async () => {
                    const action = await vscode.window.showErrorMessage(
                        `Zenzic binary not found: '${executablePath}'. ` +
                        `Install manually ('uv tool install zenzic'), configure 'zenzic.executablePath', ` +
                        `or enable 'zenzic.autoProvision'.`,
                        'Open Settings',
                        'Open Docs'
                    );
                    if (action === 'Open Settings') {
                        vscode.commands.executeCommand('workbench.action.openSettings', 'zenzic.executablePath');
                    } else if (action === 'Open Docs') {
                        vscode.env.openExternal(vscode.Uri.parse(
                            'https://github.com/PythonWoods/zenzic-vscode#requirements'
                        ));
                    }
                };
                lastErrorPrompt = prompt;
                await prompt();
                return;
            }

            if (provisionResult.status === 'failed') {
                statusBarItem!.text = '$(error) Zenzic: Provisioning Failed';
                statusBarItem!.tooltip = createErrorTooltip(
                    'Zenzic: Auto-Provisioning Failed',
                    executablePath,
                    provisionResult.error
                );
                const prompt = async () => {
                    const action = await vscode.window.showErrorMessage(
                        `Zenzic auto-provisioning failed: ${provisionResult.error}`,
                        'Install Manually',
                        'Open Docs'
                    );
                    if (action === 'Install Manually') {
                        const terminal = vscode.window.createTerminal('Zenzic Setup');
                        terminal.show();
                        terminal.sendText('uv tool install zenzic', true);
                    } else if (action === 'Open Docs') {
                        vscode.env.openExternal(vscode.Uri.parse(
                            'https://github.com/PythonWoods/zenzic-vscode#requirements'
                        ));
                    }
                };
                lastErrorPrompt = prompt;
                await prompt();
                return;
            }

            // provisionResult.status is narrowed to 'found' | 'provisioned' here.
            resolvedPath = provisionResult.executablePath;
        }

        // Cache so computeDQS can reuse the same binary (covers the provisioned
        // env case where the binary is not on the system PATH).
        activeZenzicPath = resolvedPath;

        // Enforce Core Version Handshake (>= MIN_CORE_VERSION) before starting LSP client
        const versionResult = await checkCoreVersion(resolvedPath);
        if (versionResult.status === 'not_found') {
            statusBarItem!.text = '$(error) Zenzic: Not Found';
            statusBarItem!.tooltip = createErrorTooltip(
                'Zenzic: Binary Not Found',
                resolvedPath,
                'Binary could not be executed or does not exist.'
            );
            const prompt = async () => {
                if (isCustomPath) {
                    const action = await vscode.window.showErrorMessage(
                        `Zenzic binary not found at custom path: '${executablePath}'. ` +
                        `Clear the setting to use auto-provisioning, or install it manually in that environment.`,
                        'Clear Setting',
                        'Open Settings',
                        'Open Docs'
                    );
                    if (action === 'Clear Setting') {
                        await clearExecutablePathSetting();
                        vscode.window.showInformationMessage('Custom path cleared. Restarting server...');
                        setTimeout(() => { vscode.commands.executeCommand('zenzic.restartServer'); }, 100);
                    } else if (action === 'Open Settings') {
                        vscode.commands.executeCommand('workbench.action.openSettings', 'zenzic.executablePath');
                    } else if (action === 'Open Docs') {
                        vscode.env.openExternal(vscode.Uri.parse(
                            'https://github.com/PythonWoods/zenzic-vscode#requirements'
                        ));
                    }
                } else {
                    vscode.window.showErrorMessage(
                        `Zenzic binary not found at '${resolvedPath}'. Please install it via 'uv tool install zenzic' or configure 'zenzic.executablePath'.`
                    );
                }
            };
            lastErrorPrompt = prompt;
            await prompt();
            return;
        }

        if (versionResult.status === 'outdated') {
            statusBarItem!.text = '$(error) Zenzic: Outdated Core';
            statusBarItem!.tooltip = createErrorTooltip(
                'Zenzic: Outdated Core',
                resolvedPath,
                `Zenzic Core v${MIN_CORE_VERSION} or higher required (found v${versionResult.version}).`
            );
            const prompt = async () => {
                const action = await vscode.window.showErrorMessage(
                    `Zenzic extension requires Zenzic Core v${MIN_CORE_VERSION} or higher. ` +
                    `Found v${versionResult.version}. Please update the global binary or configure 'zenzic.executablePath'.`,
                    'Update with uv',
                    'Configure Path',
                    'Open Docs'
                );
                if (action === 'Update with uv') {
                    const terminal = vscode.window.createTerminal('Zenzic Update');
                    terminal.show();
                    terminal.sendText('uv tool install --force zenzic', true);
                } else if (action === 'Configure Path') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'zenzic.executablePath');
                } else if (action === 'Open Docs') {
                    vscode.env.openExternal(vscode.Uri.parse(
                        'https://github.com/PythonWoods/zenzic-vscode#requirements'
                    ));
                }
            };
            lastErrorPrompt = prompt;
            await prompt();
            return;
        }

        if (versionResult.status === 'error') {
            statusBarItem!.text = '$(error) Zenzic: Version Error';
            statusBarItem!.tooltip = createErrorTooltip(
                'Zenzic: Version Check Error',
                resolvedPath,
                versionResult.error || 'Unknown error'
            );
            const prompt = async () => {
                vscode.window.showErrorMessage(
                    `Could not verify Zenzic Core version: ${versionResult.error}`
                );
            };
            lastErrorPrompt = prompt;
            await prompt();
            return;
        }

        const run: Executable = {
            command: resolvedPath,
            args: ['lsp']
        };


        // A5: debug config is intentionally identical to run. This extension is a
        // thin client: server-side debugging is done by attaching directly to the
        // zenzic process, not through a dedicated debug launcher.
        const serverOptions: ServerOptions = { run, debug: run };

        // LSP-OBS-001: Use a wrapper around a standard OutputChannel to satisfy the
        // LogOutputChannel interface without applying VS Code's log-level filtering.
        // This ensures initialization messages (like the Core version) are always visible.
        const baseChannel = vscode.window.createOutputChannel('Zenzic Language Server');
        const outputChannel: vscode.LogOutputChannel = {
            name: baseChannel.name,
            append: (value: string) => baseChannel.append(value),
            appendLine: (value: string) => baseChannel.appendLine(value),
            replace: (value: string) => baseChannel.replace(value),
            clear: () => baseChannel.clear(),
            show: (columnOrPreserveFocus?: vscode.ViewColumn | boolean, preserveFocus?: boolean) => {
                if (typeof columnOrPreserveFocus === 'number') {
                    baseChannel.show(columnOrPreserveFocus, preserveFocus);
                } else {
                    baseChannel.show(columnOrPreserveFocus);
                }
            },
            hide: () => baseChannel.hide(),
            dispose: () => baseChannel.dispose(),
            logLevel: vscode.LogLevel.Trace,
            onDidChangeLogLevel: new vscode.EventEmitter<vscode.LogLevel>().event,
            trace: (message: string, ...args: unknown[]) => baseChannel.appendLine(`[Trace] ${message} ${args.join(' ')}`.trimEnd()),
            debug: (message: string, ...args: unknown[]) => baseChannel.appendLine(`[Debug] ${message} ${args.join(' ')}`.trimEnd()),
            info:  (message: string, ...args: unknown[]) => baseChannel.appendLine(`[Info] ${message} ${args.join(' ')}`.trimEnd()),
            warn:  (message: string, ...args: unknown[]) => baseChannel.appendLine(`[Warn] ${message} ${args.join(' ')}`.trimEnd()),
            error: (message: string | Error, ...args: unknown[]) => baseChannel.appendLine(`[Error] ${message instanceof Error ? message.message : message} ${args.join(' ')}`.trimEnd())
        };

        const clientOptions: LanguageClientOptions = {
            documentSelector: [
                { scheme: 'file', language: 'markdown', pattern: '**/*.{md,mdx,markdown}' },
                { scheme: 'file', language: 'mdx', pattern: '**/*.{md,mdx,markdown}' },
                { scheme: 'untitled', language: 'markdown' },
                { scheme: 'untitled', language: 'mdx' }
            ],
            outputChannel
        };

        client = new LanguageClient(
            'zenzicLanguageServer',
            'Zenzic Language Server',
            serverOptions,
            clientOptions
        );

        try {
            await client.start();
            // DQS Status Bar removed (LSP-FIX-014).
            // The LSP computes DQS only from in-memory VSM topological findings
            // (Z1xx/Z4xx); content findings (Z5xx) on closed files are excluded,
            // making the score non-deterministically lower than the CLI batch score.
            // Displaying a misleading score violates the Determinism invariant.
            // The authoritative DQS is produced exclusively by `zenzic check all`.

            // LSP-OBS-002: Status Bar Versioning & Telemetry Tooltip.
            // Read the Core Engine version from the LSP serverInfo payload
            // (InitializeResult.serverInfo.version) — populated by the server
            // during the initialize handshake.  Radical Unawareness is preserved:
            // the Core provides data; the Client decides how to render it in the UI.
            const coreVersion = client.initializeResult?.serverInfo?.version;
            statusBarItem!.text = '$(check) Zenzic: Running';
            statusBarItem!.tooltip = createSuccessTooltip(coreVersion, resolvedPath);
            lastErrorPrompt = undefined;
        } catch (err: unknown) {
            // A1 fix: err is unknown; narrow to Error before accessing .message to
            // avoid producing "Error: undefined" when a non-Error value is thrown.
            const message = err instanceof Error ? err.message : String(err);
            statusBarItem!.text = '$(error) Zenzic: Error';
            statusBarItem!.tooltip = createErrorTooltip(
                'Zenzic: Language Server Failed to Start',
                resolvedPath,
                message
            );
            const prompt = async () => {
                vscode.window.showErrorMessage(
                    `Failed to start Zenzic LSP. Please ensure zenzic is installed ` +
                    `(e.g., 'uv tool install zenzic') or set the correct path in ` +
                    `'zenzic.executablePath'. Error: ${message}`
                );
            };
            lastErrorPrompt = prompt;
            await prompt();
        }
    };

    const restartServer = async () => {
        // A2 fix: idempotent guard — if a restart is already in flight, ignore the
        // duplicate call instead of spawning a second concurrent LSP client.
        if (restarting) { return; }
        restarting = true;
        try {
            statusBarItem!.text = '$(sync~spin) Zenzic: Restarting';
            if (client) {
                await client.stop();
                client = undefined;
            }
            await startServer();
        } finally {
            restarting = false;
        }
    };

    const stopServer = async () => {
        if (client) {
            statusBarItem!.text = '$(sync~spin) Zenzic: Stopping';
            await client.stop();
            client = undefined;
            statusBarItem!.text = '$(stop-circle) Zenzic: Stopped';
            statusBarItem!.tooltip = 'Zenzic Language Server is stopped';
        }
    };

    const showStatus = async () => {
        if (lastErrorPrompt) {
            await lastErrorPrompt();
            return;
        }

        const items: vscode.QuickPickItem[] = [
            {
                label: '$(sync) Restart Language Server',
                description: 'Restart the LSP background process and re-analyze workspace'
            },
            {
                label: '$(tools) Run Troubleshoot Wizard',
                description: 'Perform an automated health check on the Zenzic environment'
            },
            {
                label: '$(symbol-numeric) Compute Global DQS',
                description: 'Calculate overall workspace Documentation Quality Score'
            },
            {
                label: '$(graph) Show Quality Status Panel',
                description: 'Open the Quality Score / Suppression Cap / Baseline Freshness panel'
            },
            {
                label: '$(gear) Open Settings',
                description: 'Configure zenzic.executablePath, autoProvision, and trace'
            },
            {
                label: '$(book) Open Documentation',
                description: 'Read the official Zenzic extension and rule guides'
            }
        ];

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Zenzic Language Server Actions'
        });

        if (!selected) {
            return;
        }

        if (selected.label.includes('Restart Language Server')) {
            await restartServer();
        } else if (selected.label.includes('Run Troubleshoot Wizard')) {
            await troubleshoot();
        } else if (selected.label.includes('Compute Global DQS')) {
            await computeDQS();
        } else if (selected.label.includes('Show Quality Status Panel')) {
            await showQualityStatusPanel();
        } else if (selected.label.includes('Open Settings')) {
            vscode.commands.executeCommand('workbench.action.openSettings', 'zenzic');
        } else if (selected.label.includes('Open Documentation')) {
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/PythonWoods/zenzic-vscode#readme'));
        }
    };

    const troubleshoot = async () => {
        const config = vscode.workspace.getConfiguration('zenzic');
        const executablePath = config.get<string>('executablePath') || 'zenzic';
        const isAutoProvision = config.get<boolean>('autoProvision') ?? true;
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        const isCustomPath = executablePath.trim() !== '' && executablePath.trim() !== 'zenzic';

        interface TroubleshootingActionItem extends vscode.QuickPickItem {
            execute?: () => Promise<void>;
        }

        const items: TroubleshootingActionItem[] = [];

        // 1. Custom Path Check
        if (isCustomPath) {
            const resolvedCustom = await resolveExecutablePath(executablePath, workspaceRoot);
            if (resolvedCustom) {
                items.push({
                    label: '$(check) Custom Executable Path: Valid',
                    description: executablePath,
                    detail: `Resolved to: ${resolvedCustom}`
                });
            } else {
                items.push({
                    label: '$(error) Custom Executable Path: Not Found',
                    description: executablePath,
                    detail: 'Click to clear this setting and allow Auto-Provisioning to take over.',
                    execute: async () => {
                        await clearExecutablePathSetting();
                        vscode.window.showInformationMessage('Custom path cleared. Restarting server...');
                        await restartServer();
                    }
                });
            }
        } else {
            items.push({
                label: '$(info) Custom Executable Path: Not Set',
                description: 'Using standard auto-detection / auto-provisioning',
                detail: 'Default executable name: "zenzic"'
            });
        }

        // 2. System PATH & Fallback Check
        const resolvedSystem = await resolveExecutablePath('zenzic', workspaceRoot);
        if (resolvedSystem) {
            items.push({
                label: '$(check) System PATH Zenzic: Detected',
                description: resolvedSystem,
                detail: 'Zenzic executable is available on system PATH or fallback directory.'
            });
        } else {
            items.push({
                label: '$(warning) System PATH Zenzic: Not Found',
                description: 'zenzic is not on system $PATH',
                detail: 'Install globally via `uv tool install zenzic` or use auto-provisioning.'
            });
        }

        // 3. Auto-Provisioning Environment Check
        const envDir = path.join(context.globalStorageUri.fsPath, 'env');
        const provisionedEnv = process.platform === 'win32'
            ? path.join(envDir, 'Scripts', 'zenzic.exe')
            : path.join(envDir, 'bin', 'zenzic');

        let provisionedFound = false;
        try {
            await fs.promises.access(provisionedEnv, fs.constants.X_OK);
            provisionedFound = true;
        } catch { /* not present */ }

        if (provisionedFound) {
            items.push({
                label: '$(check) Auto-Provisioned Engine: Ready',
                description: provisionedEnv,
                detail: 'Isolated environment created and ready in global extension storage.'
            });
        } else {
            items.push({
                label: isAutoProvision ? '$(info) Auto-Provisioned Engine: Not Installed' : '$(warning) Auto-Provisioning: Disabled',
                description: isAutoProvision ? 'Will install on demand if needed' : 'zenzic.autoProvision is set to false',
                detail: isAutoProvision
                    ? 'Click to force immediate engine provisioning in isolated storage.'
                    : 'Click to re-enable zenzic.autoProvision in settings.',
                execute: isAutoProvision
                    ? async () => {
                        vscode.window.showInformationMessage('Provisioning Zenzic engine...');
                        await restartServer();
                    }
                    : async () => {
                        const inspection = config.inspect<boolean>('autoProvision');
                        const target = inspection?.workspaceValue !== undefined
                            ? vscode.ConfigurationTarget.Workspace
                            : vscode.ConfigurationTarget.Global;
                        await config.update('autoProvision', true, target);
                        vscode.window.showInformationMessage('Auto-provisioning enabled. Restarting server...');
                        await restartServer();
                    }
            });
        }

        // 4. Active Engine Version Check
        const targetPath = activeZenzicPath ?? resolvedSystem ?? (provisionedFound ? provisionedEnv : undefined);
        if (targetPath) {
            const versionResult = await checkCoreVersion(targetPath);
            if (versionResult.status === 'ok') {
                items.push({
                    label: `$(check) Core Version: v${versionResult.version}`,
                    description: `Satisfies >= v${MIN_CORE_VERSION}`,
                    detail: `Target binary: ${targetPath}`
                });
            } else if (versionResult.status === 'outdated') {
                items.push({
                    label: `$(error) Core Version Outdated: v${versionResult.version}`,
                    description: `Requires >= v${MIN_CORE_VERSION}`,
                    detail: 'Click to update the global binary via terminal.',
                    execute: async () => {
                        const terminal = vscode.window.createTerminal('Zenzic Update');
                        terminal.show();
                        terminal.sendText('uv tool install --force zenzic', true);
                    }
                });
            } else {
                items.push({
                    label: '$(warning) Core Version: Check Failed',
                    description: versionResult.error,
                    detail: `Target binary: ${targetPath}`
                });
            }
        }

        // General Actions
        items.push({
            label: '$(sync) Restart Language Server',
            detail: 'Reload configuration and re-initialize LSP connection.',
            execute: async () => {
                await restartServer();
            }
        });

        items.push({
            label: '$(gear) Configure Settings',
            detail: 'Open VS Code settings for Zenzic.',
            execute: async () => {
                await vscode.commands.executeCommand('workbench.action.openSettings', 'zenzic');
            }
        });

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Zenzic Environment Diagnostic & Self-Healing Wizard'
        });

        if (selected?.execute) {
            try {
                await selected.execute();
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                vscode.window.showErrorMessage(`Troubleshoot action failed: ${message}`);
            }
        }
    };

    context.subscriptions.push(
        vscode.commands.registerCommand('zenzic.restartServer', restartServer),
        vscode.commands.registerCommand('zenzic.startServer', startServer),
        vscode.commands.registerCommand('zenzic.stopServer', stopServer),
        vscode.commands.registerCommand('zenzic.showStatus', showStatus),
        vscode.commands.registerCommand('zenzic.troubleshoot', troubleshoot)
    );

    // ECOSYSTEM-FEAT-002: zenzic.computeDQS
    // Asynchronous CLI Execution Bridge. Runs `zenzic score --json` as a child
    // process with the workspace root as cwd. The Core emits a single JSON object
    // on stdout (Radical Unawareness — ADR-075). The extension parses it and updates
    // the DQS Status Bar. Determinism is guaranteed: same binary and args as CI/CD.
    const computeDQS = async () => {
        if (!dqsStatusBarItem) { return; }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showWarningMessage('Zenzic: No workspace folder open. Cannot compute DQS.');
            return;
        }
        const workspaceRoot = workspaceFolders[0].uri.fsPath;

        const config = vscode.workspace.getConfiguration('zenzic');
        const executablePath = config.get<string>('executablePath') || 'zenzic';
        // Prefer the cached active path (covers provisioned env binaries that
        // are not on the system PATH); fall back to a fresh PATH scan.
        const resolvedPath = activeZenzicPath ?? await resolveExecutablePath(executablePath, workspaceRoot);

        if (!resolvedPath) {
            dqsStatusBarItem.text = '$(error) Zenzic DQS: Not Found';
            dqsStatusBarItem.tooltip = `Zenzic binary not found: '${executablePath}'. Run: uv tool install zenzic`;
            return;
        }

        dqsStatusBarItem.text = '$(sync~spin) Zenzic DQS: Computing...';
        dqsStatusBarItem.tooltip = 'Running zenzic score --json in background...';

        const cp = await import('child_process');
        await new Promise<void>((resolve) => {
            cp.execFile(
                resolvedPath,
                ['score', '--json'],
                { cwd: workspaceRoot, timeout: 60000, encoding: 'utf-8' },
                (err, stdout, stderr) => {
                    if (!dqsStatusBarItem) { resolve(); return; }

                    if (err && (err as { code?: string }).code === 'ENOENT') {
                        dqsStatusBarItem.text = '$(error) Zenzic DQS: Not Found';
                        dqsStatusBarItem.tooltip = `Binary not found at '${resolvedPath}'`;
                        resolve(); return;
                    }

                    // Try to parse stdout as JSON regardless of exit code:
                    // zenzic score exits non-zero when score < fail_under, but still
                    // emits valid JSON. We surface the score even in "failing" state.
                    const raw = (stdout || '').trim();
                    if (!raw) {
                        const errMsg = (stderr || '').trim().slice(0, 200) || (err?.message ?? 'No output');
                        dqsStatusBarItem.text = '$(error) Zenzic DQS: Error';
                        dqsStatusBarItem.tooltip = `zenzic score --json returned no output. ${errMsg}`;
                        resolve(); return;
                    }

                    try {
                        const report = JSON.parse(raw) as QualityPanelReport;
                        lastQualityReport = report;
                        updateQualityPanel(report);

                        const score = report.score ?? 0;
                        const status = report.status ?? 'unknown';
                        const debt = report.suppression_debt_pts ?? 0;

                        // LSP-FIX-015 Fix 3: security_breach (Z201) forces score to 0.
                        // Do NOT show category checkmarks — they would be misleading.
                        // A credential was detected; the status bar and tooltip must
                        // communicate the breach prominently and unambiguously.
                        const isSecurityBreach = status === 'security_breach';

                        const icon = isSecurityBreach
                            ? '$(shield)'
                            : score >= 80 ? '$(dashboard)' : score >= 50 ? '$(warning)' : '$(error)';
                        dqsStatusBarItem.text = isSecurityBreach
                            ? `${icon} Zenzic DQS: SECURITY BREACH`
                            : `${icon} Zenzic DQS: ${score}/100`;

                        if (isSecurityBreach) {
                            dqsStatusBarItem.tooltip = [
                                '🚨 ZENZIC — SECURITY BREACH DETECTED 🚨',
                                '',
                                'A credential or hardcoded secret was found in the documentation.',
                                'Score is forced to 0/100 — Z201 is non-suppressible.',
                                '',
                                '⚠️  Rotate the exposed credential immediately.',
                                'Reference: https://zenzic.dev/reference/finding-codes/#z201',
                            ].join('\n');
                        } else {
                            const categoryLines = (report.categories ?? [])
                                .map(c => `  ${c.name}: ${c.issues === 0 ? '✓' : `${c.issues} issue(s)`}`)
                                .join('\n');
                            dqsStatusBarItem.tooltip = [
                                `Documentation Quality Score: ${score}/100`,
                                `Status: ${status}`,
                                debt > 0 ? `Technical Debt: -${debt}pts` : '',
                                categoryLines ? `\nBreakdown:\n${categoryLines}` : '',
                            ].filter(Boolean).join('\n');
                        }

                    } catch {
                        dqsStatusBarItem.text = '$(error) Zenzic DQS: Parse Error';
                        dqsStatusBarItem.tooltip = `Failed to parse JSON output from zenzic score. Raw: ${raw.slice(0, 100)}`;
                    }
                    resolve();
                }
            );
        });
    };

    context.subscriptions.push(
        vscode.commands.registerCommand('zenzic.computeDQS', computeDQS)
    );

    // ECOSYSTEM-FEAT-003: Quality Status Panel.
    // Opens the webview with whatever report is cached from the last
    // zenzic.computeDQS run; if none exists yet, triggers computeDQS once
    // (the same bridge, not a second one) so the panel is never empty on
    // first open.
    const showQualityStatusPanel = async () => {
        showQualityPanel(context, lastQualityReport, computeDQS);
        if (!lastQualityReport) {
            await computeDQS();
        }
    };

    context.subscriptions.push(
        vscode.commands.registerCommand('zenzic.showQualityPanel', showQualityStatusPanel)
    );

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(async (e) => {
            if (e.affectsConfiguration('zenzic.executablePath')) {
                await restartServer();
            }
        })
    );

    await startServer();
}


export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    // A3 fix: swallow rejection from stop() — the server process may have already
    // exited (e.g., crashed), in which case stop() rejects with a benign error.
    return client.stop().catch(() => { /* server already stopped */ });
}
