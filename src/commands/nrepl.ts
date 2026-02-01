/**
 * nREPL command — start a TCP nREPL server for editor integration
 */

import { ChromeConnection } from '../chrome/connection.js';
import { startNreplServer } from '../nrepl/server.js';

export interface NreplCommandOptions {
  connection: ChromeConnection;
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

  await new Promise<void>((resolve) => {
    process.on('SIGINT', async () => {
      console.log('\nShutting down nREPL server...');
      await server.close();
      resolve();
    });
  });
}
