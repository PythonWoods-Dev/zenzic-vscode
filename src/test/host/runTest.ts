// SPDX-FileCopyrightText: 2026 PythonWoods
//
// SPDX-License-Identifier: Apache-2.0
//
// Entry point for the extension-host suite. Downloads (once, cached under
// .vscode-test/) and launches a real VS Code, loads this extension from the
// repository root in development mode, opens a fresh copy of the fixture
// workspace, and runs ./index inside the Extension Host. Everything vitest
// cannot reach -- the `vscode` module, activation, command registration, the
// LSP client round trip -- is only observable from in there.

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main(): Promise<void> {
    // When this launcher itself runs from a terminal inside VS Code (Claude
    // Code, an integrated terminal, a task), the shell carries
    // ELECTRON_RUN_AS_NODE=1. The child VS Code inherits it, starts as a bare
    // Node process, and tries to `require()` the workspace folder as a script:
    //   Error: Cannot find module '.../fixtures/workspace'
    // CI never sets it, so this only protects local runs -- which are exactly
    // the runs a developer uses to check the suite before pushing.
    delete process.env.ELECTRON_RUN_AS_NODE;

    // The extension spawns `zenzic lsp`. Which binary that resolves to is
    // decided *inside* VS Code, and VS Code rebuilds the extension host's
    // environment from the user's login shell rather than inheriting this
    // process's PATH -- a PATH prepend here was observed to have no effect
    // (the host launched a uv-tool-installed release from ~/.local/bin while
    // the venv build was first on this process's PATH). So the binary is
    // named explicitly in the throwaway workspace's settings instead. Locally,
    // point ZENZIC_HOST_TEST_EXECUTABLE at the sibling core repository's venv
    // build; in CI, at the installed console script.
    const exe = process.env.ZENZIC_HOST_TEST_EXECUTABLE;

    // out/test/host -> repository root
    const extensionDevelopmentPath = path.resolve(__dirname, '../../../');
    const extensionTestsPath = path.resolve(__dirname, './index');

    // Tests rename and rewrite files. They operate on a throwaway copy so a
    // passing run never leaves the committed fixture -- or the git tree --
    // modified.
    const fixture = path.resolve(extensionDevelopmentPath, 'src/test/host/fixtures/workspace');
    // realpathSync.native: on the Windows runners os.tmpdir() is an 8.3 short
    // name (C:\Users\RUNNER~1\...). VS Code keeps whatever spelling it was
    // given, while a server that resolves paths publishes the long form, and
    // the two never compare equal as URI strings. Opening the workspace by its
    // real path removes a runner artefact so the suite measures the product.
    const workspace = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'zenzic-host-')));
    fs.cpSync(fixture, workspace, { recursive: true });
    if (exe) {
        const settingsPath = path.join(workspace, '.vscode', 'settings.json');
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as Record<string, unknown>;
        settings['zenzic.executablePath'] = exe;
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 4) + '\n');
        console.log(`extension-host suite: zenzic.executablePath = ${exe}`);
    }

    // Version policy: pin to the engines.vscode floor, the oldest host the
    // extension claims to support -- that is the host most likely to lack an
    // API the code has started to use, so it is the one worth testing against
    // by default. Floating on latest stable would instead let an upstream
    // change break the suite outside this project's control, and hide a
    // floor regression behind a newer host that happens to tolerate it.
    // VSCODE_TEST_VERSION overrides ('stable', 'insiders', or an exact
    // version) for an on-demand check against something newer. Bump the
    // floor by changing engines.vscode in package.json; this reads it.
    const pkg = JSON.parse(
        fs.readFileSync(path.join(extensionDevelopmentPath, 'package.json'), 'utf8')
    ) as { engines: { vscode: string } };
    const floor = pkg.engines.vscode.replace(/^[\^~>=]+/, '');
    const version = process.env.VSCODE_TEST_VERSION ?? floor;
    console.log(`extension-host suite: VS Code ${version} (engines floor ${floor})`);

    await runTests({
        version,
        extensionDevelopmentPath,
        extensionTestsPath,
        // --disable-extensions removes every *other* installed extension so the
        // run measures this one alone; the development extension still loads.
        launchArgs: [workspace, '--disable-extensions'],
    });
}

/**
 * On failure, print the language server's output channel. CI captures only
 * the runner's stdout; the server's own trace -- initialize options, every
 * request and response, its log messages -- lands in VS Code's log folder
 * and would otherwise be lost with the runner. The first Windows failure of
 * this suite was diagnosed blind because of exactly that.
 */
function dumpServerChannel(extensionDevelopmentPath: string): void {
    const logsRoot = path.join(extensionDevelopmentPath, '.vscode-test', 'user-data', 'logs');
    const found: string[] = [];
    const walk = (dir: string): void => {
        if (!fs.existsSync(dir)) { return; }
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) { walk(full); }
            else if (entry.name.includes('Zenzic Language Server')) { found.push(full); }
        }
    };
    walk(logsRoot);
    if (found.length === 0) { console.error('(no Zenzic Language Server channel log found)'); return; }
    found.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    // Print the whole channel, minus the publishDiagnostics payloads: they
    // are the bulk of the trace and, after a rename, they filled a 20 KB
    // tail entirely -- the second Windows failure lost the willRenameFiles
    // request and response to exactly that cut.
    const raw = fs.readFileSync(found[0], 'utf8');
    const kept: string[] = [];
    let skipping = false;
    for (const line of raw.split('\n')) {
        if (line.includes("'textDocument/publishDiagnostics'")) { skipping = true; kept.push(line + '  [payload omitted]'); continue; }
        if (skipping) {
            if (line.startsWith('[Trace') || line.startsWith('[Info') || line.startsWith('[Error') || line.startsWith('[Warn')) { skipping = false; }
            else { continue; }
        }
        kept.push(line);
    }
    console.error(`\n===== Zenzic Language Server channel (${found[0]}) =====`);
    console.error(kept.join('\n').slice(-60000));
    console.error('===== end of server channel =====\n');
}

main().catch((err) => {
    console.error('extension-host suite failed to run:', err);
    dumpServerChannel(path.resolve(__dirname, '../../../'));
    process.exit(1);
});
