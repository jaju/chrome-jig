import { describe, it, expect, vi } from 'vitest';
import { PassThrough } from 'node:stream';
import { Session } from '../src/session/session.js';
import type { Protocol, Request } from '../src/session/protocol.js';
import type { ChromeConnection } from '../src/chrome/connection.js';
import type { ResolvedConfig } from '../src/config/schema.js';

/** Minimal protocol that echoes input as an eval request */
const echoProtocol: Protocol = {
  parse(input: string): Request | null {
    const trimmed = input.trim();
    if (!trimmed) return null;
    return { id: 1, method: 'echo', params: { code: trimmed } };
  },
  formatResult(_req, result) {
    return JSON.stringify(result);
  },
  formatError(_req, code, message) {
    return JSON.stringify({ error: { code, message } });
  },
};

function createTestSession(handler: (params: Record<string, unknown>) => Promise<unknown>) {
  const input = new PassThrough();
  const output = new PassThrough();
  output.setEncoding('utf8');

  const connection = {} as ChromeConnection;
  const config = {} as ResolvedConfig;

  const session = new Session({
    connection,
    config,
    protocol: echoProtocol,
    input,
    output,
  });

  session.register('echo', async (params) => handler(params));

  return { session, input, output };
}

function collectOutput(output: PassThrough): string[] {
  const lines: string[] = [];
  output.on('data', (chunk: string) => {
    for (const line of chunk.split('\n').filter(Boolean)) {
      lines.push(line);
    }
  });
  return lines;
}

describe('Session drain — close waits for in-flight handlers', () => {
  it('completes a single piped request before start() resolves', async () => {
    const order: string[] = [];

    const { session, input, output } = createTestSession(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      order.push('handler-done');
      return 'ok';
    });

    const lines = collectOutput(output);
    const started = session.start();

    input.write('hello\n');
    input.end();

    await started;
    order.push('start-resolved');

    expect(order).toEqual(['handler-done', 'start-resolved']);
    expect(lines).toContain('"ok"');
  });

  it('completes multiple piped requests before start() resolves', async () => {
    let count = 0;
    const handler = vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
      return ++count;
    });

    const { session, input, output } = createTestSession(handler);
    const lines = collectOutput(output);
    const started = session.start();

    input.write('a\nb\nc\n');
    input.end();

    await started;

    expect(handler).toHaveBeenCalledTimes(3);
    expect(lines).toHaveLength(3);
  });

  it('resolves immediately when no lines are piped', async () => {
    const handler = vi.fn(async () => 'never');

    const { session, input } = createTestSession(handler);
    const started = session.start();

    input.end();

    await started;

    expect(handler).not.toHaveBeenCalled();
  });
});
