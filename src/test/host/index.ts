// SPDX-FileCopyrightText: 2026 PythonWoods
//
// SPDX-License-Identifier: Apache-2.0
//
// Mocha runner executed *inside* the Extension Host by runTest.ts. Only files
// named *.host.test.js are collected, so the vitest suite (test/**/*.test.ts,
// plain Node) and this one (needs a live VS Code) can never pick up each
// other's files by accident.

import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';

export async function run(): Promise<void> {
    const mocha = new Mocha({ ui: 'tdd', color: true, timeout: 60_000 });
    const testsRoot = __dirname;
    const files = await glob('**/*.host.test.js', { cwd: testsRoot });
    if (files.length === 0) {
        throw new Error(`no *.host.test.js files found under ${testsRoot}`);
    }
    for (const f of files.sort()) {
        mocha.addFile(path.resolve(testsRoot, f));
    }
    await new Promise<void>((resolve, reject) => {
        mocha.run((failures) =>
            failures > 0 ? reject(new Error(`${failures} test(s) failed`)) : resolve()
        );
    });
}
