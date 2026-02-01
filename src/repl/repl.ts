/**
 * Interactive REPL — thin shell over the shared Session core.
 *
 * Owns REPL-specific concerns: file watching, preBuild hooks,
 * SIGINT handling, and tab completion. Delegates method dispatch
 * to the Session.
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { watch, FSWatcher } from 'chokidar';
import { ChromeConnection } from '../chrome/connection.js';
import { ResolvedConfig } from '../config/schema.js';
import { createCompleter } from './completer.js';
import { resolveScriptUrl } from '../config/loader.js';
import { Session } from '../session/session.js';
import { ReplProtocol } from '../session/repl-protocol.js';

const execAsync = promisify(exec);

export interface ReplOptions {
  connection: ChromeConnection;
  config: ResolvedConfig;
  lang?: 'js' | 'cljs';
}

export class Repl {
  private watcher: FSWatcher | null = null;
  private watching = false;
  private protocol: ReplProtocol;
  private session: Session;

  constructor(private options: ReplOptions) {
    this.protocol = new ReplProtocol(options.lang);

    this.session = new Session({
      connection: options.connection,
      config: options.config,
      protocol: this.protocol,
      prompt: '> ',
      completer: createCompleter(options.config),
      onExit: () => this.cleanup(),
      localContext: {
        connection: options.connection,
        config: options.config,
        setWatching: this.setWatching.bind(this),
        isWatching: () => this.watching,
        runPreBuild: this.runPreBuild.bind(this),
        exit: () => this.session.stop(),
      },
    });
  }

  private get connection(): ChromeConnection {
    return this.options.connection;
  }

  private get config(): ResolvedConfig {
    return this.options.config;
  }

  private async runPreBuild(): Promise<void> {
    const cmd = this.config.hooks.preBuild;
    if (!cmd) return;

    try {
      const { stdout, stderr } = await execAsync(cmd);
      if (stdout) console.log(stdout.trim());
      if (stderr) console.log(stderr.trim());
    } catch (err) {
      console.log(`Build failed: ${err instanceof Error ? err.message : String(err)}`);
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

      if (debounceTimer) clearTimeout(debounceTimer);

      debounceTimer = setTimeout(async () => {
        console.log(`\n[watch] File changed: ${path}`);
        await this.handleFileChange(path);
        this.session.getReadline()?.prompt(true);
      }, this.config.watch.debounce);
    });

    console.log(`Watching: ${paths.join(', ')}`);
  }

  private stopWatcher(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  private async handleFileChange(path: string): Promise<void> {
    const ref = this.protocol.lastInjectRef;
    if (ref) {
      const url = resolveScriptUrl(ref, this.config);
      if (url && path.includes(ref)) {
        try {
          await this.connection.injectScript(url);
          console.log(`[watch] Re-injected: ${ref}`);
        } catch (err) {
          console.log(`[watch] Re-inject failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
  }

  private cleanup(): void {
    this.stopWatcher();
    console.log('\nGoodbye!');
  }

  async start(): Promise<void> {
    // Verify connection
    const page = this.connection.getCurrentPage();
    if (!page) {
      console.log('Warning: No page selected. Use .tabs to list pages and .tab to select one.');
    } else {
      const title = await page.title();
      console.log(`Connected to: ${title || page.url()}`);
    }

    console.log('Type .help for commands, .exit to quit\n');

    await this.session.start();
  }
}
