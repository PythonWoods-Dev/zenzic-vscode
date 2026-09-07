// SPDX-FileCopyrightText: 2026 PythonWoods
//
// SPDX-License-Identifier: Apache-2.0
//
// Phase 2 of the extension-host suite: the behaviours only a real
// client -> server round trip can exercise. Each test drives VS Code's own
// file operations (WorkspaceEdit.renameFile, TextDocument.save) so that
// vscode-languageclient's forwarding of workspace/willRenameFiles and
// textDocument/willSaveWaitUntil is proven live, not read from source.
//
// The fixture is a throwaway copy (see runTest.ts); every scenario owns its
// own files so no test can contaminate another. Where the server's behaviour
// is a documented *limit* rather than a feature, the test pins the observed
// behaviour and says so, rather than asserting what would be nice.

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const EXTENSION_ID = 'pythonwoods.zenzic-vscode';

function ws(): string {
    const f = vscode.workspace.workspaceFolders?.[0];
    assert.ok(f, 'fixture workspace not opened');
    return f.uri.fsPath;
}
const docPath = (rel: string): string => path.join(ws(), 'docs', rel);
const docUri = (rel: string): vscode.Uri => vscode.Uri.file(docPath(rel));
const read = (rel: string): string => fs.readFileSync(docPath(rel), 'utf8');
/**
 * What a willRenameFiles participant edit changes is the *document*, not the
 * file: VS Code applies the returned WorkspaceEdit to the in-memory text model
 * and leaves it dirty. A test reading the file from disk sees nothing, which
 * is exactly how the first two runs of this suite were misread.
 */
async function buffer(rel: string): Promise<vscode.TextDocument> {
    return vscode.workspace.openTextDocument(docUri(rel));
}

async function until(cond: () => boolean, ms: number, what: string): Promise<void> {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
        if (cond()) { return; }
        await new Promise((r) => setTimeout(r, 200));
    }
    assert.fail(`timed out after ${ms}ms waiting for: ${what}`);
}

/** Rename through VS Code itself, so onWillRenameFiles fires for real. */
async function renameFiles(pairs: Array<[string, string]>): Promise<void> {
    const edit = new vscode.WorkspaceEdit();
    for (const [from, to] of pairs) {
        edit.renameFile(vscode.Uri.file(from), vscode.Uri.file(to));
    }
    const ok = await vscode.workspace.applyEdit(edit);
    assert.strictEqual(ok, true, `applyEdit(rename) returned false for ${JSON.stringify(pairs)}`);
}

suite('extension host: LSP client is live', () => {
    suiteSetup(async function () {
        this.timeout(60_000);
        const doc = await vscode.workspace.openTextDocument(docUri('broken.md'));
        await vscode.window.showTextDocument(doc);
        await vscode.extensions.getExtension(EXTENSION_ID)!.activate();
    });

    test('the server publishes a Zenzic diagnostic for a broken link (Z101)', async function () {
        this.timeout(60_000);
        const uri = docUri('broken.md');
        // An LSP diagnostic carrying a codeDescription reaches the API as
        // { value, target }, not a string -- match on either shape.
        const codeOf = (d: vscode.Diagnostic): string =>
            typeof d.code === 'object' && d.code !== null ? String((d.code as { value: unknown }).value) : String(d.code);
        const dump = (): string =>
            JSON.stringify(vscode.languages.getDiagnostics(uri).map((d) => ({ code: codeOf(d), source: d.source, message: d.message })));
        await until(
            () => vscode.languages.getDiagnostics(uri).some((d) => codeOf(d).includes('Z101')),
            45_000,
            `a Z101 diagnostic on docs/broken.md -- got ${dump()}`
        );
        assert.ok(vscode.languages.getDiagnostics(uri).some((d) => codeOf(d).includes('Z101')), dump());
    });
});

