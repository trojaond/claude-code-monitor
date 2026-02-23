/**
 * Extract tty short name from path (e.g., "/dev/ttys001" -> "ttys001")
 * @internal
 */
export declare function ttyShortName(ttyPath: string): string;
/**
 * Match a process command name against known terminal apps.
 * @internal
 */
export declare function matchTerminalApp(comm: string): string | undefined;
/**
 * Walk the process tree from a given PID up to MAX_WALK_DEPTH levels,
 * looking for a known terminal app in parent processes.
 * @internal
 */
export declare function walkProcessTree(startPid: string): string | undefined;
/**
 * Detect which terminal app is running on the given TTY.
 * Uses process tree walking to find known terminal apps.
 * Results are cached per TTY path.
 */
export declare function detectTerminalApp(ttyPath: string | undefined): string | undefined;
/** Clear the terminal detection cache (useful for testing) */
export declare function clearTerminalCache(): void;
//# sourceMappingURL=terminal-detect.d.ts.map