import { unlinkSync } from 'node:fs';
import type * as net from 'node:net';
import type * as vscode from 'vscode';
import { createSocketServer, registerTerminalCloseHandler } from './socket-server';

let server: net.Server | undefined;
let socketPath: string | undefined;

export function activate(context: vscode.ExtensionContext) {
  const result = createSocketServer();
  server = result.server;
  socketPath = result.socketPath;

  registerTerminalCloseHandler(context);

  console.log(`ccn-terminal-bridge: listening on ${socketPath}`);
}

export function deactivate() {
  if (server) {
    server.close();
  }
  if (socketPath) {
    try {
      unlinkSync(socketPath);
    } catch {
      // Already cleaned up
    }
  }
}
