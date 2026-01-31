/**
 * ClojureScript compilation via squint-cljs
 */

import { compileString } from 'squint-cljs';

export interface CompileResult {
  success: boolean;
  js?: string;
  error?: string;
}

export function compile(source: string): CompileResult {
  try {
    const js = compileString(source, {
      context: 'expr',
      'elide-imports': true,
      'elide-exports': true,
    });
    return { success: true, js };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
