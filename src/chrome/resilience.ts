/**
 * Connection resilience: retry with exponential backoff + host fallback
 */

import { ChromeConnection } from './connection.js';
import { ConnectionError } from '../errors.js';

export interface ResilienceOptions {
  host: string;
  port: number;
  retries?: number;
  retryDelayMs?: number;
  fallbackHosts?: string[];
}

const DEFAULTS = {
  retries: 3,
  retryDelayMs: 500,
  backoffFactor: 2,
} as const;

type ConnectFailure = 'host-skip' | 'transient' | 'fatal';

/**
 * Classify a connection error to determine retry strategy.
 * Parses Playwright error messages for known error codes.
 */
export function classifyConnectError(err: unknown): ConnectFailure {
  const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();

  // EPERM / ECONNREFUSED → try next host
  if (message.includes('eperm') || message.includes('econnrefused')) {
    return 'host-skip';
  }

  // Timeouts and transient network issues → retry same host
  if (
    message.includes('timeout') ||
    message.includes('econnreset') ||
    message.includes('enotfound') ||
    message.includes('ehostunreach')
  ) {
    return 'transient';
  }

  return 'fatal';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Connect with retry logic and optional host fallback.
 *
 * Algorithm:
 * 1. Build host sequence: [configured_host, ...fallbackHosts]
 * 2. For each host: attempt connect
 *    - host-skip error → move to next host
 *    - transient error → retry with exponential backoff
 *    - fatal error → throw immediately
 * 3. All exhausted → throw ConnectionError with attempt summary
 */
export async function connectWithResilience(options: ResilienceOptions): Promise<ChromeConnection> {
  const retries = options.retries ?? DEFAULTS.retries;
  const initialDelay = options.retryDelayMs ?? DEFAULTS.retryDelayMs;
  const hosts = [options.host, ...(options.fallbackHosts ?? [])];
  const attempts: string[] = [];

  for (const host of hosts) {
    let delay = initialDelay;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const connection = new ChromeConnection({ host, port: options.port });

      try {
        await connection.connect();
        return connection;
      } catch (err) {
        const classification = classifyConnectError(err);
        const label = `${host}:${options.port} attempt ${attempt + 1}`;
        const msg = err instanceof Error ? err.message : String(err);
        attempts.push(`${label}: ${msg}`);

        if (classification === 'fatal') {
          throw err;
        }

        if (classification === 'host-skip') {
          break; // move to next host
        }

        // transient: retry with backoff (unless last attempt)
        if (attempt < retries) {
          await sleep(delay);
          delay *= DEFAULTS.backoffFactor;
        }
      }
    }
  }

  throw new ConnectionError(
    `Failed to connect after ${attempts.length} attempts:\n  ${attempts.join('\n  ')}`,
    options.host,
    options.port,
  );
}