suite('extension host: auto-fix on save (willSaveWaitUntil)', () => {
    test('a bare URL is angle-bracketed when the document is saved (Z515)', async function () {
        this.timeout(60_000);
        const doc = await vscode.workspace.openTextDocument(docUri('bare.md'));
        await vscode.window.showTextDocument(doc);
        // save() is a no-op on a clean document, so dirty it first
        const edit = new vscode.WorkspaceEdit();
        edit.insert(doc.uri, new vscode.Position(doc.lineCount, 0), '\n');
        assert.ok(await vscode.workspace.applyEdit(edit));
        assert.ok(await doc.save(), 'save() returned false');
        await until(() => read('bare.md').includes('<https://example.com>'), 20_000, 'bare URL rewritten on disk');
        assert.ok(read('bare.md').includes('<https://example.com>'), read('bare.md'));
    });
});

suite('extension host: auto-repair links on rename (willRenameFiles)', () => {
    test('[edge 1 + row 3] a rename through VS Code rewrites the inbound link', async function () {
        this.timeout(60_000);
        await renameFiles([[docPath('b.md'), docPath('b2.md')]]);
        const a = await buffer('a.md');
        await until(() => a.getText().includes('(b2.md)'), 20_000, `a.md buffer rewritten -- buffer is: ${a.getText()}`);
        assert.ok(a.getText().includes('[B](b2.md)'), a.getText());
        assert.ok(!a.getText().includes('./b.md'), 'old href survived');
        // Pins the real behaviour: the repair lands in the editor buffer and is
        // NOT written to disk until the user saves.
        assert.strictEqual(a.isDirty, true, 'expected the repaired linking file to be left dirty');
        assert.ok(read('a.md').includes('./b.md'), 'disk was rewritten -- behaviour changed, update this test');
    });

    test('[edge 5] two distinct links to the same target in one file are both rewritten', async function () {
        this.timeout(60_000);
        await renameFiles([[docPath('m.md'), docPath('m2.md')]]);
        const multi = await buffer('multi.md');
        await until(() => multi.getText().includes('(m2.md)'), 20_000, `multi.md buffer rewritten -- buffer is: ${multi.getText()}`);
        const text = multi.getText();
        assert.strictEqual((text.match(/\(m2\.md\)/g) ?? []).length, 2, text);
        assert.ok(!text.includes('./m.md'), 'an old href survived');
    });

    test('[edge 2] batch rename where a renamed file is also a linking file', async function () {
        this.timeout(60_000);
        await renameFiles([
            [docPath('c.md'), docPath('c2.md')],
            [docPath('d.md'), docPath('d2.md')],
        ]);
        await until(() => fs.existsSync(docPath('c2.md')) && fs.existsSync(docPath('d2.md')), 20_000, 'both files renamed');
        const c2 = await buffer('c2.md');
        const d2 = await buffer('d2.md');
        await until(() => c2.getText().includes('(d2.md)') && d2.getText().includes('(c2.md)'), 20_000,
            `both cross-links rewritten -- c2: ${c2.getText()} | d2: ${d2.getText()}`);
        assert.ok(c2.getText().includes('[D](d2.md)'), c2.getText());
        assert.ok(d2.getText().includes('[C](c2.md)'), d2.getText());
    });

    test('[edge 3] a folder rename is skipped: the link is left as-is (documented limit)', async function () {
        this.timeout(60_000);
        await renameFiles([[path.join(ws(), 'docs', 'sub'), path.join(ws(), 'docs', 'sub2')]]);
        await until(() => fs.existsSync(docPath('sub2/f.md')), 20_000, 'folder renamed');
        // give a would-be edit every chance to land before asserting it did not
        await new Promise((r) => setTimeout(r, 3_000));
        const g = await buffer('g.md');
        assert.ok(g.getText().includes('(./sub/f.md)'), `folder rename must NOT rewrite links; g.md buffer is now: ${g.getText()}`);
        assert.strictEqual(g.isDirty, false, 'g.md was touched by a folder rename');
    });

    test('[edge 4] an unsaved, just-typed inbound link is not repaired (VSM built from disk)', async function () {
        this.timeout(60_000);
        const doc = await vscode.workspace.openTextDocument(docUri('stale-linker.md'));
        await vscode.window.showTextDocument(doc);
        const edit = new vscode.WorkspaceEdit();
        edit.insert(doc.uri, new vscode.Position(doc.lineCount, 0), '\nSee [I](./i.md).\n');
        assert.ok(await vscode.workspace.applyEdit(edit));
        assert.ok(doc.isDirty);
        await renameFiles([[docPath('i.md'), docPath('i2.md')]]);
        await until(() => fs.existsSync(docPath('i2.md')), 20_000, 'i.md renamed');
        await new Promise((r) => setTimeout(r, 3_000));
        // Pins the observed limit: incoming_links comes from the on-disk VSM,
        // so a link that exists only in an unsaved buffer is not found.
        assert.ok(doc.getText().includes('./i.md'), `unsaved link was rewritten -- the VSM-staleness limit no longer holds: ${doc.getText()}`);
    });

    test('[edge 7] renaming onto a colliding canonical URL is not detected (documented gap)', async function () {
        this.timeout(60_000);
        // e.md already owns the canonical URL /e/ ; k.md -> e/index.md also maps to /e/
        fs.mkdirSync(docPath('e'), { recursive: true });
        await renameFiles([[docPath('k.md'), docPath('e/index.md')]]);
        await until(() => fs.existsSync(docPath('e/index.md')), 20_000, 'k.md renamed into e/');
        const klink = await buffer('klink.md');
        await until(() => klink.getText().includes('e/index.md'), 20_000, `klink.md rewritten -- buffer is: ${klink.getText()}`);
        // Pins the observed behaviour: the link is rewritten and no collision
        // is reported. e.md and e/index.md now both resolve to /e/.
        assert.ok(klink.getText().includes('(e/index.md)'), klink.getText());
        assert.ok(fs.existsSync(docPath('e.md')), 'e.md must still exist -- the collision is real');
    });
});

