import { execFileSync } from 'node:child_process';
/**
 * Known terminal app patterns.
 * Key: substring to match in process comm/name, Value: display name
 */
const KNOWN_TERMINALS = [
    ['iTerm2', 'iTerm2'],
    ['iTerm', 'iTerm2'],
    ['Terminal', 'Terminal.app'],
    ['Ghostty', 'Ghostty'],
    ['Code Helper', 'VSCode'],
    ['Electron', 'VSCode'],
    ['code', 'VSCode'],
];
/** Max levels to walk up the process tree */
const MAX_WALK_DEPTH = 10;
/** Cache detected terminal per TTY (terminal app doesn't change during a session) */
const terminalCache = new Map();
/**
 * Extract tty short name from path (e.g., "/dev/ttys001" -> "ttys001")
 * @internal
 */
export function ttyShortName(ttyPath) {
    const match = ttyPath.match(/\/dev\/(ttys?\d+|pts\/\d+)$/);
    return match ? match[1] : '';
}
/**
 * Match a process command name against known terminal apps.
 * @internal
 */
export function matchTerminalApp(comm) {
    for (const [pattern, name] of KNOWN_TERMINALS) {
        if (comm.includes(pattern)) {
            return name;
        }
    }
    return undefined;
}
/**
 * Walk the process tree from a given PID up to MAX_WALK_DEPTH levels,
 * looking for a known terminal app in parent processes.
 * @internal
 */
export function walkProcessTree(startPid) {
    let currentPid = startPid;
    for (let i = 0; i < MAX_WALK_DEPTH; i++) {
        try {
            const output = execFileSync('ps', ['-o', 'ppid=,comm=', '-p', currentPid], {
                encoding: 'utf-8',
                timeout: 3000,
            }).trim();
            if (!output)
                return undefined;
            // Parse "  ppid comm" format
            const match = output.match(/^\s*(\d+)\s+(.+)$/);
            if (!match)
                return undefined;
            const ppid = match[1];
            const comm = match[2];
            const terminal = matchTerminalApp(comm);
            if (terminal)
                return terminal;
            // Stop at init/launchd (PID 1 or 0)
            if (ppid === '0' || ppid === '1')
                return undefined;
            currentPid = ppid;
        }
        catch {
            return undefined;
        }
    }
    return undefined;
}
/**
 * Detect which terminal app is running on the given TTY.
 * Uses process tree walking to find known terminal apps.
 * Results are cached per TTY path.
 */
export function detectTerminalApp(ttyPath) {
    if (!ttyPath)
        return undefined;
    // Check cache first
    if (terminalCache.has(ttyPath)) {
        return terminalCache.get(ttyPath);
    }
    const shortName = ttyShortName(ttyPath);
    if (!shortName)
        return undefined;
    let result;
    try {
        // List processes on this TTY
        const output = execFileSync('ps', ['-t', shortName, '-o', 'pid='], {
            encoding: 'utf-8',
            timeout: 3000,
        }).trim();
        if (!output) {
            terminalCache.set(ttyPath, undefined);
            return undefined;
        }
        // Try each PID on the TTY
        const pids = output
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean);
        for (const pid of pids) {
            result = walkProcessTree(pid);
            if (result)
                break;
        }
    }
    catch {
        // ps command failed, return undefined
    }
    terminalCache.set(ttyPath, result);
    return result;
}
/** Clear the terminal detection cache (useful for testing) */
export function clearTerminalCache() {
    terminalCache.clear();
}
