import * as fs from 'node:fs';
import * as net from 'node:net';
import * as vscode from 'vscode';
import { evictPid, findTerminalByTty } from './tty-resolver';

interface FocusRequest {
  action: 'focus';
  tty: string;
}

interface FocusResponse {
  success: boolean;
  error?: string;
}

const MAX_REQUEST_SIZE = 4096;

function getSocketPath(): string {
  return `/tmp/ccm-vscode-${process.pid}.sock`;
}

function cleanupSocket(socketPath: string): void {
  try {
    fs.unlinkSync(socketPath);
  } catch {
    // Socket file doesn't exist, that's fine
  }
}

function isValidRequest(data: unknown): data is FocusRequest {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return obj.action === 'focus' && typeof obj.tty === 'string';
}

const TTY_PATH_PATTERN = /^\/dev\/(ttys?\d+|pts\/\d+)$/;

export function createSocketServer(): { server: net.Server; socketPath: string } {
  const socketPath = getSocketPath();

  // Clean up stale socket from previous instance
  cleanupSocket(socketPath);

  const server = net.createServer((connection) => {
    let data = '';

    connection.on('data', (chunk) => {
      data += chunk.toString();

      if (data.length > MAX_REQUEST_SIZE) {
        respond(connection, { success: false, error: 'Request too large' });
        connection.destroy();
        return;
      }

      // Look for newline delimiter
      const newlineIndex = data.indexOf('\n');
      if (newlineIndex === -1) return;

      const jsonStr = data.slice(0, newlineIndex);
      handleRequest(jsonStr, connection);
    });

    connection.on('error', () => {
      connection.destroy();
    });

    // Timeout connections that don't send data
    connection.setTimeout(5000, () => {
      connection.destroy();
    });
  });

  const oldUmask = process.umask(0o177); // Creates socket as 0o600
  server.listen(socketPath, () => {
    process.umask(oldUmask);
  });

  server.on('error', (err) => {
    console.error('ccm-terminal-bridge socket error:', err.message);
  });

  return { server, socketPath };
}

async function handleRequest(jsonStr: string, connection: net.Socket): Promise<void> {
  let request: unknown;
  try {
    request = JSON.parse(jsonStr);
  } catch {
    respond(connection, { success: false, error: 'Invalid JSON' });
    return;
  }

  if (!isValidRequest(request)) {
    respond(connection, { success: false, error: 'Invalid request format' });
    return;
  }

  if (!TTY_PATH_PATTERN.test(request.tty)) {
    respond(connection, { success: false, error: 'Invalid TTY path' });
    return;
  }

  try {
    const terminal = await findTerminalByTty(request.tty);
    if (terminal) {
      terminal.show(true);
      respond(connection, { success: true });
    } else {
      respond(connection, {
        success: false,
        error: `Terminal not found for TTY ${request.tty}`,
      });
    }
  } catch (err) {
    respond(connection, {
      success: false,
      error: `Internal error: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}

function respond(connection: net.Socket, response: FocusResponse): void {
  try {
    connection.end(JSON.stringify(response) + '\n');
  } catch {
    // Connection already closed
  }
}

export function registerTerminalCloseHandler(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.window.onDidCloseTerminal(async (terminal) => {
      const pid = await terminal.processId;
      if (pid !== undefined) {
        evictPid(pid);
      }
    })
  );
}
