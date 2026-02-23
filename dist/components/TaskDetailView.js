import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Box, Text } from 'ink';
function abbreviateHomePath(path) {
    if (!path)
        return '(unknown)';
    return path.replace(/^\/Users\/[^/]+/, '~');
}
function statusIndicator(status) {
    switch (status) {
        case 'completed':
            return { symbol: '[x]', color: 'green' };
        case 'in_progress':
            return { symbol: '[~]', color: 'yellow' };
        default:
            return { symbol: '[ ]', color: 'gray' };
    }
}
export function TaskDetailView({ session, tasks, loading, }) {
    const dir = abbreviateHomePath(session.cwd);
    const completedCount = tasks?.filter((t) => t.status === 'completed').length ?? 0;
    const totalCount = tasks?.length ?? 0;
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: "cyan", paddingX: 1, children: [_jsxs(Box, { children: [_jsx(Text, { bold: true, color: "cyan", children: "Tasks" }), _jsx(Text, { dimColor: true, children: " - " }), _jsx(Text, { color: "gray", children: dir })] }), _jsx(Box, { flexDirection: "column", marginTop: 1, children: loading ? (_jsx(Text, { dimColor: true, children: "Loading tasks..." })) : !tasks || tasks.length === 0 ? (_jsx(Text, { dimColor: true, children: "No tasks found in transcript" })) : (_jsxs(_Fragment, { children: [_jsxs(Text, { dimColor: true, children: ["Progress: ", completedCount, "/", totalCount, " completed"] }), _jsx(Box, { flexDirection: "column", marginTop: 1, children: tasks.map((task) => {
                                        const { symbol, color } = statusIndicator(task.status);
                                        const isCompleted = task.status === 'completed';
                                        return (_jsxs(Box, { paddingX: 1, children: [_jsx(Text, { color: color, children: symbol }), _jsx(Text, { children: " " }), _jsx(Text, { dimColor: isCompleted, children: task.subject })] }, task.id));
                                    }) })] })) })] }), _jsx(Box, { marginTop: 1, justifyContent: "center", gap: 1, children: _jsx(Text, { dimColor: true, children: "[s/Esc]Back" }) })] }));
}
