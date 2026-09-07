// SPDX-FileCopyrightText: 2026 PythonWoods
//
// SPDX-License-Identifier: Apache-2.0
//
// Entry point for the extension-host suite. Downloads (once, cached under
// .vscode-test/) and launches a real VS Code, loads this extension from the
// repository root in development mode, opens the fixture workspace, and runs
// ./index inside the Extension Host. Everything vitest cannot reach -- the
// `vscode` module, activation, command registration, the LSP client -- is
// only observable from in there.

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

    // out/test/host -> repository root
    const extensionDevelopmentPath = path.resolve(__dirname, '../../../');
    const extensionTestsPath = path.resolve(__dirname, './index');
    const workspace = path.resolve(extensionDevelopmentPath, 'src/test/host/fixtures/workspace');

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
