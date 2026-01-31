import { describe, it, expect } from 'vitest';
import { formatJson } from '../src/commands/eval.js';
import type { EvalResult } from '../src/commands/eval.js';

describe('formatJson', () => {
  it('produces correct shape for string value', () => {
    const result: EvalResult = { success: true, value: 'hello' };
    const parsed = JSON.parse(formatJson(result));
    expect(parsed).toEqual({ success: true, value: 'hello' });
  });

  it('produces correct shape for object value', () => {
    const result: EvalResult = { success: true, value: { x: 1, y: [2, 3] } };
    const parsed = JSON.parse(formatJson(result));
    expect(parsed).toEqual({ success: true, value: { x: 1, y: [2, 3] } });
  });

  it('handles null value', () => {
    const result: EvalResult = { success: true, value: null };
    const parsed = JSON.parse(formatJson(result));
    expect(parsed).toEqual({ success: true, value: null });
  });

  it('handles undefined value (omitted from JSON)', () => {
    const result: EvalResult = { success: true, value: undefined };
    const parsed = JSON.parse(formatJson(result));
    expect(parsed).toEqual({ success: true });
    expect(parsed).not.toHaveProperty('value');
  });

  it('produces correct shape for error result', () => {
    const result: EvalResult = { success: false, error: 'ReferenceError: x is not defined' };
    const parsed = JSON.parse(formatJson(result));
    expect(parsed).toEqual({ success: false, error: 'ReferenceError: x is not defined' });
  });

  it('round-trips through JSON.parse', () => {
    const result: EvalResult = { success: true, value: 42 };
    const json = formatJson(result);
    expect(JSON.parse(json)).toEqual(result);
  });

  it('contains no extra keys on success', () => {
    const result: EvalResult = { success: true, value: 'test' };
    const parsed = JSON.parse(formatJson(result));
    expect(Object.keys(parsed).sort()).toEqual(['success', 'value']);
  });

  it('contains no extra keys on error', () => {
    const result: EvalResult = { success: false, error: 'fail' };
    const parsed = JSON.parse(formatJson(result));
    expect(Object.keys(parsed).sort()).toEqual(['error', 'success']);
  });
});
