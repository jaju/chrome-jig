/**
 * XDG Base Directory Specification helpers
 * https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html
 */

import { homedir } from 'node:os';
import { join } from 'node:path';

const APP_NAME = 'chrome-debug-repl';

export interface XDGPaths {
  config: string;      // User configuration
  data: string;        // User data (chrome profiles)
  state: string;       // Runtime state (session info)
  cache: string;       // Cache (not used currently)
}

function getXDGBase(envVar: string, fallback: string): string {
  return process.env[envVar] || join(homedir(), fallback);
}

export function getXDGPaths(): XDGPaths {
  return {
    config: join(getXDGBase('XDG_CONFIG_HOME', '.config'), APP_NAME),
    data: join(getXDGBase('XDG_DATA_HOME', '.local/share'), APP_NAME),
    state: join(getXDGBase('XDG_STATE_HOME', '.local/state'), APP_NAME),
    cache: join(getXDGBase('XDG_CACHE_HOME', '.cache'), APP_NAME),
  };
}

export function getConfigPath(): string {
  return join(getXDGPaths().config, 'config.json');
}

export function getProfilesDir(): string {
  return join(getXDGPaths().config, 'profiles');
}

export function getChromeProfileDir(profileName: string): string {
  return join(getXDGPaths().data, 'chrome-profiles', profileName);
}

export function getSessionStatePath(): string {
  return join(getXDGPaths().state, 'last-session.json');
}
