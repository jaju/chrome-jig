/**
 * nREPL server — TCP + bencode, for Conjure / CIDER integration
 */

import * as net from 'node:net';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import bencode from 'bencode';
import type { ChromeConnection } from '../chrome/connection.js';
import type { NreplMessage, NreplSession, NreplContext } from './types.js';
import { ops } from './ops.js';

export interface NreplServerOptions {
  connection: ChromeConnection;
  port?: number;
  host?: string;
  cwd?: string;
}

export interface NreplServer {
  port: number;
  close: () => Promise<void>;
}

function newSession(sessions: Map<string, NreplSession>): NreplSession {
  const session: NreplSession = { id: crypto.randomUUID() };
  sessions.set(session.id, session);
  return session;
}

async function handleMessage(msg: NreplMessage, ctx: NreplContext, send: (m: NreplMessage) => void): Promise<void> {
  const op = msg.op as string;
  const id = msg.id as string | undefined;
  const session = msg.session as string | undefined;

  const handler = ops[op];
  if (!handler) {
    send({ id, session, status: ['error', 'unknown-op', 'done'] });
    return;
  }

  for await (const response of handler(msg, ctx)) {
    send({ id, session, ...response });
  }
}

function writePortFile(filePath: string, port: number): void {
  fs.writeFileSync(filePath, String(port), 'utf8');
}

function deletePortFile(filePath: string): void {
  try { fs.unlinkSync(filePath); } catch { /* ignore */ }
}

export async function startNreplServer(options: NreplServerOptions): Promise<NreplServer> {
  const host = options.host ?? '127.0.0.1';
  const port = options.port ?? 0;
  const cwd = options.cwd ?? process.cwd();
  const portFilePath = path.join(cwd, '.nrepl-port');

  const sessions = new Map<string, NreplSession>();
  const ctx: NreplContext = {
    connection: options.connection,
    sessions,
    newSession: () => newSession(sessions),
  };

  const server = net.createServer((socket) => {
    let buffer = Buffer.alloc(0);

    const send = (msg: NreplMessage): void => {
      const encoded = bencode.encode(msg);
      socket.write(encoded);
    };

    socket.on('data', (data) => {
      const chunk = typeof data === 'string' ? Buffer.from(data) : data;
      buffer = Buffer.concat([buffer, chunk]);

      // Decode as many complete messages as possible
      while (buffer.length > 0) {
        try {
          const decoded = bencode.decode(buffer) as Record<string, unknown>;

          // Determine consumed bytes by re-encoding
          const consumed = bencode.encode(decoded).length;
          buffer = buffer.subarray(consumed);

          // Convert Buffer values to strings
          const msg: NreplMessage = {};
          for (const [k, v] of Object.entries(decoded)) {
            msg[k] = v instanceof Uint8Array ? new TextDecoder().decode(v) : v;
          }

          handleMessage(msg, ctx, send).catch((err) => {
            send({ id: msg.id, status: ['error', 'done'], err: String(err) });
          });
        } catch {
          // Incomplete bencode data — wait for more
          break;
        }
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(port, host, () => {
      const addr = server.address() as net.AddressInfo;
      const actualPort = addr.port;

      writePortFile(portFilePath, actualPort);
      const cleanup = () => deletePortFile(portFilePath);
      process.on('exit', cleanup);

      resolve({
        port: actualPort,
        close: async () => {
          cleanup();
          return new Promise<void>((res) => server.close(() => res()));
        },
      });
    });
  });
}
