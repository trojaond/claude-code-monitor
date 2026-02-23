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
export declare function executeWithTerminalFallback(operations: TerminalOperations): boolean;
//# sourceMappingURL=terminal-strategy.d.ts.map