/**
 * Sanitize a string for safe use in AppleScript double-quoted strings.
 * Escapes backslashes, double quotes, control characters, and AppleScript special chars.
 * Includes a post-sanitization assertion to verify no unescaped quotes remain.
 * @internal
 */
export declare function sanitizeForAppleScript(str: string): string;
/**
 * Validate TTY path format.
 * @internal
 */
export declare function isValidTtyPath(tty: string): boolean;
/**
 * Generate a title tag for a TTY path.
 * Used to identify terminal windows/tabs by their title.
 * @example generateTitleTag('/dev/ttys001') => 'ccn:ttys001'
 * @example generateTitleTag('/dev/pts/0') => 'ccn:pts-0'
 * @internal
 */
export declare function generateTitleTag(tty: string): string;
/**
 * Generate an OSC (Operating System Command) escape sequence to set terminal title.
 * OSC 0 sets both icon name and window title.
 * @internal
 */
export declare function generateOscTitleSequence(title: string): string;
/**
 * Set the terminal title by writing an OSC sequence to the TTY.
 * Returns true if successful, false if the TTY is not writable.
 * @internal
 */
export declare function setTtyTitle(tty: string, title: string): boolean;
export declare function isMacOS(): boolean;
export declare function focusSession(tty: string, cwd?: string): boolean;
export declare function getSupportedTerminals(): string[];
//# sourceMappingURL=focus.d.ts.map