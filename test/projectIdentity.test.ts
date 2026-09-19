// SPDX-FileCopyrightText: 2026 PythonWoods
//
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
    identityTooltipLines,
    isEngineGeneratorMismatch,
    parseProjectIdentity,
    statusBarText
} from '../src/projectIdentity';

const ASTRO_STANDALONE = JSON.stringify({
    zenzic_version: '0.31.0',
    engine: 'standalone',
    engine_source: 'auto-detected',
    generator: 'astro'
});

describe('parseProjectIdentity', () => {
    it('reads the three fields zenzic env reports', () => {
        expect(parseProjectIdentity(ASTRO_STANDALONE)).toEqual({
            engine: 'standalone',
            engineSource: 'auto-detected',
            generator: 'astro'
        });
    });

    it('accepts a null generator, which is what "none detected" looks like', () => {
        const raw = JSON.stringify({ engine: 'mkdocs', engine_source: 'configured', generator: null });
        expect(parseProjectIdentity(raw)?.generator).toBeNull();
    });

    it('skips anything printed before the JSON object', () => {
        expect(parseProjectIdentity(`warning: something\n${ASTRO_STANDALONE}`)?.engine).toBe('standalone');
    });

    it('returns null rather than throwing on malformed output', () => {
        expect(parseProjectIdentity('not json at all')).toBeNull();
        expect(parseProjectIdentity('{ "engine": ')).toBeNull();
        expect(parseProjectIdentity('')).toBeNull();
    });

    it('returns null for an older core that does not report an engine', () => {
        const old = JSON.stringify({ zenzic_version: '0.30.0', python_executable: '/usr/bin/python3' });
        expect(parseProjectIdentity(old)).toBeNull();
    });
});

describe('statusBarText', () => {
    it('names the engine and the generator', () => {
        expect(statusBarText(parseProjectIdentity(ASTRO_STANDALONE))).toBe('$(check) Zenzic: standalone · Astro');
    });

    it('names the engine alone when no generator was detected', () => {
        const raw = JSON.stringify({ engine: 'mkdocs', engine_source: 'configured', generator: null });
        expect(statusBarText(parseProjectIdentity(raw))).toBe('$(check) Zenzic: mkdocs');
    });

    it('falls back to the previous wording when there is nothing to report', () => {
        expect(statusBarText(null)).toBe('$(check) Zenzic: Running');
    });
});

describe('isEngineGeneratorMismatch', () => {
    it('is true for a generator analysed without its route manifest', () => {
        expect(isEngineGeneratorMismatch(parseProjectIdentity(ASTRO_STANDALONE))).toBe(true);
    });

    it('is false once the engine reads that manifest', () => {
        const raw = JSON.stringify({ engine: 'prebuilt', engine_source: 'configured', generator: 'astro' });
        expect(isEngineGeneratorMismatch(parseProjectIdentity(raw))).toBe(false);
    });

    it('is false when no generator was detected — there is nothing to mismatch', () => {
        const raw = JSON.stringify({ engine: 'standalone', engine_source: 'default', generator: null });
        expect(isEngineGeneratorMismatch(parseProjectIdentity(raw))).toBe(false);
    });

    it('is false when the identity could not be read at all', () => {
        expect(isEngineGeneratorMismatch(null)).toBe(false);
    });
});

describe('identityTooltipLines', () => {
    it('explains the mismatch instead of only flagging it', () => {
        const lines = identityTooltipLines(parseProjectIdentity(ASTRO_STANDALONE)).join('\n');
        expect(lines).toContain('**Engine**: `standalone` (auto-detected)');
        expect(lines).toContain('**Generator**: `astro`');
        expect(lines).toContain('route manifest');
    });

    it('says nothing extra when engine and generator agree', () => {
        const raw = JSON.stringify({ engine: 'prebuilt', engine_source: 'configured', generator: 'docusaurus' });
        const lines = identityTooltipLines(parseProjectIdentity(raw));
        expect(lines).toHaveLength(2);
    });

    it('contributes no lines when there is no identity', () => {
        expect(identityTooltipLines(null)).toEqual([]);
    });
});
