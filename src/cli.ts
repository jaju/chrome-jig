#!/usr/bin/env node

/**
 * Chrome Jig - CLI Entry Point
 */

import { parseArgs } from 'node:util';
import { loadConfig } from './config/loader.js';
import { ChromeConnection, createConnection } from './chrome/connection.js';
import { connectWithResilience } from './chrome/resilience.js';
import { ResolvedConfig } from './config/schema.js';
import { CjigError, ConnectionError } from './errors.js';
import { Repl } from './repl/repl.js';
import { launch } from './commands/launch.js';
import { status } from './commands/status.js';
import { listTabs, selectTab } from './commands/tabs.js';
import { inject } from './commands/inject.js';
import { evaluate, formatValue, formatJson } from './commands/eval.js';
import { evaluateFile } from './commands/eval-file.js';
import { evaluateCljs } from './commands/cljs-eval.js';
import { installSkill, uninstallSkill } from './commands/install-skill.js';
import { installNvim, uninstallNvim, printSetupSnippets } from './commands/install-nvim.js';
import { interactiveInit, generateConfig, writeConfig } from './commands/init.js';
import { serve } from './commands/serve.js';
import { nrepl } from './commands/nrepl.js';
import { attach } from './commands/attach.js';
import { getConnectionInfo } from './commands/connection-info.js';
import { listProfilesCommand, createProfileCommand } from './commands/profiles.js';

const USAGE = `
Chrome Jig - Browser debugging from the command line

Usage:
  cjig <command> [options]

Commands:
  launch              Launch Chrome with debugging enabled
  attach              Attach to an already-running Chrome
  status              Check if Chrome is running
  connection-info     Export connection info as JSON (for Playwright handoff)
  tabs                List open tabs
  tab <pattern>       Select a tab by URL/title pattern or index
  open <url>          Open a new tab
  inject <name|url>   Inject a script
  eval <expression>   Evaluate JavaScript
  eval-file <path|->  Evaluate a JavaScript file (- for stdin)
  cljs-eval <code>    Evaluate ClojureScript
  repl                Interactive REPL (JavaScript)
  cljs-repl           Interactive REPL (ClojureScript)
  serve --stdio       JSON-RPC 2.0 server over stdio
  nrepl               nREPL server + interactive REPL
  profiles list       List known profiles
  profiles create     Create a named profile
  init                Generate project configuration
  config              Show resolved configuration
  env                 Print shell environment setup
  install-skill       Install as Claude skill
  uninstall-skill     Remove Claude skill
  install-nvim        Install Neovim plugin (stable symlink)
  uninstall-nvim      Remove Neovim plugin
  help                Show this help

Options:
  --port <port>       Chrome debugging port (default: 9222)
  --host <host>       Chrome host (default: localhost)
  --profile <name>    Chrome profile name (default: default)
  --extensions <list> Comma-separated extension paths (launch)
  --tab <selector>    Select tab before executing (eval, eval-file, inject, cljs-eval)
  --json              Output as JSON (eval/cljs-eval/connection-info)
  --timeout <ms>      Navigation timeout in ms (open)
  --wait-until <s>    Navigation strategy: domcontentloaded|load|networkidle (open)
  --no-wait           Fire-and-forget navigation (open)
  --retries <n>       Connection retry count (default: 3)
  --retry-delay <ms>  Initial retry delay in ms (default: 500)
  --help, -h          Show help

Tab selector:
  Numbers select by index (0, 1, 2...), strings search URL and title.

Examples:
  cjig launch
  cjig launch --extensions /path/to/ext
  cjig attach --port 9333
  cjig connection-info
  cjig tabs
  cjig eval "document.title"
  cjig eval --tab "GitHub" "document.title"
  cjig eval-file bundle.js
  cjig profiles list
  cjig repl --port 9223
`;

// --- Connection lifecycle helper ---

