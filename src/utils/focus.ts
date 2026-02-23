import { accessSync, constants, writeFileSync } from 'node:fs';
import { executeAppleScript } from './applescript.js';
import { executeWithTerminalFallback } from './terminal-strategy.js';
import { findVSCodeSockets, sendFocusRequest } from './vscode-ipc.js';

/** Maximum length for strings embedded in AppleScript to prevent abuse */
const MAX_APPLESCRIPT_STRING_LENGTH = 50000;

/**
 * Sanitize a string for safe use in AppleScript double-quoted strings.
 * Escapes backslashes, double quotes, control characters, and AppleScript special chars.
 * Includes a post-sanitization assertion to verify no unescaped quotes remain.
 * @internal
 */
export function sanitizeForAppleScript(str: string): string {
  if (str.length > MAX_APPLESCRIPT_STRING_LENGTH) {
    throw new Error(
      `Input too long for AppleScript embedding (${str.length} > ${MAX_APPLESCRIPT_STRING_LENGTH})`
    );
  }

  const sanitized = str
    .replace(/\\/g, '\\\\') // Backslash (must be first)
    .replace(/"/g, '\\"') // Double quote
    .replace(/\n/g, '\\n') // Newline
    .replace(/\r/g, '\\r') // Carriage return
    .replace(/\t/g, '\\t') // Tab
    .replace(/\$/g, '\\$') // Dollar sign (variable reference in some contexts)
    .replace(/`/g, '\\`'); // Backtick

  // Defense-in-depth: verify no unescaped double quotes remain.
  // An unescaped quote is a `"` NOT preceded by an odd number of backslashes.
  if (/(?<!\\)(?:\\\\)*"/.test(sanitized.replace(/\\"/g, ''))) {
    throw new Error('Sanitization verification failed: unescaped quote detected');
  }

  return sanitized;
}

/**
 * TTY path pattern for validation.
 * Matches:
 *   - macOS: /dev/ttys000, /dev/tty000
 *   - Linux: /dev/pts/0
 * @internal
 */
const TTY_PATH_PATTERN = /^\/dev\/(ttys?\d+|pts\/\d+)$/;

/**
 * Validate TTY path format.
 * @internal
 */
export function isValidTtyPath(tty: string): boolean {
  return TTY_PATH_PATTERN.test(tty);
}

/**
 * Generate a title tag for a TTY path.
 * Used to identify terminal windows/tabs by their title.
 * @example generateTitleTag('/dev/ttys001') => 'ccm:ttys001'
 * @example generateTitleTag('/dev/pts/0') => 'ccm:pts-0'
 * @internal
 */
export function generateTitleTag(tty: string): string {
  const match = tty.match(/\/dev\/(ttys?\d+|pts\/\d+)$/);
  if (!match) return '';
  const ttyId = match[1].replace('/', '-');
  return `ccm:${ttyId}`;
}

/**
 * Generate an OSC (Operating System Command) escape sequence to set terminal title.
 * OSC 0 sets both icon name and window title.
 * @internal
 */
export function generateOscTitleSequence(title: string): string {
  return `\x1b]0;${title}\x07`;
}

/**
 * Set the terminal title by writing an OSC sequence to the TTY.
 * Returns true if successful, false if the TTY is not writable.
 * @internal
 */
export function setTtyTitle(tty: string, title: string): boolean {
  if (!isValidTtyPath(tty)) return false;
  try {
    accessSync(tty, constants.W_OK);
    writeFileSync(tty, generateOscTitleSequence(title));
    return true;
  } catch {
    return false;
  }
}

function buildITerm2Script(tty: string): string {
  const safeTty = sanitizeForAppleScript(tty);
  return `
if application "iTerm" is not running then return false
tell application "iTerm2"
  repeat with aWindow in windows
    repeat with aTab in tabs of aWindow
      repeat with aSession in sessions of aTab
        if tty of aSession is "${safeTty}" then
          select aSession
          select aTab
          tell aWindow to select
          activate
          return true
        end if
      end repeat
    end repeat
  end repeat
  return false
end tell
`;
}

