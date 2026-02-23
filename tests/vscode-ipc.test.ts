import { describe, expect, it } from 'vitest';
import { findVSCodeSockets, isValidSocketPath } from '../src/utils/vscode-ipc.js';

describe('vscode-ipc', () => {
  describe('isValidSocketPath', () => {
    it('should accept valid ccm-vscode socket paths', () => {
      expect(isValidSocketPath('/tmp/ccm-vscode-12345.sock')).toBe(true);
      expect(isValidSocketPath('/tmp/ccm-vscode-1.sock')).toBe(true);
      expect(isValidSocketPath('/tmp/ccm-vscode-99999.sock')).toBe(true);
    });

    it('should reject invalid paths', () => {
      expect(isValidSocketPath('/tmp/other.sock')).toBe(false);
      expect(isValidSocketPath('/tmp/ccm-vscode-.sock')).toBe(false);
      expect(isValidSocketPath('/tmp/ccm-vscode-abc.sock')).toBe(false);
      expect(isValidSocketPath('')).toBe(false);
    });
  });

  describe('findVSCodeSockets', () => {
    it('should return an array', () => {
      const sockets = findVSCodeSockets();
      expect(Array.isArray(sockets)).toBe(true);
    });

    it('should only return paths matching ccm-vscode-*.sock pattern', () => {
      const sockets = findVSCodeSockets();
      for (const s of sockets) {
        expect(s).toMatch(/^\/tmp\/ccm-vscode-\d+\.sock$/);
      }
    });
  });
});
