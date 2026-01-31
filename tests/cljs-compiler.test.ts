import { describe, it, expect } from 'vitest';
import { compile } from '../src/cljs/compiler.js';

describe('compile', () => {
  it('compiles arithmetic', () => {
    const result = compile('(+ 1 2)');
    expect(result.success).toBe(true);
    expect(result.js).toBeDefined();
    expect(result.error).toBeUndefined();
  });

  it('compiles string operations', () => {
    const result = compile('(str "hello" " " "world")');
    expect(result.success).toBe(true);
    expect(result.js).toBeDefined();
  });

  it('compiles JS interop', () => {
    const result = compile('(js/console.log "hi")');
    expect(result.success).toBe(true);
    expect(result.js).toBeDefined();
  });

  it('compiles function literals', () => {
    const result = compile('(fn [x] (* x x))');
    expect(result.success).toBe(true);
    expect(result.js).toBeDefined();
  });

  it('returns error for syntax errors', () => {
    const result = compile('(+ 1');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.js).toBeUndefined();
  });

  it('success result has js string, no error', () => {
    const result = compile('(+ 1 2)');
    expect(typeof result.js).toBe('string');
    expect(result.js!.length).toBeGreaterThan(0);
    expect(result).not.toHaveProperty('error');
  });

  it('failure result has error string, no js', () => {
    const result = compile('(+ 1');
    expect(typeof result.error).toBe('string');
    expect(result).not.toHaveProperty('js');
  });
});
