import { fork } from 'node:child_process';
import { unlinkSync, writeFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { sendFocusRequest } from '../src/utils/vscode-ipc.js';

/**
 * Integration tests for the VSCode IPC socket protocol.
 *
 * sendFocusRequest uses execFileSync internally, which blocks the Node.js
 * event loop. To avoid deadlocking, the mock socket server must run in a
 * separate process so it can handle connections while execFileSync blocks
 * the test process.
 */

const TEST_SOCKET = '/tmp/ccn-vscode-99999.sock';

/** Helper: write a temporary server script and fork it. */
function startMockServer(
  socketPath: string,
  responsePayload: Record<string, unknown>,
  opts?: { validateRequest?: boolean }
): Promise<{ child: ReturnType<typeof fork>; ready: Promise<void> }> {
  const scriptPath = '/tmp/ccn-ipc-test-server.cjs';
  const script = `
const net = require('net');
const server = net.createServer((conn) => {
  let data = '';
  conn.on('data', (chunk) => {
    data += chunk.toString();
    if (data.includes('\\n')) {
      ${
        opts?.validateRequest
          ? `
      const req = JSON.parse(data.trim());
      if (req.action !== 'focus' || req.tty !== '/dev/ttys003') {
        conn.end(JSON.stringify({ success: false, error: 'bad request' }) + '\\n');
        return;
      }
      `
          : ''
      }
      conn.end(JSON.stringify(${JSON.stringify(responsePayload)}) + '\\n');
    }
  });
  conn.on('error', () => {});
});
server.listen(${JSON.stringify(socketPath)}, () => {
  process.send('ready');
});
process.on('message', (msg) => {
  if (msg === 'stop') {
    server.close(() => process.exit(0));
  }
});
`;
  writeFileSync(scriptPath, script);

  const child = fork(scriptPath, [], { stdio: ['pipe', 'pipe', 'pipe', 'ipc'] });
  const ready = new Promise<void>((resolve, reject) => {
    child.on('message', (msg) => {
      if (msg === 'ready') resolve();
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Server exited with code ${code}`));
    });
    setTimeout(() => reject(new Error('Server startup timeout')), 5000);
  });

  return Promise.resolve({ child, ready });
}

describe('vscode-ipc integration', () => {
  let serverChild: ReturnType<typeof fork> | null = null;

  afterEach(() => {
    if (serverChild) {
      serverChild.send('stop');
      serverChild.kill();
      serverChild = null;
    }
    try {
      unlinkSync(TEST_SOCKET);
    } catch {
      // Already cleaned up
    }
  });

  it('should send focus request and receive success response', async () => {
    const { child, ready } = await startMockServer(
      TEST_SOCKET,
      { success: true },
      { validateRequest: true }
    );
    serverChild = child;
    await ready;

    const response = sendFocusRequest(TEST_SOCKET, '/dev/ttys003');
    expect(response).toEqual({ success: true });
  });

  it('should return null when socket does not exist', () => {
    const response = sendFocusRequest('/tmp/ccn-vscode-nonexistent.sock', '/dev/ttys003');
    expect(response).toBeNull();
  });

  it('should handle error responses', async () => {
    const { child, ready } = await startMockServer(TEST_SOCKET, {
      success: false,
      error: 'Not found',
    });
    serverChild = child;
    await ready;

    const response = sendFocusRequest(TEST_SOCKET, '/dev/ttys003');
    expect(response).toEqual({ success: false, error: 'Not found' });
  });
});
