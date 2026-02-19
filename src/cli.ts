#!/usr/bin/env node

/**
 * Chrome Jig - CLI Entry Point
 */

import { parseArgs } from 'node:util';
import { loadConfig } from './config/loader.js';
import { ChromeConnection, createConnection } from './chrome/connection.js';
import { ResolvedConfig } from './config/schema.js';
import { Repl } from './repl/repl.js';
import { launch } from './commands/launch.js';
import { status } from './commands/status.js';
import { listTabs, selectTab } from './commands/tabs.js';
import { inject } from './commands/inject.js';
import { evaluate, formatValue, formatJson } from './commands/eval.js';
import { evaluateCljs } from './commands/cljs-eval.js';
import { installSkill, uninstallSkill } from './commands/install-skill.js';
import { installNvim, uninstallNvim, printSetupSnippets } from './commands/install-nvim.js';
import { interactiveInit, generateConfig, writeConfig } from './commands/init.js';
import { serve } from './commands/serve.js';
import { nrepl } from './commands/nrepl.js';

const USAGE = `
Chrome Jig - Browser debugging from the command line

Usage:
  cjig <command> [options]

Commands:
  launch              Launch Chrome with debugging enabled
  status              Check if Chrome is running
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
  --tab <selector>    Select tab before executing (eval, eval-file, inject, cljs-eval)
  --json              Output as JSON (eval/cljs-eval)
  --help, -h          Show help

Tab selector:
  Numbers select by index (0, 1, 2...), strings search URL and title.

Examples:
  cjig launch
  cjig tabs
  cjig eval "document.title"
  cjig eval --tab "GitHub" "document.title"
  cjig eval-file bundle.js
  cjig repl --port 9223
`;

// --- Connection lifecycle helper ---

interface RunOptions {
  config: ResolvedConfig;
  tab?: string;
  requireRunning?: boolean;
}

async function withConnection<T>(
  options: RunOptions,
  work: (connection: ChromeConnection) => Promise<T>,
): Promise<T> {
  const { config } = options;
  const connection = createConnection({ host: config.host, port: config.port });

  if (options.requireRunning) {
    const running = await connection.isRunning();
    if (!running) {
      throw new Error(
        `Chrome not running on ${config.host}:${config.port}\nRun: cjig launch`,
      );
    }
  }

  await connection.connect();
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
      tab: { type: 'string', short: 't' },
      json: { type: 'boolean' },
      stdio: { type: 'boolean' },
      'nrepl-port': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help || positionals.length === 0) {
    console.log(USAGE);
    process.exit(0);
  }

  const command = positionals[0];
  const args = positionals.slice(1);

  // Load configuration
  const config = loadConfig({
    port: values.port ? parseInt(values.port, 10) : undefined,
    host: values.host,
    profile: values.profile,
  });

  try {
    switch (command) {
      case 'launch': {
        const result = await launch(config, {
          profile: values.profile,
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
          const page = await connection.openPage(args[0]);
          const title = await page.title();
          console.log(`Opened: ${title || args[0]}`);
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

      case 'help':
        console.log(USAGE);
        break;

      default:
        console.error(`Unknown command: ${command}`);
        console.log('Run: cjig help');
        process.exit(1);
    }
  } catch (err) {
    if (err instanceof Error) {
      console.error(`Error: ${err.message}`);
    } else {
      console.error(`Error: ${err}`);
    }
    process.exit(1);
  }
}

main();
