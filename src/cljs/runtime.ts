/**
 * Squint core runtime — ESM→global rewrite and browser injection
 *
 * Transforms squint-cljs/src/squint/core.js into an injectable IIFE
 * that exposes all core functions as globalThis.squint_core.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { Page } from 'playwright-core';
import type { ChromeConnection } from '../chrome/connection.js';

let cachedScript: string | null = null;
let lastInjectedPage: Page | null = null;

/**
 * Build the injectable JS string from squint's core module.
 *
 * Uses dynamic import for the authoritative export list and a single
 * regex replacement to strip ESM export keywords. Result is cached
 * after the first call.
 */
export async function buildCoreScript(): Promise<string> {
  if (cachedScript) return cachedScript;

  const require = createRequire(import.meta.url);
  const corePath = require.resolve('squint-cljs/src/squint/core.js');
  const source = readFileSync(corePath, 'utf-8');

  const mod = await import('squint-cljs/core.js');
  const names = Object.keys(mod);

  const stripped = source.replace(/^export /gm, '');
  const assignment = `globalThis.squint_core = { ${names.join(', ')} };`;

  cachedScript = [
    '(function() {',
    '  if (typeof globalThis.__cjig_squint_core !== "undefined") return;',
    stripped,
    assignment,
    '  globalThis.__cjig_squint_core = true;',
    '})();',
  ].join('\n');

  return cachedScript;
}

/**
 * Inject the squint core runtime into the browser page.
 *
 * Skips injection if the current page object matches the last one
 * we injected into. The browser-side guard provides a safety net
 * even if Node-side state is stale.
 */
export async function injectRuntime(connection: ChromeConnection): Promise<void> {
  const page = connection.getCurrentPage();
  if (page === lastInjectedPage) return;

  const script = await buildCoreScript();
  await connection.evaluate(script);
  lastInjectedPage = page;
}

/**
 * Reset injection tracking. The next injectRuntime call will
 * re-inject regardless of which page is current.
 *
 * Call this after events that clear browser JS state (page reload)
 * while the Page object identity stays the same.
 */
export function invalidateRuntime(): void {
  lastInjectedPage = null;
}
