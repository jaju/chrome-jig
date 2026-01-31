/**
 * JSON-RPC 2.0 protocol adapter — newline-delimited JSON over stdio.
 *
 * Every input line is a JSON-RPC request; every output line is a JSON-RPC response.
 * No local commands — everything dispatches to the session.
 */

import type { Request, ProtocolError, Protocol } from './protocol.js';

// JSON-RPC 2.0 error codes
export const PARSE_ERROR = -32700;
export const INVALID_REQUEST = -32600;
export const METHOD_NOT_FOUND = -32601;
export const INVALID_PARAMS = -32602;
export const INTERNAL_ERROR = -32603;

interface JsonRpcRequest {
  jsonrpc: string;
  id?: unknown;
  method: string;
  params?: Record<string, unknown>;
}

export class JsonRpcProtocol implements Protocol {
  parse(input: string): Request | ProtocolError | null {
    const trimmed = input.trim();
    if (!trimmed) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return { kind: 'protocol-error', code: PARSE_ERROR, message: 'Parse error' };
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { kind: 'protocol-error', code: INVALID_REQUEST, message: 'Invalid request' };
    }

    const req = parsed as Partial<JsonRpcRequest>;

    if (req.jsonrpc !== '2.0') {
      return { kind: 'protocol-error', code: INVALID_REQUEST, message: 'Invalid request: missing jsonrpc "2.0"', id: req.id };
    }

    if (typeof req.method !== 'string' || !req.method) {
      return { kind: 'protocol-error', code: INVALID_REQUEST, message: 'Invalid request: missing method', id: req.id };
    }

    if (req.params !== undefined && (typeof req.params !== 'object' || req.params === null || Array.isArray(req.params))) {
      return { kind: 'protocol-error', code: INVALID_PARAMS, message: 'Invalid params: must be an object', id: req.id };
    }

    return {
      id: req.id,
      method: req.method,
      params: (req.params as Record<string, unknown>) ?? {},
    };
  }

  formatResult(request: Request, result: unknown): string {
    return JSON.stringify({
      jsonrpc: '2.0',
      id: request.id ?? null,
      result: result ?? null,
    });
  }

  formatError(request: Request | null, code: number, message: string): string {
    return JSON.stringify({
      jsonrpc: '2.0',
      id: request?.id ?? null,
      error: { code, message },
    });
  }
}
