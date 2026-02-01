/**
 * REPL protocol adapter — maps dot-commands and bare text to Request objects.
 *
 * Local commands (.help, .watch, .build, .clear, .exit, .config, .open)
 * are handled in-protocol and never reach the session core.
 */

import type { Request, ProtocolError, Protocol, LocalContext } from './protocol.js';
import { findCommand } from '../repl/commands.js';
import { formatValue } from '../commands/eval.js';

/** Commands that are REPL-local (never dispatched to session) */
const LOCAL_COMMANDS = new Set([
  'help', 'h', '?',
  'watch', 'w',
  'build', 'b',
  'config', 'cfg',
  'clear', 'cls',
  'exit', 'quit', 'q',
  'open', 'o', 'goto',
]);

/** Commands that map to session methods */
const DISPATCH_MAP: Record<string, (args: string) => Request> = {
  tabs: () => ({ method: 'tabs', params: {} }),
  t: () => ({ method: 'tabs', params: {} }),
  pages: () => ({ method: 'tabs', params: {} }),

  tab: (args) => ({ method: 'selectTab', params: { pattern: args.trim() } }),
  select: (args) => ({ method: 'selectTab', params: { pattern: args.trim() } }),

  inject: (args) => ({ method: 'inject', params: { ref: args.trim() } }),
  i: (args) => ({ method: 'inject', params: { ref: args.trim() } }),
  load: (args) => ({ method: 'inject', params: { ref: args.trim() } }),

  reload: () => ({ method: 'reload', params: {} }),
  r: () => ({ method: 'reload', params: {} }),
};

function parseDotCommand(input: string): { name: string; args: string } {
  const spaceIndex = input.indexOf(' ');
  const name = spaceIndex > 0 ? input.slice(1, spaceIndex) : input.slice(1);
  const args = spaceIndex > 0 ? input.slice(spaceIndex + 1) : '';
  return { name: name.toLowerCase(), args };
}

export class ReplProtocol implements Protocol {
  /** Track last injected ref for file watching */
  lastInjectRef: string | null = null;

  constructor(private lang: 'js' | 'cljs' = 'js') {}

  parse(input: string): Request | ProtocolError | null {
    const trimmed = input.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('.')) {
      const { name, args } = parseDotCommand(trimmed);

      // Local commands return null from parse — handled by handleLocal
      if (LOCAL_COMMANDS.has(name)) return null;

      const builder = DISPATCH_MAP[name];
      if (builder) {
        const request = builder(args);
        // Track inject refs for file watching
        if (request.method === 'inject' && args.trim()) {
          this.lastInjectRef = args.trim();
        }
        return request;
      }

      // Unknown dot-command — return a protocol error
      return {
        kind: 'protocol-error',
        code: -1,
        message: `Unknown command: .${name}\nType .help for available commands`,
      };
    }

    // Bare text → eval
    return { method: 'eval', params: { code: trimmed, lang: this.lang } };
  }

  formatResult(_request: Request, result: unknown): string {
    if (result === undefined) return '';

    // For structured results from commands like tabs, inject
    if (typeof result === 'object' && result !== null && 'formatted' in result) {
      return (result as { formatted: string }).formatted;
    }

    return formatValue(result);
  }

  formatError(_request: Request | null, _code: number, message: string): string {
    return `Error: ${message}`;
  }

  async handleLocal(input: string, ctx: LocalContext): Promise<string | null> {
    const trimmed = input.trim();
    if (!trimmed || !trimmed.startsWith('.')) return null;

    const { name, args } = parseDotCommand(trimmed);
    if (!LOCAL_COMMANDS.has(name)) return null;

    const command = findCommand(name);
    if (!command) return null;

    // Collect output instead of printing directly
    const lines: string[] = [];
    const collectCtx = {
      ...ctx,
      print: (msg: string) => lines.push(msg),
    };

    await command.execute(args, collectCtx);
    return lines.join('\n');
  }
}
