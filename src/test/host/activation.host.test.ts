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

    test('an .mdx document resolves to the mdx language, not plaintext', async () => {
        // The defect this pins: `activationEvents` declared `onLanguage:mdx`
        // and the client's documentSelector covered `language: 'mdx'`, but
        // nothing contributed that language. VS Code has no built-in `mdx`,
        // so on a stock install the file opened as **plaintext**, neither
        // activation event fired, and the extension was silently inert on
        // exactly the file type the README advertised.
        //
        // The host runs with only this extension loaded, which is the stock
        // condition: if the language resolves here, it resolves because this
        // package contributes it and not because something else did.
        //
        // Deliberately NOT asserting `ext.isActive` here: an earlier test in
        // this same host already activated the extension, so that assertion
        // would pass whatever the trigger did. Activation from cold, with the
        // .mdx opened first, is proven in the capture container instead.
        const folder = vscode.workspace.workspaceFolders?.[0];
        assert.ok(folder, 'fixture workspace not opened');
        const doc = await vscode.workspace.openTextDocument(
            path.join(folder.uri.fsPath, 'docs', 'mdx-probe.mdx')
        );
        assert.strictEqual(
            doc.languageId,
            'mdx',
            `.mdx resolved to '${doc.languageId}' — the extension must contribute the mdx language`
        );
    });

    test('every contributed command is registered in the real command registry', async () => {
        const registered = new Set(await vscode.commands.getCommands(true));
        const missing = CONTRIBUTED_COMMANDS.filter((c) => !registered.has(c));
        assert.deepStrictEqual(missing, [], `commands declared but not registered: ${missing}`);
    });

    test('a contributed command responds when executed', async () => {
        // showStatus opens a QuickPick and awaits the user's choice. Headless,
        // nobody chooses, so the promise only settles when the picker is
        // dismissed -- which is why earlier runs of this test took anywhere
        // from 2s to the 60s timeout. Dismiss it deliberately: the assertion
        // is that the handler ran to its await and returned once dismissed.
        const invoked = vscode.commands.executeCommand('zenzic.showStatus');
        await new Promise((r) => setTimeout(r, 500));
        await vscode.commands.executeCommand('workbench.action.closeQuickOpen');
        await invoked;
    });
});
