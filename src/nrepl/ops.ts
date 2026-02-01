/**
 * nREPL op handlers
 *
 * Each op is an async generator yielding one or more response messages.
 */

import type { NreplMessage, NreplContext, OpHandler } from './types.js';
import { evaluateCljs } from '../commands/cljs-eval.js';

async function* clone(_msg: NreplMessage, ctx: NreplContext): AsyncIterable<NreplMessage> {
  const session = ctx.newSession();
  yield { 'new-session': session.id, status: ['done'] };
}

async function* close(msg: NreplMessage, ctx: NreplContext): AsyncIterable<NreplMessage> {
  const sid = msg.session as string | undefined;
  if (sid) ctx.sessions.delete(sid);
  yield { status: ['done'] };
}

async function* describe(_msg: NreplMessage, _ctx: NreplContext): AsyncIterable<NreplMessage> {
  yield {
    ops: { clone: {}, close: {}, describe: {}, eval: {} },
    versions: { 'cjig-nrepl': '0.1.0' },
    status: ['done'],
  };
}

async function* evalOp(msg: NreplMessage, ctx: NreplContext): AsyncIterable<NreplMessage> {
  const code = msg.code as string;
  const result = await evaluateCljs(ctx.connection, code);

  if (result.success) {
    yield { value: String(result.value), ns: 'cljs.user' };
  } else {
    yield { err: result.error ?? 'Unknown error' };
  }
  yield { status: ['done'] };
}

export const ops: Record<string, OpHandler> = {
  clone,
  close,
  describe,
  eval: evalOp,
};
