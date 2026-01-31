import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/commands/eval.js', () => ({
  evaluate: vi.fn(),
}));

vi.mock('../src/commands/cljs-eval.js', () => ({
  evaluateCljs: vi.fn(),
}));

import { builtinMethods } from '../src/session/session.js';
import { evaluate } from '../src/commands/eval.js';
import { evaluateCljs } from '../src/commands/cljs-eval.js';
import type { ChromeConnection } from '../src/chrome/connection.js';
import type { ResolvedConfig } from '../src/config/schema.js';

const mockConnection = {} as ChromeConnection;
const mockConfig = {} as ResolvedConfig;

const evaluateMock = vi.mocked(evaluate);
const evaluateCljsMock = vi.mocked(evaluateCljs);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('eval method — lang routing', () => {
  it('defaults to JS when lang is omitted', async () => {
    evaluateMock.mockResolvedValue({ success: true, value: 2 });

    const result = await builtinMethods.eval({ code: '1+1' }, mockConnection, mockConfig);

    expect(evaluateMock).toHaveBeenCalledWith(mockConnection, '1+1');
    expect(evaluateCljsMock).not.toHaveBeenCalled();
    expect(result).toBe(2);
  });

  it('routes to JS when lang is "js"', async () => {
    evaluateMock.mockResolvedValue({ success: true, value: 42 });

    const result = await builtinMethods.eval({ code: '42', lang: 'js' }, mockConnection, mockConfig);

    expect(evaluateMock).toHaveBeenCalledWith(mockConnection, '42');
    expect(result).toBe(42);
  });

  it('routes to CLJS when lang is "cljs"', async () => {
    evaluateCljsMock.mockResolvedValue({ success: true, value: 3 });

    const result = await builtinMethods.eval({ code: '(+ 1 2)', lang: 'cljs' }, mockConnection, mockConfig);

    expect(evaluateCljsMock).toHaveBeenCalledWith(mockConnection, '(+ 1 2)');
    expect(evaluateMock).not.toHaveBeenCalled();
    expect(result).toBe(3);
  });

  it('throws for unknown lang', async () => {
    await expect(
      builtinMethods.eval({ code: 'x', lang: 'python' }, mockConnection, mockConfig),
    ).rejects.toThrow('Unknown lang: python. Supported: js, cljs');
  });

  it('throws when code is missing', async () => {
    await expect(
      builtinMethods.eval({}, mockConnection, mockConfig),
    ).rejects.toThrow('Missing param: code');
  });

  it('propagates eval errors', async () => {
    evaluateMock.mockResolvedValue({ success: false, error: 'ReferenceError: x is not defined' });

    await expect(
      builtinMethods.eval({ code: 'x' }, mockConnection, mockConfig),
    ).rejects.toThrow('ReferenceError: x is not defined');
  });

  it('propagates cljs eval errors', async () => {
    evaluateCljsMock.mockResolvedValue({ success: false, error: 'Compile error' });

    await expect(
      builtinMethods.eval({ code: '(bad', lang: 'cljs' }, mockConnection, mockConfig),
    ).rejects.toThrow('Compile error');
  });
});

describe('cljs-eval method — backward compatibility', () => {
  it('delegates to eval with lang: "cljs"', async () => {
    evaluateCljsMock.mockResolvedValue({ success: true, value: 6 });

    const result = await builtinMethods['cljs-eval']({ code: '(* 2 3)' }, mockConnection, mockConfig);

    expect(evaluateCljsMock).toHaveBeenCalledWith(mockConnection, '(* 2 3)');
    expect(result).toBe(6);
  });
});
