import { describe, it, expect } from 'vitest';
import { JsonRpcProtocol, PARSE_ERROR, INVALID_REQUEST, INVALID_PARAMS } from '../src/session/jsonrpc-protocol.js';
import { isProtocolError } from '../src/session/protocol.js';
import type { Request } from '../src/session/protocol.js';

describe('JsonRpcProtocol', () => {
  const protocol = new JsonRpcProtocol();

  describe('parse', () => {
    it('parses a valid request', () => {
      const input = '{"jsonrpc":"2.0","id":1,"method":"eval","params":{"code":"1+1"}}';
      const result = protocol.parse(input);
      expect(isProtocolError(result)).toBe(false);
      expect(result).toEqual({ id: 1, method: 'eval', params: { code: '1+1' } });
    });

    it('parses a request without params', () => {
      const input = '{"jsonrpc":"2.0","id":2,"method":"tabs"}';
      const result = protocol.parse(input);
      expect(result).toEqual({ id: 2, method: 'tabs', params: {} });
    });

    it('returns null for blank input', () => {
      expect(protocol.parse('')).toBeNull();
      expect(protocol.parse('   ')).toBeNull();
    });

    it('returns parse error for invalid JSON', () => {
      const result = protocol.parse('not json');
      expect(isProtocolError(result)).toBe(true);
      if (isProtocolError(result)) {
        expect(result.code).toBe(PARSE_ERROR);
        expect(result.message).toBe('Parse error');
      }
    });

    it('returns invalid request for non-object JSON', () => {
      const result = protocol.parse('"hello"');
      expect(isProtocolError(result)).toBe(true);
      if (isProtocolError(result)) {
        expect(result.code).toBe(INVALID_REQUEST);
      }
    });

    it('returns invalid request for array JSON', () => {
      const result = protocol.parse('[1,2,3]');
      expect(isProtocolError(result)).toBe(true);
      if (isProtocolError(result)) {
        expect(result.code).toBe(INVALID_REQUEST);
      }
    });

    it('returns invalid request for missing jsonrpc field', () => {
      const result = protocol.parse('{"id":1,"method":"eval"}');
      expect(isProtocolError(result)).toBe(true);
      if (isProtocolError(result)) {
        expect(result.code).toBe(INVALID_REQUEST);
        expect(result.message).toContain('jsonrpc');
      }
    });

    it('returns invalid request for missing method', () => {
      const result = protocol.parse('{"jsonrpc":"2.0","id":1}');
      expect(isProtocolError(result)).toBe(true);
      if (isProtocolError(result)) {
        expect(result.code).toBe(INVALID_REQUEST);
        expect(result.message).toContain('method');
      }
    });

    it('returns invalid params for array params', () => {
      const result = protocol.parse('{"jsonrpc":"2.0","id":1,"method":"eval","params":[1]}');
      expect(isProtocolError(result)).toBe(true);
      if (isProtocolError(result)) {
        expect(result.code).toBe(INVALID_PARAMS);
      }
    });

    it('preserves id in error for requests with id', () => {
      const result = protocol.parse('{"jsonrpc":"2.0","id":42}');
      expect(isProtocolError(result)).toBe(true);
      if (isProtocolError(result)) {
        expect(result.id).toBe(42);
      }
    });
  });

  describe('formatResult', () => {
    it('wraps result in JSON-RPC envelope', () => {
      const request: Request = { id: 1, method: 'eval', params: {} };
      const output = protocol.formatResult(request, { success: true, value: 2 });
      const parsed = JSON.parse(output);
      expect(parsed).toEqual({
        jsonrpc: '2.0',
        id: 1,
        result: { success: true, value: 2 },
      });
    });

    it('uses null for missing id', () => {
      const request: Request = { method: 'eval', params: {} };
      const parsed = JSON.parse(protocol.formatResult(request, 42));
      expect(parsed.id).toBeNull();
    });

    it('uses null for undefined result', () => {
      const request: Request = { id: 1, method: 'eval', params: {} };
      const parsed = JSON.parse(protocol.formatResult(request, undefined));
      expect(parsed.result).toBeNull();
    });
  });

  describe('formatError', () => {
    it('wraps error in JSON-RPC envelope', () => {
      const request: Request = { id: 1, method: 'eval', params: {} };
      const output = protocol.formatError(request, -32603, 'Something broke');
      const parsed = JSON.parse(output);
      expect(parsed).toEqual({
        jsonrpc: '2.0',
        id: 1,
        error: { code: -32603, message: 'Something broke' },
      });
    });

    it('uses null id when request is null', () => {
      const parsed = JSON.parse(protocol.formatError(null, -32700, 'Parse error'));
      expect(parsed.id).toBeNull();
      expect(parsed.error.code).toBe(-32700);
    });
  });
});
