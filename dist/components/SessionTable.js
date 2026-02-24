import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
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
export const SessionTable = memo(function SessionTable({ sessions, selectedIndex, taskSummaries, markedSessionIds, now, }) {
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { children: [_jsx(Box, { width: 4, children: _jsx(Text, { bold: true, dimColor: true, children: '  # ' }) }), _jsx(Box, { width: COL_STATUS, children: _jsx(Text, { bold: true, dimColor: true, children: "STATUS" }) }), _jsx(Box, { flexGrow: 1, flexBasis: 0, children: _jsx(Text, { bold: true, dimColor: true, children: "CWD" }) }), _jsx(Box, { flexGrow: 1, flexBasis: 0, children: _jsx(Text, { bold: true, dimColor: true, children: "LAST PROMPT" }) }), _jsx(Box, { width: COL_TERMINAL, children: _jsx(Text, { bold: true, dimColor: true, children: "TERMINAL" }) }), _jsx(Box, { width: COL_MODEL, children: _jsx(Text, { bold: true, dimColor: true, children: "MODEL" }) }), _jsx(Box, { width: COL_COST, children: _jsx(Text, { bold: true, dimColor: true, children: "COST" }) }), _jsx(Box, { width: COL_CTX, children: _jsx(Text, { bold: true, dimColor: true, children: "CTX USAGE" }) }), _jsx(Box, { width: COL_TASKS, children: _jsx(Text, { bold: true, dimColor: true, children: "TASKS" }) }), _jsx(Box, { width: COL_LAST, children: _jsx(Text, { bold: true, dimColor: true, children: "LAST" }) }), _jsx(Box, { width: COL_AGE, children: _jsx(Text, { bold: true, dimColor: true, children: "AGE" }) })] }), sessions.map((session, index) => {
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
                const bg = isMarked ? 'blue' : undefined;
                return (_jsxs(Box, { children: [_jsx(Box, { width: 4, children: _jsxs(Text, { color: isSelected ? 'cyan' : undefined, bold: isSelected, backgroundColor: bg, children: [isSelected ? '>' : ' ', index + 1, ' '] }) }), _jsx(Box, { width: COL_STATUS, children: _jsxs(Text, { color: color, backgroundColor: bg, children: [symbol, " ", label] }) }), _jsx(Box, { flexGrow: 1, flexBasis: 0, children: _jsx(Text, { color: isSelected ? 'white' : 'gray', backgroundColor: bg, wrap: "truncate", children: cwd }) }), _jsx(Box, { flexGrow: 1, flexBasis: 0, children: _jsx(Text, { dimColor: !isMarked, backgroundColor: bg, wrap: "truncate", children: session.lastPrompt ?? '' }) }), _jsx(Box, { width: COL_TERMINAL, children: _jsx(Text, { color: terminal ? getTerminalColor(terminal) : undefined, backgroundColor: bg, children: truncate(terminal, COL_TERMINAL) }) }), _jsx(Box, { width: COL_MODEL, children: _jsx(Text, { dimColor: !isMarked, backgroundColor: bg, children: truncate(model, COL_MODEL) }) }), _jsx(Box, { width: COL_COST, children: _jsx(Text, { color: cost ? 'yellow' : undefined, backgroundColor: bg, children: cost }) }), _jsx(Box, { width: COL_CTX, children: session.contextPercent !== undefined ? (_jsx(Text, { color: getContextBarColor(session.contextPercent), backgroundColor: bg, children: renderContextBar(session.contextPercent) })) : (_jsx(Text, { dimColor: true, backgroundColor: bg, children: '\u2014' })) }), _jsx(Box, { width: COL_TASKS, children: _jsx(Text, { color: tasks ? 'cyan' : undefined, backgroundColor: bg, children: tasks }) }), _jsx(Box, { width: COL_LAST, children: _jsx(Text, { dimColor: !isMarked, backgroundColor: bg, children: last }) }), _jsx(Box, { width: COL_AGE, children: _jsx(Text, { dimColor: !isMarked, backgroundColor: bg, children: age }) })] }, `${session.session_id}:${session.tty || ''}`));
            })] }));
});
