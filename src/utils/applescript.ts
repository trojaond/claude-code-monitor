import { execFileSync } from 'node:child_process';

/** Maximum time in milliseconds to wait for an AppleScript to complete */
const APPLESCRIPT_TIMEOUT_MS = 5000;

/**
 * Execute an AppleScript and return whether it succeeded.
 * @param script - AppleScript code to execute
 * @returns true if the script returned "true", false otherwise
 */
export function executeAppleScript(script: string): boolean {
  try {
    const result = execFileSync('osascript', ['-e', script], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: APPLESCRIPT_TIMEOUT_MS,
    }).trim();
    return result === 'true';
  } catch {
    return false;
  }
}
