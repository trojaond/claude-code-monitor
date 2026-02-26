import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text, useStdout } from 'ink';
import { memo } from 'react';
import { getStatusDisplay } from '../utils/status.js';
import { formatRelativeTimeShort } from '../utils/time.js';
function abbreviateHomePath(path) {
    if (!path)
        return '(unknown)';
    return path.replace(/^\/Users\/[^/]+/, '~');
}
function getTerminalColor(terminal) {
    const lower = terminal.toLowerCase();
    if (lower.includes('iterm'))
        return 'green';
    if (lower.includes('vscode') || lower.includes('vs code'))
        return 'blue';
    if (lower.includes('ghostty'))
        return 'magenta';
    if (lower.includes('terminal'))
        return 'white';
    return 'gray';
}
function formatModelShort(model) {
    if (!model)
        return '';
    return model.replace(/^claude-/, '');
}
function formatCost(cost) {
    if (cost === undefined)
        return '';
    return `$${cost.toFixed(2)}`;
}
function truncate(str, max) {
    if (str.length <= max)
        return str;
    return `${str.slice(0, max - 1)}\u2026`;
}
/** Format time since last status change: exact seconds when <60s, then minutes */
function formatLastChange(timestamp, now) {
    const diffMs = now - new Date(timestamp).getTime();
    const seconds = Math.max(0, Math.floor(diffMs / 1000));
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0)
        return `${hours}h`;
    if (minutes > 0)
        return `${minutes}m`;
    return `${seconds}s`;
}
function getContextBarColor(percent) {
    if (percent >= 80)
        return 'red';
    if (percent >= 50)
        return 'yellow';
    return 'green';
}
function renderContextBar(percent) {
    const BAR_WIDTH = 8;
    const filled = Math.round((percent / 100) * BAR_WIDTH);
    const empty = BAR_WIDTH - filled;
    const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
    const pct = `${percent}%`.padStart(4);
    return `${bar}${pct}`;
}
/** Seconds elapsed since last state change */
function secSince(updatedAt, now) {
    return Math.max(0, Math.floor((now - new Date(updatedAt).getTime()) / 1000));
}
/**
 * Indicator character for the index column.
 * Priority: selected (>) > recently changed (◆/◇/●) > marked (★) > normal ( )
 */
