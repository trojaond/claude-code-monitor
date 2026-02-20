import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const SOCKET_PATTERN = /^ccm-vscode-\d+\.sock$/;
const SOCKET_DIR = '/tmp';

export interface VSCodeIPCResponse {
  success: boolean;
  error?: string;
}

/**
 * Validate that a path matches the expected CCM VSCode socket pattern.
 * @internal
 */
export function isValidSocketPath(path: string): boolean {
  if (!path) return false;
  const filename = path.split('/').pop() ?? '';
  return SOCKET_PATTERN.test(filename);
}

/**
 * Scan /tmp for active CCM VSCode extension sockets.
 * Returns paths matching /tmp/ccm-vscode-{pid}.sock.
 */
export function findVSCodeSockets(): string[] {
  try {
    const files = readdirSync(SOCKET_DIR);
    return files.filter((f) => SOCKET_PATTERN.test(f)).map((f) => `${SOCKET_DIR}/${f}`);
  } catch {
    return [];
  }
}

/**
 * Send a focus request to a VSCode extension socket.
 * Uses a Node.js one-liner via execFileSync to keep the call synchronous,
 * matching CCM's existing sync focus architecture (executeAppleScript pattern).
 */
export function sendFocusRequest(socketPath: string, tty: string): VSCodeIPCResponse | null {
  const request = JSON.stringify({ action: 'focus', tty });

  // One-liner: connect to Unix socket, send JSON + newline, print response
  const script = `
    const net = require('net');
    const sock = net.connect(${JSON.stringify(socketPath)}, () => {
      sock.write(${JSON.stringify(request)} + '\\n');
    });
    let d = '';
    sock.on('data', c => d += c);
    sock.on('end', () => { process.stdout.write(d); process.exit(0); });
    sock.on('error', () => process.exit(1));
    sock.setTimeout(2000, () => { sock.destroy(); process.exit(1); });
  `;

  try {
    const result = execFileSync('node', ['-e', script], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 3000,
    }).trim();

    if (!result) return null;
    return JSON.parse(result) as VSCodeIPCResponse;
  } catch {
    return null;
  }
}
