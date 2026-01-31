/**
 * Protocol interface — the contract between wire formats and the session core.
 *
 * Each protocol adapter (REPL, JSON-RPC, nREPL) implements this interface.
 * The session core only sees Request/Response — never raw bytes.
 */

import { ChromeConnection } from '../chrome/connection.js';
import { ResolvedConfig } from '../config/schema.js';

/** A parsed request ready for dispatch */
export interface Request {
  id?: unknown;
  method: string;
  params: Record<string, unknown>;
}

/** Returned by parse() when the input is malformed at the protocol level */
export interface ProtocolError {
  kind: 'protocol-error';
  code: number;
  message: string;
  id?: unknown;
}

/** Context provided to handleLocal for protocol-specific commands */
export interface LocalContext {
  connection: ChromeConnection;
  config: ResolvedConfig;
  print: (msg: string) => void;
  setWatching: (enabled: boolean) => void;
  isWatching: () => boolean;
  runPreBuild: () => Promise<void>;
  exit: () => void;
}

/** Protocol adapter — parse and format are inverses */
export interface Protocol {
  /** Parse raw input into a dispatchable request, or null to skip (blank lines) */
  parse(input: string): Request | ProtocolError | null;

  /** Format a method result for output */
  formatResult(request: Request, result: unknown): string;

  /** Format a dispatch error for output */
  formatError(request: Request | null, code: number, message: string): string;

  /**
   * Handle protocol-local commands that don't dispatch to the session.
   * Returns a response string, or null if the input should be dispatched.
   */
  handleLocal?(input: string, ctx: LocalContext): Promise<string | null>;
}

export function isProtocolError(v: Request | ProtocolError | null): v is ProtocolError {
  return v !== null && 'kind' in v && v.kind === 'protocol-error';
}
