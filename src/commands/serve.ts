/**
 * Serve command — JSON-RPC 2.0 protocol over stdio.
 *
 * Machine-readable interface for editors, scripts, and plugins.
 * Reads newline-delimited JSON-RPC requests from stdin,
 * writes JSON-RPC responses to stdout.
 * Status messages go to stderr.
 */

import { ChromeConnection } from '../chrome/connection.js';
import { ResolvedConfig } from '../config/schema.js';
import { Session } from '../session/session.js';
import { JsonRpcProtocol } from '../session/jsonrpc-protocol.js';

export interface ServeOptions {
  connection: ChromeConnection;
  config: ResolvedConfig;
}

export async function serve(options: ServeOptions): Promise<void> {
  const protocol = new JsonRpcProtocol();

  const session = new Session({
    connection: options.connection,
    config: options.config,
    protocol,
  });

  process.stderr.write('cjig serve: JSON-RPC 2.0 over stdio\n');
  process.stderr.write(`Connected to ${options.config.host}:${options.config.port}\n`);

  await session.start();
}
