/**
 * Profile configuration management
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { getProfilesDir, getXDGPaths } from './xdg.js';

export interface ProfileConfig {
  extensions?: string[];
  flags?: string[];
  url?: string;
}

export interface ProfileInfo {
  name: string;
  hasConfig: boolean;
  hasData: boolean;
  config?: ProfileConfig;
}

export function loadProfileConfig(name: string): ProfileConfig | null {
  const profilePath = join(getProfilesDir(), `${name}.json`);

  if (!existsSync(profilePath)) {
    return null;
  }

  try {
    const content = readFileSync(profilePath, 'utf-8');
    return JSON.parse(content) as ProfileConfig;
  } catch {
    return null;
  }
}

export function saveProfileConfig(name: string, config: ProfileConfig): void {
  const profilesDir = getProfilesDir();

  if (!existsSync(profilesDir)) {
    mkdirSync(profilesDir, { recursive: true });
  }

  const profilePath = join(profilesDir, `${name}.json`);
  writeFileSync(profilePath, JSON.stringify(config, null, 2));
}

export function listProfiles(): ProfileInfo[] {
  const profilesDir = getProfilesDir();
  const dataDir = join(getXDGPaths().data, 'chrome-profiles');

  const configNames = new Set<string>();
  const dataNames = new Set<string>();

  // Scan config dir for profile JSON files
  if (existsSync(profilesDir)) {
    for (const file of readdirSync(profilesDir)) {
      if (file.endsWith('.json')) {
        configNames.add(basename(file, '.json'));
      }
    }
  }

  // Scan data dir for Chrome profile directories
  if (existsSync(dataDir)) {
    for (const dir of readdirSync(dataDir)) {
      dataNames.add(dir);
    }
  }

  const allNames = new Set([...configNames, ...dataNames]);
  const profiles: ProfileInfo[] = [];

  for (const name of [...allNames].sort()) {
    const hasConfig = configNames.has(name);
    profiles.push({
      name,
      hasConfig,
      hasData: dataNames.has(name),
      config: hasConfig ? loadProfileConfig(name) ?? undefined : undefined,
    });
  }

  return profiles;
}
