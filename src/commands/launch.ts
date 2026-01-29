/**
 * Launch Chrome with debugging enabled
 */

import { launchChrome, LaunchOptions, LaunchResult } from '../chrome/launcher.js';
import { ResolvedConfig } from '../config/schema.js';

export interface LaunchCommandOptions {
  profile?: string;
  url?: string;
}

export async function launch(
  config: ResolvedConfig,
  options: LaunchCommandOptions = {}
): Promise<LaunchResult> {
  const launchOptions: LaunchOptions = {
    port: config.port,
    profile: options.profile ?? config.profile,
    chromePath: config.chromePath,
    chromeFlags: config.chromeFlags,
    url: options.url,
  };

  return await launchChrome(launchOptions);
}
