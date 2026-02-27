/**
 * Eval command - evaluate JavaScript in the browser
 */

import { ChromeConnection } from '../chrome/connection.js';
import { CjigError, type ErrorCategory } from '../errors.js';

export interface EvalResult {
  success: boolean;
  value?: unknown;
  error?: string;
  category?: ErrorCategory;
  retryable?: boolean;
}

export async function evaluate(
  connection: ChromeConnection,
  expression: string
): Promise<EvalResult> {
  try {
    const value = await connection.evaluate(expression);
    return { success: true, value };
  } catch (err) {
    if (err instanceof CjigError) {
      return {
        success: false,
        error: err.message,
        category: err.category,
        retryable: err.retryable,
      };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  if (typeof value === 'string') {
    return `"${value}"`;
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

export function formatJson(result: EvalResult): string {
  return JSON.stringify(result);
}
