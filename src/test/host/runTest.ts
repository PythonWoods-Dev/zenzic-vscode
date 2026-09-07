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
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'zenzic-host-'));
    fs.cpSync(fixture, workspace, { recursive: true });
    if (exe) {
        const settingsPath = path.join(workspace, '.vscode', 'settings.json');
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as Record<string, unknown>;
        settings['zenzic.executablePath'] = exe;
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 4) + '\n');
        console.log(`extension-host suite: zenzic.executablePath = ${exe}`);
    }

    await runTests({
        extensionDevelopmentPath,
        extensionTestsPath,
        // --disable-extensions removes every *other* installed extension so the
        // run measures this one alone; the development extension still loads.
        launchArgs: [workspace, '--disable-extensions'],
    });
}

main().catch((err) => {
    console.error('extension-host suite failed to run:', err);
    process.exit(1);
});
