/**
 * Environment variable helpers
 */

export interface EnvConfig {
  port: number;
  profile: string;
  host: string;
  configPath?: string;
  scriptsBase?: string;
  chromePath?: string;
}

const ENV_PREFIX = 'CJIG_';

export function getEnvConfig(): Partial<EnvConfig> {
  return {
    port: parsePort(process.env[`${ENV_PREFIX}PORT`]),
    profile: process.env[`${ENV_PREFIX}PROFILE`],
    host: process.env[`${ENV_PREFIX}HOST`],
    configPath: process.env[`${ENV_PREFIX}CONFIG`],
    scriptsBase: process.env[`${ENV_PREFIX}SCRIPTS_BASE`],
    chromePath: process.env['CHROME_PATH'],
  };
}

function parsePort(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const port = parseInt(value, 10);
  return isNaN(port) ? undefined : port;
}

export const defaults = {
  port: 9222,
  profile: 'default',
  host: 'localhost',
} as const;

export function resolveConfig(overrides: Partial<EnvConfig> = {}): EnvConfig {
  const env = getEnvConfig();
  return {
    port: overrides.port ?? env.port ?? defaults.port,
    profile: overrides.profile ?? env.profile ?? defaults.profile,
    host: overrides.host ?? env.host ?? defaults.host,
    configPath: overrides.configPath ?? env.configPath,
    scriptsBase: overrides.scriptsBase ?? env.scriptsBase,
    chromePath: overrides.chromePath ?? env.chromePath,
  };
}
