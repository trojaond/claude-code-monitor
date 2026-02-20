/**
 * Terminal operation strategies for macOS.
 * Provides a unified interface to execute operations across different terminal apps.
 */

export interface TerminalOperations {
  iTerm2: () => boolean;
  terminalApp: () => boolean;
  ghostty: () => boolean;
  vscode?: () => boolean;
}

/**
 * Execute terminal operation with fallback strategy.
 * Tries iTerm2 → Terminal.app → Ghostty → VSCode in order, returning on first success.
 *
 * @param operations - Terminal-specific operation functions
 * @returns true if any terminal operation succeeded, false otherwise
 */
export function executeWithTerminalFallback(operations: TerminalOperations): boolean {
  const strategies = [
    operations.iTerm2,
    operations.terminalApp,
    operations.ghostty,
    operations.vscode,
  ].filter((op): op is () => boolean => op !== undefined);
  return strategies.some((op) => op());
}
