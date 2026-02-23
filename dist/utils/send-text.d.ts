/**
 * Validate text input for sending to terminal.
 * @internal
 */
export declare function validateTextInput(text: string): {
    valid: boolean;
    error?: string;
};
/**
 * Send text to a terminal session and execute it (press Enter).
 * Tries iTerm2, Terminal.app, and Ghostty in order.
 *
 * @param tty - The TTY path of the target terminal session
 * @param text - The text to send to the terminal
 * @returns true if text was sent successfully, false otherwise
 *
 * @remarks
 * - This is macOS only (uses AppleScript)
 * - For iTerm2 and Terminal.app, targets specific TTY
 * - For Ghostty, sends to the active window (TTY targeting not supported)
 * - System Events usage for Ghostty may require accessibility permissions
 */
export declare function sendTextToTerminal(tty: string, text: string): {
    success: boolean;
    error?: string;
};
/**
 * Allowed keys for permission prompt responses.
 */
export declare const ALLOWED_KEYS: Set<string>;
/**
 * macOS key codes for arrow keys.
 */
export declare const ARROW_KEY_CODES: {
    readonly up: 126;
    readonly down: 125;
    readonly left: 123;
    readonly right: 124;
};
/**
 * macOS key code for Enter/Return key.
 */
export declare const ENTER_KEY_CODE = 36;
/**
 * Send a single keystroke to a terminal session.
 * Used for responding to permission prompts (y/n/a), Ctrl+C to abort, or Escape to cancel.
 *
 * @param tty - The TTY path of the target terminal session
 * @param key - Single character key to send (y, n, a, 1-9, escape, etc.)
 * @param useControl - If true, send with Control modifier (for Ctrl+C)
 * @returns Result object with success status
 */
export declare function sendKeystrokeToTerminal(tty: string, key: string, useControl?: boolean): {
    success: boolean;
    error?: string;
};
//# sourceMappingURL=send-text.d.ts.map