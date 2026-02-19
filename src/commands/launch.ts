/**
 * Launch Chrome with debugging enabled
 */

import { launchChrome, LaunchOptions, LaunchResult } from '../chrome/launcher.js';
import { ResolvedConfig } from '../config/schema.js';

export interface LaunchCommandOptions {
  profile?: string;
  url?: string;
  extensions?: string[];
}

export async function launch(
  config: ResolvedConfig,
  options: LaunchCommandOptions = {}
): Promise<LaunchResult> {
  const extensions = [
    ...(options.extensions ?? []),
    ...config.extensions,
  ];

  const launchOptions: LaunchOptions = {
    port: config.port,
    profile: options.profile ?? config.profile,
    chromePath: config.chromePath,
    chromeFlags: config.chromeFlags,
    extensions: [...new Set(extensions.filter(Boolean))],
    url: options.url,
  };

  return await launchChrome(launchOptions);
}
