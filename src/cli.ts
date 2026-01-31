#!/usr/bin/env node

/**
 * Chrome Jig - CLI Entry Point
 */

import { parseArgs } from 'node:util';
import { loadConfig } from './config/loader.js';
import { createConnection } from './chrome/connection.js';
import { Repl } from './repl/repl.js';
import { launch } from './commands/launch.js';
import { status } from './commands/status.js';
import { listTabs, selectTab } from './commands/tabs.js';
import { inject } from './commands/inject.js';
import { evaluate, formatValue, formatJson } from './commands/eval.js';
import { installSkill, uninstallSkill } from './commands/install-skill.js';
import { interactiveInit, generateConfig, writeConfig } from './commands/init.js';

const USAGE = `
Chrome Jig - Browser debugging from the command line

Usage:
  cjig <command> [options]

Commands:
  launch              Launch Chrome with debugging enabled
  status              Check if Chrome is running
  tabs                List open tabs
  tab <pattern>       Select a tab by URL pattern or index
  open <url>          Open a new tab
  inject <name|url>   Inject a script
  eval <expression>   Evaluate JavaScript
  repl                Interactive REPL
  init                Generate project configuration
  config              Show resolved configuration
  env                 Print shell environment setup
  install-skill       Install as Claude skill
  uninstall-skill     Remove Claude skill
  help                Show this help

Options:
  --port <port>       Chrome debugging port (default: 9222)
  --host <host>       Chrome host (default: localhost)
  --profile <name>    Chrome profile name (default: default)
  --json              Output as JSON (eval command)
  --help, -h          Show help

Examples:
  cjig launch
  cjig tabs
  cjig eval "document.title"
  cjig repl --port 9223
`;

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      port: { type: 'string', short: 'p' },
      host: { type: 'string', short: 'H' },
      profile: { type: 'string' },
      json: { type: 'boolean' },
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
        const connection = createConnection({ host: config.host, port: config.port });
        await connection.connect();

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

        await connection.disconnect();
        break;
      }

      case 'tab': {
        if (args.length === 0) {
          console.error('Usage: cjig tab <pattern|index>');
          process.exit(1);
        }

        const connection = createConnection({ host: config.host, port: config.port });
        await connection.connect();

        const tab = await selectTab(connection, args[0]);

        if (tab) {
          console.log(`Switched to: ${tab.title}`);
          console.log(`  ${tab.url}`);
        } else {
          console.error(`No tab matching: ${args[0]}`);
          process.exit(1);
        }

        await connection.disconnect();
        break;
      }

      case 'open': {
        if (args.length === 0) {
          console.error('Usage: cjig open <url>');
          process.exit(1);
        }

        const connection = createConnection({ host: config.host, port: config.port });
        await connection.connect();

        const page = await connection.openPage(args[0]);
        const title = await page.title();
        console.log(`Opened: ${title || args[0]}`);

        await connection.disconnect();
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

        const connection = createConnection({ host: config.host, port: config.port });
        await connection.connect();

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
          console.error(`✗ ${result.error}`);
          process.exit(1);
        }

        await connection.disconnect();
        break;
      }

      case 'eval': {
        if (args.length === 0) {
          console.error('Usage: cjig eval <expression>');
          process.exit(1);
        }

        const expression = args.join(' ');
        const connection = createConnection({ host: config.host, port: config.port });
        await connection.connect();

        const result = await evaluate(connection, expression);

        if (values.json) {
          console.log(formatJson(result));
        } else if (result.success) {
          console.log(formatValue(result.value));
        } else {
          console.error(`Error: ${result.error}`);
          process.exit(1);
        }

        await connection.disconnect();
        break;
      }

      case 'repl': {
        const connection = createConnection({ host: config.host, port: config.port });

        const running = await connection.isRunning();
        if (!running) {
          console.error(`Chrome not running on ${config.host}:${config.port}`);
          console.error('Run: cjig launch');
          process.exit(1);
        }

        await connection.connect();

        const repl = new Repl({ connection, config });
        await repl.start();

        await connection.disconnect();
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
