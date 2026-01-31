/**
 * Session core — shared method dispatch between all protocol adapters.
 *
 * Owns the readline loop, method routing, and connection reference.
 * Protocol adapters own parsing and formatting.
 */

import * as readline from 'node:readline';
import { ChromeConnection } from '../chrome/connection.js';
import { ResolvedConfig } from '../config/schema.js';
import { evaluate } from '../commands/eval.js';
import { evaluateCljs } from '../commands/cljs-eval.js';
import { listTabs, selectTab } from '../commands/tabs.js';
import { inject } from '../commands/inject.js';
import type { Protocol, LocalContext } from './protocol.js';
import { isProtocolError } from './protocol.js';

export type MethodHandler = (
  params: Record<string, unknown>,
  connection: ChromeConnection,
  config: ResolvedConfig,
) => Promise<unknown>;

export interface SessionOptions {
  connection: ChromeConnection;
  config: ResolvedConfig;
  protocol: Protocol;
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
  prompt?: string;
  completer?: readline.Completer;
  /** Called when the session is about to exit */
  onExit?: () => void;
  /** Context for protocol-local commands (REPL only) */
  localContext?: Omit<LocalContext, 'print'>;
}

/** Built-in method handlers */
export const builtinMethods: Record<string, MethodHandler> = {
  async eval(params, connection) {
    const code = String(params.code ?? '');
    if (!code) throw new Error('Missing param: code');

    const lang = String(params.lang ?? 'js');

    if (lang === 'cljs') {
      const result = await evaluateCljs(connection, code);
      if (!result.success) throw new Error(result.error);
      return result.value;
    }

    if (lang !== 'js') {
      throw new Error(`Unknown lang: ${lang}. Supported: js, cljs`);
    }

    const result = await evaluate(connection, code);
    if (!result.success) throw new Error(result.error);
    return result.value;
  },

  async 'cljs-eval'(params, connection, config) {
    return builtinMethods.eval({ ...params, lang: 'cljs' }, connection, config);
  },

  async tabs(_params, connection) {
    const tabs = await listTabs(connection);
    return { tabs, formatted: formatTabs(tabs) };
  },

  async selectTab(params, connection) {
    const pattern = String(params.pattern ?? '');
    if (!pattern) throw new Error('Missing param: pattern');
    const tab = await selectTab(connection, pattern);
    if (!tab) throw new Error(`No tab matching: ${pattern}`);
    return { tab, formatted: `Switched to: ${tab.title}\n  ${tab.url}` };
  },

  async inject(params, connection, config) {
    const ref = String(params.ref ?? '');
    if (!ref) throw new Error('Missing param: ref');
    const result = await inject(connection, config, ref);
    if (!result.success) throw new Error(result.error);
    const lines = [`Injected: ${result.url}`];
    if (result.windowApi) lines.push(`API available as: window.${result.windowApi}`);
    if (result.quickStart) lines.push(`Try: ${result.quickStart}`);
    return { ...result, formatted: lines.join('\n') };
  },

  async reload(_params, connection) {
    await connection.reload();
    return { formatted: 'Reloaded' };
  },
};

function formatTabs(tabs: Array<{ index: number; title: string; url: string; isCurrent: boolean }>): string {
  if (tabs.length === 0) return 'No tabs open';
  const lines = ['\nOpen tabs:\n'];
  for (const tab of tabs) {
    const marker = tab.isCurrent ? '→ ' : '  ';
    lines.push(`${marker}[${tab.index}] ${tab.title}`);
    lines.push(`       ${tab.url}\n`);
  }
  return lines.join('\n');
}

export class Session {
  private rl: readline.Interface | null = null;
  private running = false;
  private methods: Record<string, MethodHandler>;

  constructor(private options: SessionOptions) {
    this.methods = { ...builtinMethods };
  }

  /** Register a custom method handler */
  register(method: string, handler: MethodHandler): void {
    this.methods[method] = handler;
  }

  async start(): Promise<void> {
    this.running = true;

    const input = this.options.input ?? process.stdin;
    const output = this.options.output ?? process.stdout;

    const rlOptions: readline.ReadLineOptions = {
      input: input as NodeJS.ReadableStream,
      output: output as NodeJS.WritableStream,
      terminal: !!this.options.prompt,
    };

    if (this.options.prompt) rlOptions.prompt = this.options.prompt;
    if (this.options.completer) rlOptions.completer = this.options.completer;

    this.rl = readline.createInterface(rlOptions);

    if (this.options.prompt) this.rl.prompt();

    this.rl.on('line', async (line) => {
      await this.handleLine(line, output);
      if (this.running && this.options.prompt) {
        this.rl?.prompt();
      }
    });

    this.rl.on('close', () => {
      this.running = false;
      this.options.onExit?.();
    });

    if (this.options.prompt) {
      this.rl.on('SIGINT', () => {
        this.write(output, '\n(Use .exit or Ctrl+D to quit)');
        this.rl?.prompt();
      });
    }

    return new Promise((resolve) => {
      this.rl?.on('close', resolve);
    });
  }

  stop(): void {
    this.running = false;
    this.rl?.close();
  }

  /** Access the readline interface (for REPL prompt control) */
  getReadline(): readline.Interface | null {
    return this.rl;
  }

  private async handleLine(line: string, output: NodeJS.WritableStream): Promise<void> {
    const { protocol, connection, config } = this.options;

    // Try protocol-local handling first (REPL: .help, .watch, etc.)
    if (protocol.handleLocal && this.options.localContext) {
      const localCtx: LocalContext = {
        ...this.options.localContext,
        print: (msg: string) => this.write(output, msg),
      };
      const localResult = await protocol.handleLocal(line, localCtx);
      if (localResult !== null) {
        if (localResult) this.write(output, localResult);
        return;
      }
    }

    // Parse the input
    const parsed = protocol.parse(line);

    if (parsed === null) return; // blank line or skip

    if (isProtocolError(parsed)) {
      this.write(output, protocol.formatError(null, parsed.code, parsed.message));
      return;
    }

    // Dispatch to method handler
    const handler = this.methods[parsed.method];
    if (!handler) {
      this.write(output, protocol.formatError(parsed, -32601, `Unknown method: ${parsed.method}`));
      return;
    }

    try {
      const result = await handler(parsed.params, connection, config);
      const formatted = protocol.formatResult(parsed, result);
      if (formatted) this.write(output, formatted);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.write(output, protocol.formatError(parsed, -32603, message));
    }
  }

  private write(output: NodeJS.WritableStream, data: string): void {
    output.write(data + '\n');
  }
}
