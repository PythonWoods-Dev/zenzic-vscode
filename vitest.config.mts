// SPDX-FileCopyrightText: 2026 PythonWoods
//
// SPDX-License-Identifier: Apache-2.0
//
// Covers only modules with zero `vscode` import (currently: src/semver.ts).
// Any file importing `vscode` at module scope cannot load under plain Node —
// that module only resolves inside a running VS Code Extension Host. Those
// behaviours are covered by the separate extension-host suite under
// src/test/host/ (`npm run test:host`), which launches a real VS Code via
// @vscode/test-electron. The two suites collect disjoint file patterns
// (test/**/*.test.ts here, **/*.host.test.js there) so neither can pick up
// the other's files by accident.

import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['test/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            include: ['src/semver.ts'],
            reporter: ['text', 'json-summary'],
            thresholds: {
                // Bootstrap-stage floor: src/semver.ts is the only module
                // covered so far (100% real, see CHANGELOG.md). Set below
                // 100 so a future line added to this file without an
                // immediately-updated test doesn't hard-fail CI on day one,
                // while still catching any real regression in the existing
                // branches.
                lines: 90,
                branches: 90,
                functions: 90,
                statements: 90
            }
        }
    }
});
