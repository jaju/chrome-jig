declare module 'squint-cljs' {
  interface CompileOptions {
    context?: 'expr' | 'statement' | 'return';
    'elide-imports'?: boolean;
    [key: string]: unknown;
  }

  export function compileString(source: string, opts?: CompileOptions): string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare module 'squint-cljs/core.js';
