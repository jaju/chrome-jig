/**
 * Attach to an already-running Chrome instance
 */

import { isPortInUse, saveSessionState } from '../chrome/launcher.js';

export interface AttachResult {
  success: boolean;
  message: string;
  browser?: string;
  tabCount?: number;
}

export async function attach(host: string, port: number): Promise<AttachResult> {
  const running = await isPortInUse(port, host);

  if (!running) {
    return {
      success: false,
      message: `No Chrome found at ${host}:${port}`,
    };
  }

  // Fetch browser info
  const response = await fetch(`http://${host}:${port}/json/version`);
  const version = (await response.json()) as Record<string, string>;

  // Count tabs
  const tabsResponse = await fetch(`http://${host}:${port}/json/list`);
  const tabs = (await tabsResponse.json()) as unknown[];

  // Save session state so other commands work
  saveSessionState({
    port,
    host,
    profile: 'external',
    source: 'attached',
    startedAt: new Date().toISOString(),
  });

  return {
    success: true,
    message: `Attached to Chrome at ${host}:${port}`,
    browser: version['Browser'],
    tabCount: tabs.length,
  };
}
