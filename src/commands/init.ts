/**
 * Init command - generate project configuration
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as readline from 'node:readline';
import { ProjectConfig, ScriptEntry } from '../config/schema.js';

export interface InitOptions {
  interactive?: boolean;
  fromFile?: string;
  port?: number;
  profile?: string;
  baseUrl?: string;
}

export interface InitResult {
  success: boolean;
  message: string;
  configPath?: string;
}

/**
 * Adapter for KlipCeeper harness-registry.json format
 */
interface HarnessRegistryEntry {
  bundlePath: string;
  iifePath: string;
  label?: string;
  namespace?: string;
  quickStart?: string;
}

function adaptHarnessRegistry(
  registryPath: string,
  _baseUrl: string
): Record<string, ScriptEntry> {
  const content = readFileSync(registryPath, 'utf-8');
  const registry = JSON.parse(content) as Record<string, HarnessRegistryEntry>;

  const adapted: Record<string, ScriptEntry> = {};

  for (const [name, entry] of Object.entries(registry)) {
    // Use iifePath for injection (already bundled)
    const path = entry.iifePath.replace(/^.*\/harnesses\//, '');

    adapted[name] = {
      path,
      label: entry.label,
      windowApi: entry.namespace,
      quickStart: entry.quickStart,
    };
  }

  return adapted;
}

export function generateConfig(options: InitOptions): ProjectConfig {
  const config: ProjectConfig = {
    scripts: {
      baseUrl: options.baseUrl,
      registry: {},
    },
    watch: {
      paths: [],
      debounce: 300,
    },
    hooks: {},
  };

  // Try to adapt from harness registry
  if (options.fromFile && existsSync(options.fromFile)) {
    try {
      const adapted = adaptHarnessRegistry(
        options.fromFile,
        options.baseUrl || ''
      );
      config.scripts!.registry = adapted;
    } catch (err) {
      console.error(`Failed to parse ${options.fromFile}: ${err}`);
    }
  }

  return config;
}

export function writeConfig(
  config: ProjectConfig,
  dir: string = process.cwd()
): InitResult {
  const configPath = join(dir, '.chrome-debug.json');

  if (existsSync(configPath)) {
    return {
      success: false,
      message: `Config already exists: ${configPath}`,
      configPath,
    };
  }

  try {
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
    return {
      success: true,
      message: 'Configuration created',
      configPath,
    };
  } catch (err) {
    return {
      success: false,
      message: `Failed to write config: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Interactive init prompts
 */
export async function interactiveInit(cwd: string = process.cwd()): Promise<InitResult> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise((resolve) => rl.question(prompt, resolve));

  console.log('\nChrome Debug REPL - Project Setup\n');

  try {
    // Check for existing config
    const existingPath = join(cwd, '.chrome-debug.json');
    if (existsSync(existingPath)) {
      console.log(`Config already exists: ${existingPath}`);
      rl.close();
      return { success: false, message: 'Config already exists', configPath: existingPath };
    }

    // Port
    const portStr = await question('Port for Chrome debugging? (9222) ');
    const port = portStr ? parseInt(portStr, 10) : 9222;

    // Profile
    const profile = (await question('Profile name? (default) ')) || 'default';

    // Look for harness registries
    const possibleRegistries = [
      'configs/harness-registry.json',
      'harness-registry.json',
      'dev-tools/harness-registry.json',
    ];

    let fromFile: string | undefined;
    for (const path of possibleRegistries) {
      const fullPath = join(cwd, path);
      if (existsSync(fullPath)) {
        const answer = await question(`Found ${path}. Import scripts from it? (Y/n) `);
        if (answer.toLowerCase() !== 'n') {
          fromFile = fullPath;
        }
        break;
      }
    }

    // Base URL
    const baseUrl = (await question('Dev server base URL? (http://localhost:5173) ')) ||
      'http://localhost:5173';

    // Watch paths
    const watchPathsStr = await question('Watch paths for auto-reinject? (dev-build/harnesses/*.js) ');
    const watchPaths = watchPathsStr
      ? watchPathsStr.split(',').map((p) => p.trim())
      : ['dev-build/harnesses/*.js'];

    // Generate config
    const config = generateConfig({
      port,
      profile,
      baseUrl,
      fromFile,
    });

    config.watch = {
      paths: watchPaths,
      debounce: 300,
    };

    // Write config
    const result = writeConfig(config, cwd);

    if (result.success) {
      console.log(`\n✓ Generated: ${result.configPath}`);
      console.log('\nShell environment (add to ~/.zshrc):');
      console.log(`  export CHROME_DEBUG_PORT=${port}`);
      console.log(`  export CHROME_DEBUG_PROFILE=${profile}`);
    }

    rl.close();
    return result;
  } catch (err) {
    rl.close();
    return {
      success: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
