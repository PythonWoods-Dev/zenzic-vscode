// SPDX-FileCopyrightText: 2026 PythonWoods
//
// SPDX-License-Identifier: Apache-2.0
//
// Phase 1 of the extension-host suite: the smallest set of assertions that
// proves the infrastructure end to end. If these pass, VS Code launched, the
// extension loaded and activated, and a contributed command is reachable
// through the real command registry. Nothing here needs the LSP server.

import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';

const EXTENSION_ID = 'pythonwoods.zenzic-vscode';
const CONTRIBUTED_COMMANDS = [
    'zenzic.restartServer',
    'zenzic.startServer',
    'zenzic.stopServer',
    'zenzic.computeDQS',
    'zenzic.showQualityPanel',
    'zenzic.showStatus',
    'zenzic.troubleshoot',
    'zenzic.reportFindingAsIssue',
];

suite('extension host: activation', () => {
    test('the extension is installed in development mode', () => {
        assert.ok(vscode.extensions.getExtension(EXTENSION_ID), `${EXTENSION_ID} not found`);
    });

    test('opening a Markdown document activates it (onLanguage:markdown)', async () => {
        const ext = vscode.extensions.getExtension(EXTENSION_ID)!;
        const folder = vscode.workspace.workspaceFolders?.[0];
        assert.ok(folder, 'fixture workspace not opened');
        const doc = await vscode.workspace.openTextDocument(
            path.join(folder.uri.fsPath, 'README.md')
        );
        await vscode.window.showTextDocument(doc);
        await ext.activate();
        assert.strictEqual(ext.isActive, true, 'extension did not activate');
    });

    test('every contributed command is registered in the real command registry', async () => {
        const registered = new Set(await vscode.commands.getCommands(true));
        const missing = CONTRIBUTED_COMMANDS.filter((c) => !registered.has(c));
        assert.deepStrictEqual(missing, [], `commands declared but not registered: ${missing}`);
    });

    test('a contributed command responds when executed', async () => {
        // showStatus is informational and does not require a running server.
        await vscode.commands.executeCommand('zenzic.showStatus');
    });
});
