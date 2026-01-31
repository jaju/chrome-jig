import { describe, it, expect } from 'vitest';
import { ReplProtocol } from '../src/session/repl-protocol.js';
import { isProtocolError } from '../src/session/protocol.js';

describe('ReplProtocol', () => {
  describe('parse', () => {
    it('maps bare text to eval request', () => {
      const protocol = new ReplProtocol();
      const result = protocol.parse('document.title');
      expect(result).toEqual({ method: 'eval', params: { code: 'document.title' } });
    });

    it('trims whitespace from bare text', () => {
      const protocol = new ReplProtocol();
      const result = protocol.parse('  1 + 1  ');
      expect(result).toEqual({ method: 'eval', params: { code: '1 + 1' } });
    });

    it('maps .tabs to tabs request', () => {
      const protocol = new ReplProtocol();
      const result = protocol.parse('.tabs');
      expect(result).toEqual({ method: 'tabs', params: {} });
    });

    it('maps .t alias to tabs request', () => {
      const protocol = new ReplProtocol();
      expect(protocol.parse('.t')).toEqual({ method: 'tabs', params: {} });
    });

    it('maps .tab <pattern> to selectTab request', () => {
      const protocol = new ReplProtocol();
      const result = protocol.parse('.tab 0');
      expect(result).toEqual({ method: 'selectTab', params: { pattern: '0' } });
    });

    it('maps .tab with URL pattern', () => {
      const protocol = new ReplProtocol();
      const result = protocol.parse('.tab localhost');
      expect(result).toEqual({ method: 'selectTab', params: { pattern: 'localhost' } });
    });

    it('maps .inject <ref> to inject request', () => {
      const protocol = new ReplProtocol();
      const result = protocol.parse('.inject bs');
      expect(result).toEqual({ method: 'inject', params: { ref: 'bs' } });
    });

    it('tracks last inject ref', () => {
      const protocol = new ReplProtocol();
      protocol.parse('.inject myScript');
      expect(protocol.lastInjectRef).toBe('myScript');
    });

    it('maps .reload to reload request', () => {
      const protocol = new ReplProtocol();
      expect(protocol.parse('.reload')).toEqual({ method: 'reload', params: {} });
    });

    it('returns null for empty/blank lines', () => {
      const protocol = new ReplProtocol();
      expect(protocol.parse('')).toBeNull();
      expect(protocol.parse('   ')).toBeNull();
      expect(protocol.parse('\t')).toBeNull();
    });

    it('returns null for local commands (.help, .exit, etc.)', () => {
      const protocol = new ReplProtocol();
      expect(protocol.parse('.help')).toBeNull();
      expect(protocol.parse('.exit')).toBeNull();
      expect(protocol.parse('.watch on')).toBeNull();
      expect(protocol.parse('.build')).toBeNull();
      expect(protocol.parse('.clear')).toBeNull();
      expect(protocol.parse('.config')).toBeNull();
    });

    it('returns protocol error for unknown dot-command', () => {
      const protocol = new ReplProtocol();
      const result = protocol.parse('.foobar');
      expect(isProtocolError(result)).toBe(true);
      if (isProtocolError(result)) {
        expect(result.message).toContain('.foobar');
        expect(result.message).toContain('.help');
      }
    });
  });

  describe('formatResult', () => {
    it('formats structured result with formatted field', () => {
      const protocol = new ReplProtocol();
      const request = { method: 'tabs', params: {} };
      const result = { tabs: [], formatted: 'No tabs open' };
      expect(protocol.formatResult(request, result)).toBe('No tabs open');
    });

    it('formats primitive values', () => {
      const protocol = new ReplProtocol();
      const request = { method: 'eval', params: { code: '42' } };
      expect(protocol.formatResult(request, 42)).toBe('42');
    });

    it('formats string values with quotes', () => {
      const protocol = new ReplProtocol();
      const request = { method: 'eval', params: { code: '"hello"' } };
      expect(protocol.formatResult(request, 'hello')).toBe('"hello"');
    });

    it('returns empty string for undefined', () => {
      const protocol = new ReplProtocol();
      const request = { method: 'eval', params: {} };
      expect(protocol.formatResult(request, undefined)).toBe('');
    });
  });

  describe('formatError', () => {
    it('formats error message', () => {
      const protocol = new ReplProtocol();
      expect(protocol.formatError(null, -1, 'something broke')).toBe('Error: something broke');
    });
  });
});