suite('extension host: case-insensitive identity on rename', () => {
    // Rename edge case (6). The href is written in lowercase, the file is
    // mixed-case. The server identifies the renamed file up to letter case
    // when no other route differs from it only by case, so the repair is the
    // same on NTFS and on ext4 -- which is why this no longer skips on Linux.
    // (Before the fix, a real Windows run showed the link left untouched: the
    // lowercase href indexed under `/casetarget/`, the file's route was
    // `/CaseTarget/`, and the exact lookup found nothing.)
    test('[edge 6] a lowercase href to a mixed-case file is repaired on rename', async function () {
        this.timeout(60_000);
        await renameFiles([[docPath('CaseTarget.md'), docPath('CaseTarget2.md')]]);
        const linker = await buffer('caselink.md');
        await until(() => linker.getText().includes('CaseTarget2.md'), 20_000, `caselink.md buffer is: ${linker.getText()}`);
        assert.ok(linker.getText().includes('(CaseTarget2.md)'), linker.getText());
    });

    // A rename that changes only letter case. On a case-insensitive
    // filesystem the new name already "exists" (it is the old file), so a
    // server that resolved the new path through the filesystem would see
    // old == new and rewrite nothing. On Linux this is an ordinary rename;
    // on Windows it is the case the directive names.
    test('[edge 8] a case-only rename still rewrites the inbound link', async function () {
        this.timeout(60_000);
        await renameFiles([[docPath('MixedCase.md'), docPath('mixedcase.md')]]);
        const linker = await buffer('mixedlink.md');
        await until(() => linker.getText().includes('(mixedcase.md)'), 20_000, `mixedlink.md buffer is: ${linker.getText()}`);
        assert.ok(!linker.getText().includes('(MixedCase.md)'), 'old spelling survived');
    });
});
