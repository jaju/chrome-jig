/**
 * Export connection info for Playwright handoff
 */

import { loadSessionState } from '../chrome/launcher.js';

export interface ConnectionInfo {
  host: string;
  port: number;
  endpoint: string;
  webSocketDebuggerUrl: string;
  source: 'launched' | 'attached';
  profile?: string;
}

export interface ConnectionInfoResult {
  success: boolean;
  message: string;
  info?: ConnectionInfo;
}

export async function getConnectionInfo(
  host: string,
  port: number,
): Promise<ConnectionInfoResult> {
  try {
    const response = await fetch(`http://${host}:${port}/json/version`);
    if (!response.ok) {
      return { success: false, message: `Chrome not responding at ${host}:${port}` };
    }

    const version = (await response.json()) as Record<string, string>;
    const session = loadSessionState();

    return {
      success: true,
      message: 'Connection info retrieved',
      info: {
        host,
        port,
        endpoint: `http://${host}:${port}`,
        webSocketDebuggerUrl: version['webSocketDebuggerUrl'] ?? '',
        source: session?.source ?? 'launched',
        profile: session?.profile,
      },
    };
  } catch {
    return { success: false, message: `Chrome not running at ${host}:${port}` };
  }
}
