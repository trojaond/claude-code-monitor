import * as vscode from 'vscode';
import type * as net from 'node:net';
import { createSocketServer, registerTerminalCloseHandler } from './socket-server';

let server: net.Server | undefined;
let socketPath: string | undefined;

export function activate(context: vscode.ExtensionContext) {
  const result = createSocketServer();
  server = result.server;
  socketPath = result.socketPath;

  registerTerminalCloseHandler(context);

  console.log(`ccm-terminal-bridge: listening on ${socketPath}`);
}

export function deactivate() {
  if (server) {
    server.close();
  }
  if (socketPath) {
    try {
      require('node:fs').unlinkSync(socketPath);
    } catch {
      // Already cleaned up
    }
  }
}
