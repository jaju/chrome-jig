/**
 * ClojureScript eval command - compile ClojureScript then evaluate in the browser
 */

import { ChromeConnection } from '../chrome/connection.js';
import { compile } from '../cljs/compiler.js';
import type { EvalResult } from './eval.js';

export async function evaluateCljs(
  connection: ChromeConnection,
  source: string,
): Promise<EvalResult> {
  const compiled = compile(source);
  if (!compiled.success) {
    return { success: false, error: compiled.error };
  }

  try {
    const value = await connection.evaluate(compiled.js!);
    return { success: true, value };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
