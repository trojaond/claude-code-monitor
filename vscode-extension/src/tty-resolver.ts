import { execFileSync } from 'node:child_process';
import * as vscode from 'vscode';

const pidToTtyCache = new Map<number, string>();

/**
 * Resolve a shell PID to its TTY device path.
 * Uses lsof to find fd 0 (stdin) which points to the PTY slave.
 * Results are cached since TTYs don't change for a terminal's lifetime.
 */
export function resolvePidToTty(pid: number): string | undefined {
  const cached = pidToTtyCache.get(pid);
  if (cached) {
    return cached;
  }

  try {
    const output = execFileSync('lsof', ['-a', '-p', String(pid), '-d', '0', '-Fn'], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 2000,
    });

    // lsof -Fn output format: lines starting with 'n' contain the file name
    for (const line of output.split('\n')) {
      if (line.startsWith('n/dev/ttys')) {
        const tty = line.slice(1); // Remove 'n' prefix
        pidToTtyCache.set(pid, tty);
        return tty;
      }
    }
  } catch {
    // lsof failed — process may have exited
  }

  return undefined;
}

/**
 * Find the VSCode terminal whose shell process owns the given TTY.
 */
export async function findTerminalByTty(
  tty: string
): Promise<vscode.Terminal | undefined> {
  const terminals = vscode.window.terminals;

  for (const terminal of terminals) {
    const pid = await terminal.processId;
    if (pid === undefined) {
      continue;
    }

    const terminalTty = resolvePidToTty(pid);
    if (terminalTty === tty) {
      return terminal;
    }
  }

  return undefined;
}

/**
 * Remove cached entries for PIDs that no longer exist.
 * Called when terminals are closed.
 */
export function evictPid(pid: number): void {
  pidToTtyCache.delete(pid);
}