function buildTerminalAppScript(tty: string): string {
  const safeTty = sanitizeForAppleScript(tty);
  return `
if application "Terminal" is not running then return false
tell application "Terminal"
  repeat with aWindow in windows
    repeat with aTab in tabs of aWindow
      if tty of aTab is "${safeTty}" then
        set selected of aTab to true
        set index of aWindow to 1
        activate
        return true
      end if
    end repeat
  end repeat
  return false
end tell
`;
}

function buildGhosttyScript(): string {
  return `
if application "Ghostty" is not running then return false
tell application "Ghostty"
  activate
end tell
return true
`;
}

function buildGhosttyFocusByTitleScript(titleTag: string): string {
  const safeTag = sanitizeForAppleScript(titleTag);
  return `
if application "Ghostty" is not running then return false
-- Activate Ghostty first (required when called from Web UI with Ghostty in background)
tell application "Ghostty" to activate
delay 0.1

tell application "System Events"
  if not (exists process "Ghostty") then
    return false
  end if
  tell process "Ghostty"
    -- Search Window menu for the title tag (uses "name" attribute, not "title")
    try
      set windowMenu to menu "Window" of menu bar 1
      set menuItems to every menu item of windowMenu whose name contains "${safeTag}"
      if (count of menuItems) > 0 then
        -- Ghostty quirk: first click selects the tab, second click brings the window to front
        click item 1 of menuItems
        delay 0.05
        click item 1 of menuItems
        delay 0.05
        -- Raise the correct window (overrides initial activate which may have raised wrong window)
        try
          perform action "AXRaise" of window 1
        end try
        return true
      end if
    end try
  end tell
end tell
return false
`;
}

function focusITerm2(tty: string): boolean {
  return executeAppleScript(buildITerm2Script(tty));
}

function focusTerminalApp(tty: string): boolean {
  return executeAppleScript(buildTerminalAppScript(tty));
}

function focusGhostty(tty: string): boolean {
  const titleTag = generateTitleTag(tty);

  // Set title tag for window identification
  const titleSet = setTtyTitle(tty, titleTag);

  if (titleSet) {
    // Wait for title to propagate to Window menu
    const waitScript = 'delay 0.2';
    executeAppleScript(waitScript);
  }

  // Try to focus by searching Window menu for the title tag
  const success = executeAppleScript(buildGhosttyFocusByTitleScript(titleTag));

  // Clear title to let shell restore it
  if (titleSet) {
    setTtyTitle(tty, '');
  }

  return success;
}

function raiseVSCodeWindow(workspaceName: string): boolean {
  const safeName = sanitizeForAppleScript(workspaceName);
  return executeAppleScript(`
tell application "System Events"
  if not (exists process "Code") then return false
  tell process "Code"
    repeat with w in windows
      if name of w contains "${safeName}" then
        perform action "AXRaise" of w
        tell application "Visual Studio Code" to activate
        return true
      end if
    end repeat
  end tell
end tell
return false
`);
}

function focusVSCode(tty: string, cwd?: string): boolean {
  // Try IPC socket first (can select specific terminal tab)
  const sockets = findVSCodeSockets();
  for (const socketPath of sockets) {
    const response = sendFocusRequest(socketPath, tty);
    if (response?.success) {
      // Raise the specific VSCode window by matching the workspace name in the title
      const workspaceName = cwd?.split('/').pop();
      if (workspaceName && raiseVSCodeWindow(workspaceName)) {
        return true;
      }
      // Fallback: just activate VSCode (raises last-focused window)
      executeAppleScript('tell application "Visual Studio Code" to activate');
      return true;
    }
  }

  return false;
}

export function isMacOS(): boolean {
  return process.platform === 'darwin';
}

export function focusSession(tty: string, cwd?: string): boolean {
  if (!isMacOS()) return false;
  if (!isValidTtyPath(tty)) return false;

  return executeWithTerminalFallback({
    iTerm2: () => focusITerm2(tty),
    terminalApp: () => focusTerminalApp(tty),
    ghostty: () => focusGhostty(tty),
    vscode: () => focusVSCode(tty, cwd),
  });
}

export function getSupportedTerminals(): string[] {
  return ['iTerm2', 'Terminal.app', 'Ghostty', 'VSCode'];
}
