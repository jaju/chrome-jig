/**
 * Eval-file command - evaluate a JavaScript file in the browser
 */

import { readFileSync } from 'node:fs';
import { ChromeConnection } from '../chrome/connection.js';
import type { EvalResult } from './eval.js';
import { evaluate } from './eval.js';

export async function evaluateFile(
  connection: ChromeConnection,
  filePath: string,
): Promise<EvalResult> {
  const content = filePath === '-'
    ? await readStdin()
    : readFileSync(filePath, 'utf-8');

  return evaluate(connection, content);
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf-8');
}
