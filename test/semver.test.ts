// SPDX-FileCopyrightText: 2026 PythonWoods
//
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { compareSemver } from '../src/semver';

describe('compareSemver', () => {
    it('returns 0 for equal versions', () => {
        expect(compareSemver('0.30.0', '0.30.0')).toBe(0);
    });

    it('returns negative when v1 has a lower major version', () => {
        expect(compareSemver('0.30.0', '1.0.0')).toBeLessThan(0);
    });

    it('returns positive when v1 has a higher major version', () => {
        expect(compareSemver('1.0.0', '0.30.0')).toBeGreaterThan(0);
    });

    it('compares minor versions when major versions match', () => {
        expect(compareSemver('0.29.0', '0.30.0')).toBeLessThan(0);
        expect(compareSemver('0.31.0', '0.30.0')).toBeGreaterThan(0);
    });

    it('compares patch versions when major and minor versions match', () => {
        expect(compareSemver('0.30.0', '0.30.1')).toBeLessThan(0);
        expect(compareSemver('0.30.2', '0.30.1')).toBeGreaterThan(0);
    });

    it('ignores pre-release/build metadata suffixes', () => {
        expect(compareSemver('0.30.0-beta.1', '0.30.0')).toBe(0);
    });

    it('throws a descriptive error on a malformed version string', () => {
        expect(() => compareSemver('not-a-version', '0.30.0')).toThrow(
            "Invalid SemVer format: 'not-a-version'"
        );
    });

    it('matches the real MIN_CORE_VERSION handshake scenario from extension.ts', () => {
        // The exact comparison extension.ts performs before starting the LSP
        // client: a found core version below MIN_CORE_VERSION must compare
        // as less-than, blocking activation.
        expect(compareSemver('0.29.5', '0.30.0')).toBeLessThan(0);
        expect(compareSemver('0.30.0', '0.30.0')).not.toBeLessThan(0);
        expect(compareSemver('0.31.0', '0.30.0')).not.toBeLessThan(0);
    });
});
