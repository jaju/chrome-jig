/**
 * Configuration discovery and loading
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getConfigPath } from './xdg.js';
import {
  ConnectionConfig,
  GlobalConfig,
  ProjectConfig,
  ResolvedConfig,
  ResolvedConnectionConfig,
  ScriptEntry,
  DEFAULT_CHROME_FLAGS,
} from './schema.js';
import { resolveConfig as resolveEnvConfig, EnvConfig } from '../utils/env.js';
import { loadProfileConfig } from './profiles.js';

function deduplicateExtensions(paths: string[]): string[] {
  return [...new Set(paths.filter(Boolean))];
}

const CONNECTION_DEFAULTS: ResolvedConnectionConfig = {
  retries: 3,
  retryDelayMs: 500,
  fallbackHosts: [],
};

function mergeConnectionConfig(...sources: (ConnectionConfig | undefined)[]): ResolvedConnectionConfig {
  const merged = { ...CONNECTION_DEFAULTS };
  for (const source of sources) {
    if (!source) continue;
    if (source.retries !== undefined) merged.retries = source.retries;
    if (source.retryDelayMs !== undefined) merged.retryDelayMs = source.retryDelayMs;
    if (source.timeout !== undefined) merged.timeout = source.timeout;
    if (source.waitUntil !== undefined) merged.waitUntil = source.waitUntil;
    if (source.fallbackHosts !== undefined) merged.fallbackHosts = source.fallbackHosts;
  }
  return merged;
}

const PROJECT_CONFIG_NAMES = [
  '.cjig.json',
  'cjig.json',
  '.cjig.config.json',
];

export function findProjectConfig(startDir: string = process.cwd()): string | null {
  let dir = startDir;

  while (dir !== dirname(dir)) {
    for (const name of PROJECT_CONFIG_NAMES) {
      const configPath = join(dir, name);
      if (existsSync(configPath)) {
        return configPath;
      }
    }
    dir = dirname(dir);
  }

  return null;
}

export function loadJsonFile<T>(path: string): T | null {
  try {
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export function loadGlobalConfig(): GlobalConfig | null {
  return loadJsonFile<GlobalConfig>(getConfigPath());
}

export function loadProjectConfig(explicitPath?: string): ProjectConfig | null {
  const configPath = explicitPath ?? findProjectConfig();
  if (!configPath) return null;
  return loadJsonFile<ProjectConfig>(configPath);
}

export interface LoadConfigOptions {
  port?: number;
  profile?: string;
  host?: string;
  extensions?: string[];
  projectConfigPath?: string;
  connection?: ConnectionConfig;
}

export function loadConfig(options: LoadConfigOptions = {}): ResolvedConfig {
  const globalConfig = loadGlobalConfig();
  const projectConfig = loadProjectConfig(options.projectConfigPath);
  const envConfig = resolveEnvConfig(options as Partial<EnvConfig>);

  // Merge in priority: CLI options > env vars > project config > global config > defaults
  const port = options.port ?? envConfig.port;
  const profile = options.profile ?? envConfig.profile;
  const host = options.host ?? envConfig.host;

  // Load profile config for active profile
  const profileConfig = loadProfileConfig(profile);

  // Extensions: CLI > project > profile > global, deduplicated
  const extensions = deduplicateExtensions([
    ...(options.extensions ?? []),
    ...(projectConfig?.extensions ?? []),
    ...(profileConfig?.extensions ?? []),
    ...(globalConfig?.extensions ?? []),
  ]);

  // Connection: CLI > project > global > defaults
  const connection = mergeConnectionConfig(
    globalConfig?.connection,
    projectConfig?.connection,
    options.connection,
  );

  return {
    port,
    profile,
    host,
    chromePath: envConfig.chromePath ?? globalConfig?.chrome?.path,
    chromeFlags: globalConfig?.chrome?.flags ?? DEFAULT_CHROME_FLAGS,
    extensions,
    connection,
    scripts: {
      baseUrl: envConfig.scriptsBase ?? projectConfig?.scripts?.baseUrl,
      registry: projectConfig?.scripts?.registry ?? {},
    },
    watch: {
      paths: projectConfig?.watch?.paths ?? [],
      debounce: projectConfig?.watch?.debounce ?? 300,
    },
    hooks: {
      preBuild: projectConfig?.hooks?.preBuild,
      postInject: projectConfig?.hooks?.postInject,
    },
  };
}

/**
 * Resolve a script reference to a full URL
 * @param ref - Script name (from registry), alias, or full URL
 * @param config - Resolved configuration
 */
export function resolveScriptUrl(ref: string, config: ResolvedConfig): string | null {
  // Check if it's already a URL
  if (ref.startsWith('http://') || ref.startsWith('https://') || ref.startsWith('file://')) {
    return ref;
  }

  const registry = config.scripts.registry;
  const baseUrl = config.scripts.baseUrl;

  // Find by name or alias
  let entry: ScriptEntry | undefined;

  if (registry[ref]) {
    entry = registry[ref];
  } else {
    // Search by alias
    entry = Object.values(registry).find(
      (e) => e.alias?.toLowerCase() === ref.toLowerCase()
    );
  }

  if (!entry) {
    return null;
  }

  // Build full URL
  if (entry.path.startsWith('http://') || entry.path.startsWith('https://')) {
    return entry.path;
  }

  if (!baseUrl) {
    // Treat as relative to cwd
    return entry.path;
  }

  // Combine baseUrl with path
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${base}${entry.path}`;
}

/**
 * Get script entry by name or alias
 */
export function getScriptEntry(ref: string, config: ResolvedConfig): ScriptEntry | null {
  const registry = config.scripts.registry;

  if (registry[ref]) {
    return registry[ref];
  }

  return Object.values(registry).find(
    (e) => e.alias?.toLowerCase() === ref.toLowerCase()
  ) ?? null;
}