function rowIndicator(sec, isSelected, isMarked, tick) {
    if (isSelected)
        return '>';
    if (sec < 5)
        return tick % 2 === 0 ? '\u25c6' : '\u25c7'; // ◆ / ◇
    if (sec < 20)
        return '\u25cf'; // ●
    return isMarked ? '\u2605' : ' '; // ★ / space
}
// Column widths
const COL_STATUS = 12;
const COL_TERMINAL = 13;
const COL_MODEL = 12;
const COL_COST = 7;
const COL_CTX = 16;
const _COL_PROMPT_MIN = 20;
const COL_TASKS = 6;
const COL_LAST = 6;
const COL_AGE = 6;
const COL_IDX = 4;
// Dashboard outer box: round border (2) + paddingX={1} (2) = 4 overhead chars
const DASH_OVERHEAD = 4;
export const SessionTable = memo(function SessionTable({ sessions, selectedIndex, taskSummaries, markedSessionIds, now, }) {
    const { stdout } = useStdout();
    const terminalWidth = stdout?.columns ?? 120;
    const contentWidth = Math.max(40, terminalWidth - DASH_OVERHEAD);
    const tick = Math.floor(now / 1000);
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { children: [_jsx(Box, { width: COL_IDX, children: _jsx(Text, { bold: true, dimColor: true, children: '  # ' }) }), _jsx(Box, { width: COL_STATUS, children: _jsx(Text, { bold: true, dimColor: true, children: "STATUS" }) }), _jsx(Box, { flexGrow: 1, flexBasis: 0, children: _jsx(Text, { bold: true, dimColor: true, children: "CWD" }) }), _jsx(Box, { flexGrow: 1, flexBasis: 0, children: _jsx(Text, { bold: true, dimColor: true, children: "LAST PROMPT" }) }), _jsx(Box, { width: COL_TERMINAL, children: _jsx(Text, { bold: true, dimColor: true, children: "TERMINAL" }) }), _jsx(Box, { width: COL_MODEL, children: _jsx(Text, { bold: true, dimColor: true, children: "MODEL" }) }), _jsx(Box, { width: COL_COST, children: _jsx(Text, { bold: true, dimColor: true, children: "COST" }) }), _jsx(Box, { width: COL_CTX, children: _jsx(Text, { bold: true, dimColor: true, children: "CTX USAGE" }) }), _jsx(Box, { width: COL_TASKS, children: _jsx(Text, { bold: true, dimColor: true, children: "TASKS" }) }), _jsx(Box, { width: COL_LAST, children: _jsx(Text, { bold: true, dimColor: true, children: "LAST" }) }), _jsx(Box, { width: COL_AGE, children: _jsx(Text, { bold: true, dimColor: true, children: "AGE" }) })] }), sessions.map((session, index) => {
                const isSelected = index === selectedIndex;
                const isMarked = markedSessionIds.has(session.session_id);
                const { symbol, color, label } = getStatusDisplay(session.status);
                const cwd = abbreviateHomePath(session.cwd);
                const terminal = session.terminal ?? '';
                const model = formatModelShort(session.model);
                const cost = formatCost(session.costUSD);
                const tasks = taskSummaries.get(session.session_id) ?? '';
                const last = formatLastChange(session.updated_at, now);
                const age = formatRelativeTimeShort(session.created_at);
                const sec = secSince(session.updated_at, now);
                const indicator = rowIndicator(sec, isSelected, isMarked, tick);
                const isRecent = sec < 20;
                // Marked rows: per-cell rendering matching normal row layout, with blue background.
                // Padding each cell's text to its column width ensures the blue highlight is
                // continuous. Flex columns use wrap="truncate" + trailing spaces so Ink's own
                // layout fills the cell without a manual flexColWidth calculation.
                if (isMarked) {
                    const ctxStr = session.contextPercent !== undefined
                        ? renderContextBar(session.contextPercent)
                        : '\u2014';
                    const ctxColor = session.contextPercent !== undefined
                        ? getContextBarColor(session.contextPercent)
                        : undefined;
                    // Long pad appended to flex-column text; wrap="truncate" clips it to box width,
                    // filling the cell with the blue background.
                    const fill = ' '.repeat(contentWidth);
                    const bg = 'blue';
                    return (_jsxs(Box, { children: [_jsx(Box, { width: COL_IDX, children: _jsx(Text, { backgroundColor: bg, color: isSelected ? 'cyan' : isRecent ? 'yellow' : undefined, bold: isSelected || (isRecent && sec < 5), children: `${indicator}${index + 1} `.padEnd(COL_IDX) }) }), _jsx(Box, { width: COL_STATUS, children: _jsx(Text, { color: color, backgroundColor: bg, children: `${symbol} ${label}`.padEnd(COL_STATUS) }) }), _jsx(Box, { flexGrow: 1, flexBasis: 0, children: _jsx(Text, { color: "white", backgroundColor: bg, wrap: "truncate", children: cwd + fill }) }), _jsx(Box, { flexGrow: 1, flexBasis: 0, children: _jsx(Text, { backgroundColor: bg, wrap: "truncate", children: (session.lastPrompt ?? '') + fill }) }), _jsx(Box, { width: COL_TERMINAL, children: _jsx(Text, { color: terminal ? getTerminalColor(terminal) : undefined, backgroundColor: bg, children: truncate(terminal, COL_TERMINAL).padEnd(COL_TERMINAL) }) }), _jsx(Box, { width: COL_MODEL, children: _jsx(Text, { backgroundColor: bg, children: truncate(model, COL_MODEL).padEnd(COL_MODEL) }) }), _jsx(Box, { width: COL_COST, children: _jsx(Text, { color: cost ? 'yellow' : undefined, backgroundColor: bg, children: cost.padEnd(COL_COST) }) }), _jsx(Box, { width: COL_CTX, children: _jsx(Text, { color: ctxColor, backgroundColor: bg, children: ctxStr.padEnd(COL_CTX) }) }), _jsx(Box, { width: COL_TASKS, children: _jsx(Text, { color: tasks ? 'cyan' : undefined, backgroundColor: bg, children: tasks.padEnd(COL_TASKS) }) }), _jsx(Box, { width: COL_LAST, children: _jsx(Text, { backgroundColor: bg, children: last.padEnd(COL_LAST) }) }), _jsx(Box, { width: COL_AGE, children: _jsx(Text, { backgroundColor: bg, children: age.padEnd(COL_AGE) }) })] }, `${session.session_id}:${session.tty || ''}`));
                }
                // Normal (unmarked) row
                return (_jsxs(Box, { children: [_jsx(Box, { width: COL_IDX, children: _jsxs(Text, { color: isSelected ? 'cyan' : isRecent ? 'yellow' : undefined, bold: isSelected || (isRecent && sec < 5), dimColor: !isSelected && sec >= 5 && sec < 20, children: [indicator, index + 1, ' '] }) }), _jsx(Box, { width: COL_STATUS, children: _jsxs(Text, { color: color, children: [symbol, " ", label] }) }), _jsx(Box, { flexGrow: 1, flexBasis: 0, children: _jsx(Text, { color: isSelected ? 'white' : isRecent ? 'yellow' : 'gray', bold: isRecent && sec < 5, dimColor: !isSelected && !isRecent && false, wrap: "truncate", children: cwd }) }), _jsx(Box, { flexGrow: 1, flexBasis: 0, children: _jsx(Text, { color: isRecent ? 'yellow' : undefined, bold: isRecent && sec < 5, dimColor: !isRecent, wrap: "truncate", children: session.lastPrompt ?? '' }) }), _jsx(Box, { width: COL_TERMINAL, children: _jsx(Text, { color: terminal ? getTerminalColor(terminal) : undefined, children: truncate(terminal, COL_TERMINAL) }) }), _jsx(Box, { width: COL_MODEL, children: _jsx(Text, { color: isRecent ? 'yellow' : undefined, bold: isRecent && sec < 5, dimColor: !isRecent, children: truncate(model, COL_MODEL) }) }), _jsx(Box, { width: COL_COST, children: _jsx(Text, { color: cost ? 'yellow' : undefined, children: cost }) }), _jsx(Box, { width: COL_CTX, children: session.contextPercent !== undefined ? (_jsx(Text, { color: getContextBarColor(session.contextPercent), children: renderContextBar(session.contextPercent) })) : (_jsx(Text, { dimColor: true, children: '\u2014' })) }), _jsx(Box, { width: COL_TASKS, children: _jsx(Text, { color: tasks ? 'cyan' : undefined, children: tasks }) }), _jsx(Box, { width: COL_LAST, children: _jsx(Text, { color: isRecent ? 'yellow' : undefined, bold: isRecent && sec < 5, dimColor: !isRecent, children: last }) }), _jsx(Box, { width: COL_AGE, children: _jsx(Text, { dimColor: !isRecent, color: isRecent ? 'yellow' : undefined, children: age }) })] }, `${session.session_id}:${session.tty || ''}`));
            })] }));
});
