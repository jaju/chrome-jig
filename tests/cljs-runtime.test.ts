import { describe, it, expect, beforeAll } from 'vitest';
import { buildCoreScript } from '../src/cljs/runtime.js';

describe('buildCoreScript', () => {
  let script: string;

  beforeAll(async () => {
    script = await buildCoreScript();
  });

  it('returns a string', () => {
    expect(typeof script).toBe('string');
  });

  it('is a valid IIFE', () => {
    expect(script.startsWith('(function() {')).toBe(true);
    expect(script.trimEnd().endsWith('})();')).toBe(true);
  });

  it('contains no ESM export keywords', () => {
    expect(script).not.toMatch(/^export /m);
  });

  it('assigns globalThis.squint_core', () => {
    expect(script).toContain('globalThis.squint_core');
  });

  it('includes key core functions in the assignment', () => {
    for (const name of ['reduce', 'map', 'filter', 'range', 'atom', '_PLUS_']) {
      expect(script).toContain(name);
    }
  });

  it('executes without error', async () => {
    const fn = new Function(script);
    expect(() => fn()).not.toThrow();
  });

  it('provides working core functions after execution', async () => {
    // buildCoreScript's IIFE sets globalThis.squint_core
    const core = (globalThis as Record<string, unknown>).squint_core as Record<string, Function>;
    expect(core).toBeDefined();
    expect(core.reduce(core._PLUS_, [1, 2, 3])).toBe(6);
  });
});
