/**
 * nREPL command — start a TCP nREPL server alongside an interactive REPL.
 *
 * The nREPL server is event-driven TCP (returns immediately).
 * The REPL blocks on readline (stdin). They coexist on the same
 * event loop, sharing one ChromeConnection.
 */

import { ChromeConnection } from '../chrome/connection.js';
import { ResolvedConfig } from '../config/schema.js';
import { startNreplServer } from '../nrepl/server.js';
import { Repl } from '../repl/repl.js';

export interface NreplCommandOptions {
  connection: ChromeConnection;
  config: ResolvedConfig;
  port?: number;
  host?: string;
}

export async function nrepl(options: NreplCommandOptions): Promise<void> {
  const server = await startNreplServer({
    connection: options.connection,
    port: options.port,
    host: options.host,
  });

  console.log(`nREPL server started on port ${server.port}`);
  console.log('Wrote .nrepl-port');

  const repl = new Repl({
    connection: options.connection,
    config: options.config,
  });

  await repl.start();
  await server.close();
}
