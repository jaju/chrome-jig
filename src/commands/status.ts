/**
 * Status command - check if Chrome is running
 */

import { getStatus } from '../chrome/launcher.js';
import { ResolvedConfig } from '../config/schema.js';

export interface StatusResult {
  running: boolean;
  browser?: string;
  protocol?: string;
  webSocketUrl?: string;
  profile?: string;
  port?: number;
  host?: string;
}

export async function status(config: ResolvedConfig): Promise<StatusResult> {
  const result = await getStatus(config.host, config.port);

  if (!result.running) {
    return {
      running: false,
      host: config.host,
      port: config.port,
      profile: result.session?.profile,
    };
  }

  return {
    running: true,
    browser: result.version?.['Browser'],
    protocol: result.version?.['Protocol-Version'],
    webSocketUrl: result.version?.['webSocketDebuggerUrl'],
    profile: result.session?.profile ?? config.profile,
    port: config.port,
    host: config.host,
  };
}
