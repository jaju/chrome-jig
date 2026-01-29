/**
 * Interactive REPL engine
 */

import * as readline from 'node:readline';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { watch, FSWatcher } from 'chokidar';
import { ChromeConnection } from '../chrome/connection.js';
import { ResolvedConfig } from '../config/schema.js';
import { findCommand, CommandContext } from './commands.js';
import { createCompleter } from './completer.js';
import { resolveScriptUrl } from '../config/loader.js';

const execAsync = promisify(exec);

export interface ReplOptions {
  connection: ChromeConnection;
  config: ResolvedConfig;
}

export class Repl {
  private rl: readline.Interface | null = null;
  private watcher: FSWatcher | null = null;
  private watching = false;
  private running = false;
  private lastInjectRef: string | null = null;

  constructor(private options: ReplOptions) {}

  private get connection(): ChromeConnection {
    return this.options.connection;
  }

  private get config(): ResolvedConfig {
    return this.options.config;
  }

  private print(msg: string): void {
    console.log(msg);
  }

  private createCommandContext(): CommandContext {
    return {
      connection: this.connection,
      config: this.config,
      print: this.print.bind(this),
      setWatching: this.setWatching.bind(this),
      isWatching: () => this.watching,
      runPreBuild: this.runPreBuild.bind(this),
      exit: () => {
        this.running = false;
        this.rl?.close();
      },
    };
  }

  private async runPreBuild(): Promise<void> {
    const cmd = this.config.hooks.preBuild;
    if (!cmd) return;

    try {
      const { stdout, stderr } = await execAsync(cmd);
      if (stdout) this.print(stdout.trim());
      if (stderr) this.print(stderr.trim());
    } catch (err) {
      this.print(`Build failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private setWatching(enabled: boolean): void {
    this.watching = enabled;

    if (enabled && !this.watcher && this.config.watch.paths.length > 0) {
      this.startWatcher();
    } else if (!enabled && this.watcher) {
      this.stopWatcher();
    }
  }

  private startWatcher(): void {
    if (this.watcher) return;

    const paths = this.config.watch.paths;
    if (paths.length === 0) return;

    this.watcher = watch(paths, {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: this.config.watch.debounce,
        pollInterval: 100,
      },
    });

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    this.watcher.on('change', (path) => {
      if (!this.watching) return;

      // Debounce rapid changes
      if (debounceTimer) clearTimeout(debounceTimer);

      debounceTimer = setTimeout(async () => {
        this.print(`\n[watch] File changed: ${path}`);
        await this.handleFileChange(path);
        this.rl?.prompt(true);
      }, this.config.watch.debounce);
    });

    this.print(`Watching: ${paths.join(', ')}`);
  }

  private stopWatcher(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  private async handleFileChange(path: string): Promise<void> {
    // Re-inject the last injected script if it matches
    if (this.lastInjectRef) {
      const url = resolveScriptUrl(this.lastInjectRef, this.config);
      if (url && path.includes(this.lastInjectRef)) {
        try {
          await this.connection.injectScript(url);
          this.print(`[watch] Re-injected: ${this.lastInjectRef}`);
        } catch (err) {
          this.print(`[watch] Re-inject failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
  }

  private async evaluateJs(expression: string): Promise<void> {
    try {
      const result = await this.connection.evaluate(expression);
      if (result !== undefined) {
        const formatted = formatResult(result);
        this.print(formatted);
      }
    } catch (err) {
      if (err instanceof Error) {
        this.print(`Error: ${err.message}`);
      } else {
        this.print(`Error: ${String(err)}`);
      }
    }
  }

  private async handleLine(line: string): Promise<void> {
    const trimmed = line.trim();

    if (!trimmed) return;

    // Check for dot commands
    if (trimmed.startsWith('.')) {
      const spaceIndex = trimmed.indexOf(' ');
      const cmdName = spaceIndex > 0 ? trimmed.slice(1, spaceIndex) : trimmed.slice(1);
      const args = spaceIndex > 0 ? trimmed.slice(spaceIndex + 1) : '';

      const command = findCommand(cmdName);

      if (command) {
        // Track inject commands for file watching
        if (command.name === 'inject' && args.trim()) {
          this.lastInjectRef = args.trim();
        }

        await command.execute(args, this.createCommandContext());
      } else {
        this.print(`Unknown command: .${cmdName}`);
        this.print('Type .help for available commands');
      }

      return;
    }

    // Evaluate as JavaScript
    await this.evaluateJs(trimmed);
  }

  async start(): Promise<void> {
    this.running = true;

    // Verify connection
    const page = this.connection.getCurrentPage();
    if (!page) {
      this.print('Warning: No page selected. Use .tabs to list pages and .tab to select one.');
    } else {
      const title = await page.title();
      this.print(`Connected to: ${title || page.url()}`);
    }

    this.print('Type .help for commands, .exit to quit\n');

    const completer = createCompleter(this.config);

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> ',
      completer,
    });

    this.rl.prompt();

    this.rl.on('line', async (line) => {
      await this.handleLine(line);
      if (this.running) {
        this.rl?.prompt();
      }
    });

    this.rl.on('close', () => {
      this.running = false;
      this.stopWatcher();
      this.print('\nGoodbye!');
    });

    // Handle Ctrl+C gracefully
    this.rl.on('SIGINT', () => {
      this.print('\n(Use .exit or Ctrl+D to quit)');
      this.rl?.prompt();
    });

    // Keep the process alive
    return new Promise((resolve) => {
      this.rl?.on('close', resolve);
    });
  }
}

/**
 * Format a JavaScript result for display
 */
function formatResult(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  if (typeof value === 'string') {
    return `"${value}"`;
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  return String(value);
}
