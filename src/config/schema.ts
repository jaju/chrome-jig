/**
 * Configuration schema types
 */

export interface GlobalConfig {
  defaults?: {
    port?: number;
    profile?: string;
    host?: string;
  };
  chrome?: {
    path?: string;
    flags?: string[];
  };
  extensions?: string[];
}

export interface ScriptEntry {
  path: string;
  label?: string;
  windowApi?: string;
  alias?: string;
  quickStart?: string;
}

export interface ProjectConfig {
  scripts?: {
    baseUrl?: string;
    registry?: Record<string, ScriptEntry>;
  };
  watch?: {
    paths?: string[];
    debounce?: number;
  };
  hooks?: {
    preBuild?: string;
    postInject?: string;
  };
  extensions?: string[];
}

export interface ResolvedConfig {
  port: number;
  profile: string;
  host: string;
  chromePath?: string;
  chromeFlags: string[];
  extensions: string[];
  scripts: {
    baseUrl?: string;
    registry: Record<string, ScriptEntry>;
  };
  watch: {
    paths: string[];
    debounce: number;
  };
  hooks: {
    preBuild?: string;
    postInject?: string;
  };
}

export const DEFAULT_CHROME_FLAGS = [
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
];
