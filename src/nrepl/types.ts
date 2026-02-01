/**
 * nREPL protocol types
 */

import type { ChromeConnection } from '../chrome/connection.js';

export type NreplMessage = Record<string, unknown>;

export interface NreplSession {
  id: string;
}

export interface NreplContext {
  connection: ChromeConnection;
  sessions: Map<string, NreplSession>;
  newSession: () => NreplSession;
}

export type OpHandler = (
  msg: NreplMessage,
  ctx: NreplContext,
) => AsyncIterable<NreplMessage>;
