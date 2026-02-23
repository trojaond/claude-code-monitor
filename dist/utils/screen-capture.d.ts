/**
 * Check if running on macOS.
 */
export declare function isMacOS(): boolean;
/**
 * Capture the terminal window associated with a TTY.
 * Identifies the correct terminal by matching TTY, then captures that specific window.
 *
 * @param tty - The TTY path (e.g., "/dev/ttys001")
 * @returns Base64-encoded PNG string if successful, null otherwise
 */
export declare function captureTerminalScreen(tty: string): Promise<string | null>;
//# sourceMappingURL=screen-capture.d.ts.map