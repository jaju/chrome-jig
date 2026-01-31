/**
 * REPL dot commands
 */

import { ChromeConnection } from '../chrome/connection.js';
import { ResolvedConfig } from '../config/schema.js';
import { resolveScriptUrl, getScriptEntry } from '../config/loader.js';

export interface CommandContext {
  connection: ChromeConnection;
  config: ResolvedConfig;
  print: (msg: string) => void;
  setWatching: (enabled: boolean) => void;
  isWatching: () => boolean;
  runPreBuild: () => Promise<void>;
  exit: () => void;
}

export interface Command {
  name: string;
  aliases?: string[];
  description: string;
  usage?: string;
  execute: (args: string, ctx: CommandContext) => Promise<void>;
}

const commands: Command[] = [
  {
    name: 'help',
    aliases: ['h', '?'],
    description: 'Show available commands',
    async execute(_args, ctx) {
      ctx.print('\nAvailable commands:\n');
      for (const cmd of commands) {
        const aliases = cmd.aliases ? ` (${cmd.aliases.map(a => `.${a}`).join(', ')})` : '';
        const usage = cmd.usage ? ` ${cmd.usage}` : '';
        ctx.print(`  .${cmd.name}${usage}${aliases}`);
        ctx.print(`      ${cmd.description}\n`);
      }
      ctx.print('Any other input is evaluated as JavaScript in the browser.\n');
    },
  },

  {
    name: 'tabs',
    aliases: ['t', 'pages'],
    description: 'List open tabs',
    async execute(_args, ctx) {
      const pages = await ctx.connection.getPages();
      if (pages.length === 0) {
        ctx.print('No tabs open');
        return;
      }

      ctx.print('\nOpen tabs:\n');
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const current = page === ctx.connection.getCurrentPage() ? '→ ' : '  ';
        const title = await page.title() || '(no title)';
        const url = page.url();
        ctx.print(`${current}[${i}] ${title}`);
        ctx.print(`       ${url}\n`);
      }
    },
  },

  {
    name: 'tab',
    aliases: ['select'],
    description: 'Switch to tab by URL pattern or index',
    usage: '<pattern|index>',
    async execute(args, ctx) {
      if (!args.trim()) {
        ctx.print('Usage: .tab <url-pattern|index>');
        return;
      }

      const arg = args.trim();
      let page;

      // Try as index first
      const index = parseInt(arg, 10);
      if (!isNaN(index)) {
        page = await ctx.connection.selectPageByIndex(index);
      } else {
        page = await ctx.connection.selectPage(arg);
      }

      if (page) {
        const title = await page.title();
        ctx.print(`Switched to: ${title || page.url()}`);
      } else {
        ctx.print(`No tab matching: ${arg}`);
      }
    },
  },

  {
    name: 'open',
    aliases: ['o', 'goto'],
    description: 'Open a new tab with URL',
    usage: '<url>',
    async execute(args, ctx) {
      const url = args.trim();
      if (!url) {
        ctx.print('Usage: .open <url>');
        return;
      }

      try {
        const page = await ctx.connection.openPage(url);
        const title = await page.title();
        ctx.print(`Opened: ${title || url}`);
      } catch (err) {
        ctx.print(`Failed to open: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  },

  {
    name: 'inject',
    aliases: ['i', 'load'],
    description: 'Inject a script by name or URL',
    usage: '<name|url>',
    async execute(args, ctx) {
      const ref = args.trim();
      if (!ref) {
        // List available scripts
        const registry = ctx.config.scripts.registry;
        const entries = Object.entries(registry);

        if (entries.length === 0) {
          ctx.print('No scripts configured. Usage: .inject <url>');
          return;
        }

        ctx.print('\nAvailable scripts:\n');
        for (const [name, entry] of entries) {
          const alias = entry.alias ? ` (${entry.alias})` : '';
          const label = entry.label || name;
          ctx.print(`  ${name}${alias}: ${label}`);
          if (entry.quickStart) {
            ctx.print(`      Quick start: ${entry.quickStart}`);
          }
          ctx.print('');
        }
        return;
      }

      const url = resolveScriptUrl(ref, ctx.config);
      if (!url) {
        ctx.print(`Script not found: ${ref}`);
        ctx.print('Use a full URL or configure scripts in .cjig.json');
        return;
      }

      try {
        await ctx.connection.injectScript(url);
        ctx.print(`Injected: ${url}`);

        // Show quickStart hint if available
        const entry = getScriptEntry(ref, ctx.config);
        if (entry?.quickStart) {
          ctx.print(`Try: ${entry.quickStart}`);
        }
        if (entry?.windowApi) {
          ctx.print(`API available as: window.${entry.windowApi}`);
        }
      } catch (err) {
        ctx.print(`Failed to inject: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  },

  {
    name: 'reload',
    aliases: ['r'],
    description: 'Reload the current tab',
    async execute(_args, ctx) {
      try {
        await ctx.connection.reload();
        ctx.print('Reloaded');
      } catch (err) {
        ctx.print(`Failed to reload: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  },

  {
    name: 'watch',
    aliases: ['w'],
    description: 'Toggle or set file watching',
    usage: '[on|off]',
    async execute(args, ctx) {
      const arg = args.trim().toLowerCase();

      if (arg === 'on') {
        ctx.setWatching(true);
        ctx.print('File watching enabled');
      } else if (arg === 'off') {
        ctx.setWatching(false);
        ctx.print('File watching disabled');
      } else {
        // Toggle
        const newState = !ctx.isWatching();
        ctx.setWatching(newState);
        ctx.print(`File watching ${newState ? 'enabled' : 'disabled'}`);
      }

      if (ctx.isWatching() && ctx.config.watch.paths.length === 0) {
        ctx.print('Warning: No watch paths configured in .cjig.json');
      }
    },
  },

  {
    name: 'build',
    aliases: ['b'],
    description: 'Run the preBuild hook',
    async execute(_args, ctx) {
      if (!ctx.config.hooks.preBuild) {
        ctx.print('No preBuild hook configured');
        return;
      }

      ctx.print(`Running: ${ctx.config.hooks.preBuild}`);
      await ctx.runPreBuild();
    },
  },

  {
    name: 'config',
    aliases: ['cfg'],
    description: 'Show current configuration',
    async execute(_args, ctx) {
      ctx.print('\nCurrent configuration:\n');
      ctx.print(`  Host: ${ctx.config.host}`);
      ctx.print(`  Port: ${ctx.config.port}`);
      ctx.print(`  Profile: ${ctx.config.profile}`);
      ctx.print(`  Chrome: ${ctx.config.chromePath || '(auto-detect)'}`);
      ctx.print(`  Scripts base: ${ctx.config.scripts.baseUrl || '(none)'}`);
      ctx.print(`  Watch paths: ${ctx.config.watch.paths.join(', ') || '(none)'}`);
      ctx.print(`  preBuild: ${ctx.config.hooks.preBuild || '(none)'}`);
      ctx.print('');
    },
  },

  {
    name: 'clear',
    aliases: ['cls'],
    description: 'Clear the console',
    async execute(_args, _ctx) {
      process.stdout.write('\x1Bc');
    },
  },

  {
    name: 'exit',
    aliases: ['quit', 'q'],
    description: 'Exit the REPL',
    async execute(_args, ctx) {
      ctx.exit();
    },
  },
];

/**
 * Find a command by name or alias
 */
export function findCommand(name: string): Command | null {
  const normalized = name.toLowerCase();

  for (const cmd of commands) {
    if (cmd.name === normalized) return cmd;
    if (cmd.aliases?.includes(normalized)) return cmd;
  }

  return null;
}

/**
 * Get all command names and aliases for completion
 */
export function getCommandCompletions(): string[] {
  const completions: string[] = [];

  for (const cmd of commands) {
    completions.push(`.${cmd.name}`);
    if (cmd.aliases) {
      for (const alias of cmd.aliases) {
        completions.push(`.${alias}`);
      }
    }
  }

  return completions;
}

export { commands };
