import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { Box, Text } from 'ink';
import { memo } from 'react';
import { getStatusDisplay } from '../utils/status.js';
import { formatRelativeTime } from '../utils/time.js';
function abbreviateHomePath(path) {
    if (!path)
        return '(unknown)';
    return path.replace(/^\/Users\/[^/]+/, '~');
}
/** Color for each known terminal app */
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
export const SessionCard = memo(function SessionCard({ session, index, isSelected, taskSummary, }) {
    const { symbol, color, label } = getStatusDisplay(session.status);
    const dir = abbreviateHomePath(session.cwd);
    const startedAt = formatRelativeTime(session.created_at);
    const modelShort = formatModelShort(session.model);
    const cost = formatCost(session.costUSD);
    // Build right-side metadata segments
    const meta = [];
    if (session.terminal) {
        meta.push({ text: session.terminal, color: getTerminalColor(session.terminal) });
    }
    if (modelShort)
        meta.push({ text: modelShort });
    if (cost)
        meta.push({ text: cost, color: 'yellow' });
    if (taskSummary)
        meta.push({ text: `${taskSummary} tasks`, color: 'cyan' });
    meta.push({ text: startedAt });
    return (_jsxs(Box, { paddingX: 1, children: [_jsxs(Text, { color: isSelected ? 'cyan' : undefined, bold: isSelected, children: [isSelected ? '>' : ' ', " [", index + 1, "]"] }), _jsx(Text, { children: " " }), _jsx(Box, { width: 10, children: _jsxs(Text, { color: color, children: [symbol, " ", label] }) }), _jsx(Text, { children: " " }), _jsx(Text, { color: isSelected ? 'white' : 'gray', children: dir }), _jsx(Text, { dimColor: true, children: '  ' }), meta.map((m, i) => (_jsxs(Text, { color: m.color, dimColor: !m.color, children: [i > 0 ? ' · ' : '', m.text] }, m.text)))] }));
});
