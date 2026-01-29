/**
 * Inject command - inject scripts into the page
 */

import { ChromeConnection } from '../chrome/connection.js';
import { ResolvedConfig } from '../config/schema.js';
import { resolveScriptUrl, getScriptEntry } from '../config/loader.js';

export interface InjectResult {
  success: boolean;
  url?: string;
  windowApi?: string;
  quickStart?: string;
  error?: string;
}

export async function inject(
  connection: ChromeConnection,
  config: ResolvedConfig,
  ref: string
): Promise<InjectResult> {
  const url = resolveScriptUrl(ref, config);

  if (!url) {
    return {
      success: false,
      error: `Script not found: ${ref}`,
    };
  }

  try {
    await connection.injectScript(url);

    const entry = getScriptEntry(ref, config);

    return {
      success: true,
      url,
      windowApi: entry?.windowApi,
      quickStart: entry?.quickStart,
    };
  } catch (err) {
    return {
      success: false,
      url,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