interface RunOptions {
  config: ResolvedConfig;
  tab?: string;
  requireRunning?: boolean;
  retries?: number;
  retryDelayMs?: number;
}

async function withConnection<T>(
  options: RunOptions,
  work: (connection: ChromeConnection) => Promise<T>,
): Promise<T> {
  const { config } = options;

  if (options.requireRunning) {
    const probe = createConnection({ host: config.host, port: config.port });
    const running = await probe.isRunning();
    if (!running) {
      throw new ConnectionError(
        `Chrome not running on ${config.host}:${config.port}\nRun: cjig launch`,
        config.host,
        config.port,
      );
    }
  }

  const connection = await connectWithResilience({
    host: config.host,
    port: config.port,
    retries: options.retries ?? config.connection.retries,
    retryDelayMs: options.retryDelayMs ?? config.connection.retryDelayMs,
    fallbackHosts: config.connection.fallbackHosts,
  });

  try {
    if (options.tab) {
      const tab = await selectTab(connection, options.tab);
      if (!tab) throw new Error(`No tab matching: ${options.tab}`);
    }
    return await work(connection);
  } finally {
    await connection.disconnect();
  }
}

// --- Main ---

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      port: { type: 'string', short: 'p' },
      host: { type: 'string', short: 'H' },
      profile: { type: 'string' },
      extensions: { type: 'string', short: 'e' },
      tab: { type: 'string', short: 't' },
      json: { type: 'boolean' },
      stdio: { type: 'boolean' },
      url: { type: 'string' },
      'nrepl-port': { type: 'string' },
      timeout: { type: 'string' },
      'wait-until': { type: 'string' },
      'no-wait': { type: 'boolean' },
      retries: { type: 'string' },
      'retry-delay': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help || positionals.length === 0) {
    console.log(USAGE);
    process.exit(0);
  }

  const command = positionals[0];
  const args = positionals.slice(1);

  // Parse CLI extensions (comma-separated)
  const cliExtensions = values.extensions
    ? values.extensions.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined;

  // Parse connection overrides from CLI
  const cliRetries = values.retries ? parseInt(values.retries, 10) : undefined;
  const cliRetryDelay = values['retry-delay'] ? parseInt(values['retry-delay'], 10) : undefined;
  const cliTimeout = values.timeout ? parseInt(values.timeout, 10) : undefined;
  const cliWaitUntil = values['wait-until'] as 'load' | 'domcontentloaded' | 'networkidle' | undefined;

  // Load configuration
  const config = loadConfig({
    port: values.port ? parseInt(values.port, 10) : undefined,
    host: values.host,
    profile: values.profile,
    extensions: cliExtensions,
    connection: {
      retries: cliRetries,
      retryDelayMs: cliRetryDelay,
      timeout: cliTimeout,
      waitUntil: cliWaitUntil,
    },
  });

  try {
    switch (command) {
      case 'launch': {
        const result = await launch(config, {
          profile: values.profile,
          extensions: cliExtensions,
          url: args[0],
        });

        if (result.success) {
          console.log(`✓ ${result.message}`);
          console.log(`  PID: ${result.pid}`);
        } else {
          console.error(`✗ ${result.message}`);
          process.exit(1);
        }
        break;
      }

      case 'attach': {
        const result = await attach(config.host, config.port);

        if (result.success) {
          console.log(`✓ ${result.message}`);
          if (result.browser) console.log(`  Browser: ${result.browser}`);
          if (result.tabCount !== undefined) console.log(`  Tabs: ${result.tabCount}`);
        } else {
          console.error(`✗ ${result.message}`);
          process.exit(1);
        }
        break;
      }

      case 'connection-info': {
        const result = await getConnectionInfo(config.host, config.port);

        if (result.success && result.info) {
          if (values.json) {
            console.log(JSON.stringify(result.info, null, 2));
          } else {
            console.log('\nConnection info:\n');
            console.log(`  Endpoint: ${result.info.endpoint}`);
            console.log(`  WebSocket: ${result.info.webSocketDebuggerUrl}`);
            console.log(`  Source: ${result.info.source}`);
            if (result.info.profile) {
              console.log(`  Profile: ${result.info.profile}`);
            }
            console.log('');
          }
        } else {
          console.error(`✗ ${result.message}`);
          process.exit(1);
        }
        break;
      }

      case 'status': {
        const result = await status(config);

        if (result.running) {
          console.log('✓ Chrome is running');
          console.log(`  Browser: ${result.browser || 'unknown'}`);
          console.log(`  Host: ${result.host}:${result.port}`);
          console.log(`  Profile: ${result.profile || 'unknown'}`);
          if (result.webSocketUrl) {
            console.log(`  WebSocket: ${result.webSocketUrl}`);
          }
        } else {
          console.log(`✗ Chrome not running on ${result.host}:${result.port}`);
          if (result.profile) {
            console.log(`  Last used profile: ${result.profile}`);
          }
          process.exit(1);
        }
        break;
      }

      case 'tabs': {
        await withConnection({ config }, async (connection) => {
          const tabs = await listTabs(connection);

          if (tabs.length === 0) {
            console.log('No tabs open');
          } else {
            console.log('\nOpen tabs:\n');
            for (const tab of tabs) {
              const marker = tab.isCurrent ? '→' : ' ';
              console.log(`${marker} [${tab.index}] ${tab.title}`);
              console.log(`      ${tab.url}\n`);
            }
          }
        });
        break;
      }

      case 'tab': {
        if (args.length === 0) {
          console.error('Usage: cjig tab <pattern|index>');
          process.exit(1);
        }

        await withConnection({ config }, async (connection) => {
          const tab = await selectTab(connection, args[0]);

          if (tab) {
            console.log(`Switched to: ${tab.title}`);
            console.log(`  ${tab.url}`);
          } else {
            throw new Error(`No tab matching: ${args[0]}`);
          }
        });
        break;
      }

      case 'open': {
        if (args.length === 0) {
          console.error('Usage: cjig open <url>');
          process.exit(1);
        }

        await withConnection({ config }, async (connection) => {
          const page = await connection.openPage(args[0], {
            timeout: cliTimeout ?? config.connection.timeout,
            waitUntil: cliWaitUntil ?? config.connection.waitUntil,
            noWait: values['no-wait'],
          });
          if (values['no-wait']) {
            console.log(`Opening: ${args[0]}`);
          } else {
            const title = await page.title();
            console.log(`Opened: ${title || args[0]}`);
          }
        });
        break;
      }

      case 'inject': {
        if (args.length === 0) {
          console.error('Usage: cjig inject <name|url>');
          console.log('\nConfigured scripts:');
          for (const [name, entry] of Object.entries(config.scripts.registry)) {
            const alias = entry.alias ? ` (${entry.alias})` : '';
            console.log(`  ${name}${alias}: ${entry.label || entry.path}`);
          }
          process.exit(1);
        }

        await withConnection({ config, tab: values.tab }, async (connection) => {
          const result = await inject(connection, config, args[0]);

          if (result.success) {
            console.log(`✓ Injected: ${result.url}`);
            if (result.windowApi) {
              console.log(`  API: window.${result.windowApi}`);
            }
            if (result.quickStart) {
              console.log(`  Try: ${result.quickStart}`);
            }
          } else {
            throw new Error(result.error ?? 'Injection failed');
          }
        });
        break;
      }

      case 'eval': {
        if (args.length === 0) {
          console.error('Usage: cjig eval <expression>');
          process.exit(1);
        }

        const expression = args.join(' ');
        await withConnection({ config, tab: values.tab }, async (connection) => {
          const result = await evaluate(connection, expression);

          if (values.json) {
            console.log(formatJson(result));
          } else if (result.success) {
            console.log(formatValue(result.value));
          } else {
            throw new Error(result.error);
          }
        });
        break;
      }

      case 'eval-file': {
        if (args.length === 0) {
          console.error('Usage: cjig eval-file <path|->');
          process.exit(1);
        }

        await withConnection({ config, tab: values.tab }, async (connection) => {
          const result = await evaluateFile(connection, args[0]);

          if (values.json) {
            console.log(formatJson(result));
          } else if (result.success) {
            console.log(formatValue(result.value));
          } else {
            throw new Error(result.error);
          }
        });
        break;
      }

      case 'cljs-eval': {
        if (args.length === 0) {
          console.error('Usage: cjig cljs-eval <code>');
          process.exit(1);
        }

        const cljsSource = args.join(' ');
        await withConnection({ config, tab: values.tab }, async (connection) => {
          const result = await evaluateCljs(connection, cljsSource);

          if (values.json) {
            console.log(formatJson(result));
          } else if (result.success) {
            console.log(formatValue(result.value));
          } else {
            throw new Error(result.error);
          }
        });
        break;
      }

      case 'repl': {
        await withConnection({ config, requireRunning: true }, async (connection) => {
          const repl = new Repl({ connection, config });
          await repl.start();
        });
        break;
      }

      case 'cljs-repl': {
        await withConnection({ config, requireRunning: true }, async (connection) => {
          const repl = new Repl({ connection, config, lang: 'cljs' });
          await repl.start();
        });
        break;
      }

      case 'serve': {
        if (!values.stdio) {
          console.error('Usage: cjig serve --stdio');
          console.error('  Currently only --stdio transport is supported.');
          process.exit(1);
        }

        await withConnection({ config, requireRunning: true }, async (connection) => {
          await serve({ connection, config });
        });
        break;
      }

      case 'nrepl': {
        await withConnection({ config, requireRunning: true }, async (connection) => {
          const nreplPort = values['nrepl-port'] ? parseInt(values['nrepl-port'], 10) : undefined;
          await nrepl({ connection, config, port: nreplPort });
        });
        break;
      }

      case 'config': {
        console.log('\nResolved configuration:\n');
        console.log(`  Host: ${config.host}`);
        console.log(`  Port: ${config.port}`);
        console.log(`  Profile: ${config.profile}`);
        console.log(`  Chrome: ${config.chromePath || '(auto-detect)'}`);
        console.log(`  Scripts base: ${config.scripts.baseUrl || '(none)'}`);
        if (config.extensions.length > 0) {
          console.log(`  Extensions: ${config.extensions.join(', ')}`);
        }

        const scriptCount = Object.keys(config.scripts.registry).length;
        console.log(`  Scripts: ${scriptCount} registered`);

        if (config.watch.paths.length > 0) {
          console.log(`  Watch: ${config.watch.paths.join(', ')}`);
        }
        if (config.hooks.preBuild) {
          console.log(`  preBuild: ${config.hooks.preBuild}`);
        }
        console.log('');
        break;
      }

      case 'env': {
        console.log('# Chrome Jig - Shell Configuration');
        console.log('# Add to ~/.zshrc or ~/.bashrc:\n');
        console.log(`export CJIG_PORT=${config.port}`);
        console.log(`export CJIG_PROFILE=${config.profile}`);
        if (config.host !== 'localhost') {
          console.log(`export CJIG_HOST=${config.host}`);
        }
        console.log('\n# Optional aliases:');
        console.log("alias cjr='cjig repl'");
        console.log("alias cjl='cjig launch'");
        console.log("alias cjt='cjig tabs'");
        break;
      }

      case 'init': {
        if (args.includes('--from') || args.some(a => a.startsWith('--from='))) {
          // Non-interactive with --from flag
          const fromArg = args.find(a => a.startsWith('--from='));
          const fromFile = fromArg ? fromArg.split('=')[1] : args[args.indexOf('--from') + 1];
          const baseUrl = args.find(a => a.startsWith('--base-url='))?.split('=')[1];

          const projectConfig = generateConfig({ fromFile, baseUrl });
          const result = writeConfig(projectConfig);

          if (result.success) {
            console.log(`✓ ${result.message}: ${result.configPath}`);
          } else {
            console.error(`✗ ${result.message}`);
            process.exit(1);
          }
        } else {
          // Interactive mode
          const result = await interactiveInit();
          if (!result.success) {
            process.exit(1);
          }
        }
        break;
      }

      case 'install-skill': {
        const result = installSkill();
        if (result.success) {
          console.log(`✓ ${result.message}`);
          if (result.path) {
            console.log(`  ${result.path}`);
          }
        } else {
          console.error(`✗ ${result.message}`);
          process.exit(1);
        }
        break;
      }

      case 'uninstall-skill': {
        const result = uninstallSkill();
        if (result.success) {
          console.log(`✓ ${result.message}`);
        } else {
          console.error(`✗ ${result.message}`);
          process.exit(1);
        }
        break;
      }

      case 'install-nvim': {
        const nvimResult = installNvim();
        if (nvimResult.success) {
          console.log(`✓ ${nvimResult.message}`);
          console.log(`  ${nvimResult.symlinkPath} → ${nvimResult.sourcePath}`);
          printSetupSnippets(nvimResult.symlinkPath!);
        } else {
          console.error(`✗ ${nvimResult.message}`);
          process.exit(1);
        }
        break;
      }

      case 'uninstall-nvim': {
        const nvimResult = uninstallNvim();
        if (nvimResult.success) {
          console.log(`✓ ${nvimResult.message}`);
          if (nvimResult.symlinkPath) {
            console.log(`  Removed: ${nvimResult.symlinkPath}`);
          }
        } else {
          console.error(`✗ ${nvimResult.message}`);
          process.exit(1);
        }
        break;
      }

      case 'profiles': {
        const subcommand = args[0];

        if (!subcommand || subcommand === 'list') {
          const result = listProfilesCommand();
          if (result.profiles.length === 0) {
            console.log('No profiles found');
          } else {
            console.log('\nProfiles:\n');
            for (const p of result.profiles) {
              const markers: string[] = [];
              if (p.hasConfig) markers.push('config');
              if (p.hasData) markers.push('data');
              const suffix = markers.length > 0 ? ` (${markers.join(', ')})` : '';
              console.log(`  ${p.name}${suffix}`);
              if (p.extensions?.length) {
                console.log(`    extensions: ${p.extensions.join(', ')}`);
              }
            }
            console.log('');
          }
        } else if (subcommand === 'create') {
          const name = args[1];
          if (!name) {
            console.error('Usage: cjig profiles create <name> [--extensions ...]');
            process.exit(1);
          }
          const result = createProfileCommand(name, {
            extensions: cliExtensions,
            url: values.url,
          });
          if (result.success) {
            console.log(`✓ ${result.message}`);
          } else {
            console.error(`✗ ${result.message}`);
            process.exit(1);
          }
        } else {
          console.error(`Unknown profiles subcommand: ${subcommand}`);
          console.error('Usage: cjig profiles [list|create]');
          process.exit(1);
        }
        break;
      }

      case 'help':
        console.log(USAGE);
        break;

      default:
        console.error(`Unknown command: ${command}`);
        console.log('Run: cjig help');
        process.exit(1);
    }
  } catch (err) {
    if (err instanceof CjigError) {
      if (values.json) {
        console.error(JSON.stringify(err.toJSON()));
      } else {
        console.error(`Error [${err.category}]: ${err.message}`);
      }
      process.exit(err.exitCode);
    } else if (err instanceof Error) {
      if (values.json) {
        console.error(JSON.stringify({ error: err.message }));
      } else {
        console.error(`Error: ${err.message}`);
      }
      process.exit(1);
    } else {
      console.error(`Error: ${err}`);
      process.exit(1);
    }
  }
}

main();
