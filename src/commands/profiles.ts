/**
 * Profile management commands
 */

import { listProfiles as listAll, saveProfileConfig, ProfileConfig } from '../config/profiles.js';

export interface ProfilesListResult {
  success: boolean;
  profiles: Array<{
    name: string;
    hasConfig: boolean;
    hasData: boolean;
    extensions?: string[];
  }>;
}

export function listProfilesCommand(): ProfilesListResult {
  const profiles = listAll();

  return {
    success: true,
    profiles: profiles.map((p) => ({
      name: p.name,
      hasConfig: p.hasConfig,
      hasData: p.hasData,
      extensions: p.config?.extensions,
    })),
  };
}

export interface CreateProfileOptions {
  extensions?: string[];
  flags?: string[];
  url?: string;
}

export interface CreateProfileResult {
  success: boolean;
  message: string;
}

export function createProfileCommand(
  name: string,
  options: CreateProfileOptions = {},
): CreateProfileResult {
  const config: ProfileConfig = {};

  if (options.extensions?.length) config.extensions = options.extensions;
  if (options.flags?.length) config.flags = options.flags;
  if (options.url) config.url = options.url;

  saveProfileConfig(name, config);

  return {
    success: true,
    message: `Profile "${name}" created`,
  };
}
