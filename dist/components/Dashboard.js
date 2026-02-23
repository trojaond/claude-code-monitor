import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import { useEffect, useMemo, useState } from 'react';
import { MIN_TERMINAL_HEIGHT_FOR_QR } from '../constants.js';
import { useServer } from '../hooks/useServer.js';
import { useSessions } from '../hooks/useSessions.js';
import { clearSessions, readSettings, writeSettings } from '../store/file-store.js';
import { focusSession } from '../utils/focus.js';
import { getTasksFromTranscript } from '../utils/tasks.js';
import { buildTranscriptPath } from '../utils/transcript.js';
import { SessionTable } from './SessionTable.js';
import { TaskDetailView } from './TaskDetailView.js';
const QUICK_SELECT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
export function Dashboard({ initialShowQr, preferTailscale, serverEnabled = false, }) {
    const { sessions, loading, error } = useSessions();
    const { url, qrCode, tailscaleIP, loading: serverLoading, } = useServer({ preferTailscale, enabled: serverEnabled });
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [markedSessionIds, setMarkedSessionIds] = useState(new Set());
    const [now, setNow] = useState(Date.now());
    const [viewMode, setViewMode] = useState('list');
    const [taskData, setTaskData] = useState();
    const [taskLoading, setTaskLoading] = useState(false);
    const { exit } = useApp();
    const { stdout } = useStdout();
    // QRコード表示状態: --qrフラグが指定された場合はそれを優先、なければ設定を読み込む
    const [qrCodeUserPref, setQrCodeUserPref] = useState(() => initialShowQr ?? readSettings().qrCodeVisible);
    // Read terminal height at render time. On actual resize, ccm.tsx triggers
    // a full clear+rerender which re-mounts this component with fresh values.
    // No resize listener needed here — avoids spurious re-renders from
    // keyboard escape sequences that fire fake resize events.
    const terminalHeight = stdout?.rows ?? 40;
    // QR code visibility: user preference AND terminal has enough space
    const canShowQr = terminalHeight >= MIN_TERMINAL_HEIGHT_FOR_QR;
    const qrCodeVisible = qrCodeUserPref && canShowQr;
    const toggleQrCode = () => {
        const newValue = !qrCodeUserPref;
        setQrCodeUserPref(newValue);
        writeSettings({ qrCodeVisible: newValue });
    };
    const focusSessionByIndex = (index) => {
        const session = sessions[index];
        if (session?.tty) {
            focusSession(session.tty, session.cwd);
        }
    };
    const handleQuickSelect = (input) => {
        const index = parseInt(input, 10) - 1;
        if (index < sessions.length) {
            setSelectedIndex(index);
            focusSessionByIndex(index);
        }
    };
    // Tick every second to keep the LAST column live
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);
    // Auto-return to list view if selected session disappears
    useEffect(() => {
        if (viewMode === 'tasks' && selectedIndex >= sessions.length) {
            setViewMode('list');
        }
    }, [viewMode, selectedIndex, sessions.length]);
    const openTaskView = () => {
        const session = sessions[selectedIndex];
        if (!session)
            return;
        setTaskLoading(true);
        setViewMode('tasks');
        try {
            const transcriptPath = buildTranscriptPath(session.cwd, session.session_id);
            setTaskData(getTasksFromTranscript(transcriptPath));
        }
        catch {
            setTaskData(undefined);
        }
        finally {
            setTaskLoading(false);
        }
    };
    // Compute task summaries for all sessions (e.g. "2/5")
    const taskSummaries = useMemo(() => {
        const map = new Map();
        for (const session of sessions) {
            try {
                const path = buildTranscriptPath(session.cwd, session.session_id);
                const tasks = getTasksFromTranscript(path);
                if (tasks && tasks.length > 0) {
                    const done = tasks.filter((t) => t.status === 'completed').length;
                    map.set(session.session_id, `${done}/${tasks.length}`);
                }
            }
            catch {
                // Skip failed transcript reads
            }
        }
        return map;
    }, [sessions]);
    const statusCounts = useMemo(() => sessions.reduce((counts, session) => {
        counts[session.status]++;
        return counts;
    }, { running: 0, waiting_input: 0, stopped: 0 }), [sessions]);
    useInput((input, key) => {
        // Tasks detail view: only back navigation
        if (viewMode === 'tasks') {
            if (input === 's' || key.escape || input === 'q') {
                setViewMode('list');
            }
            return;
        }
        // List view
        if (input === 'q' || key.escape) {
            exit();
            return;
        }
        if (key.upArrow || input === 'k') {
            setSelectedIndex((prev) => Math.max(0, prev - 1));
            return;
        }
        if (key.downArrow || input === 'j') {
            setSelectedIndex((prev) => Math.min(sessions.length - 1, prev + 1));
            return;
        }
        if (key.return || input === 'f') {
            focusSessionByIndex(selectedIndex);
            return;
        }
        if (input === 's') {
            openTaskView();
            return;
        }
        if (input === 'm') {
            const session = sessions[selectedIndex];
            if (session) {
                setMarkedSessionIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(session.session_id)) {
                        next.delete(session.session_id);
                    }
                    else {
                        next.add(session.session_id);
                    }
                    return next;
                });
            }
            return;
        }
        if (QUICK_SELECT_KEYS.includes(input)) {
            handleQuickSelect(input);
            return;
        }
        if (input === 'c') {
            clearSessions();
            setSelectedIndex(0);
            return;
        }
        if (input === 'h' && serverEnabled) {
            toggleQrCode();
            return;
        }
    });
    if (loading) {
        return _jsx(Text, { dimColor: true, children: "Loading..." });
    }
    if (error) {
        return _jsxs(Text, { color: "red", children: ["Error: ", error.message] });
    }
    const { running, waiting_input: waitingInput, stopped } = statusCounts;
    if (viewMode === 'tasks') {
        const session = sessions[selectedIndex];
        if (session) {
            return _jsx(TaskDetailView, { session: session, tasks: taskData, loading: taskLoading });
        }
        // Session gone, fall through to list
    }
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: "cyan", paddingX: 1, children: [_jsxs(Box, { children: [_jsx(Text, { bold: true, color: "cyan", children: "Claude Code Monitor" }), _jsx(Text, { dimColor: true, children: " " }), _jsxs(Text, { color: "gray", children: ["\u25CF ", running] }), _jsx(Text, { dimColor: true, children: " " }), _jsxs(Text, { color: "yellow", children: ["\u25D0 ", waitingInput] }), _jsx(Text, { dimColor: true, children: " " }), _jsxs(Text, { color: "green", children: ["\u2713 ", stopped] })] }), _jsx(Box, { flexDirection: "column", marginTop: 1, children: sessions.length === 0 ? (_jsx(Box, { children: _jsx(Text, { dimColor: true, children: "No active sessions" }) })) : (_jsx(SessionTable, { sessions: sessions, selectedIndex: selectedIndex, taskSummaries: taskSummaries, markedSessionIds: markedSessionIds, now: now })) })] }), _jsxs(Box, { marginTop: 1, justifyContent: "center", gap: 1, children: [_jsx(Text, { dimColor: true, children: "[\u2191\u2193]Select" }), _jsx(Text, { dimColor: true, children: "[Enter]Focus" }), _jsx(Text, { dimColor: true, children: "[s]Tasks" }), _jsx(Text, { dimColor: true, children: "[m]Mark" }), _jsx(Text, { dimColor: true, children: "[1-9]Quick" }), _jsx(Text, { dimColor: true, children: "[c]Clear" }), serverEnabled && _jsxs(Text, { dimColor: true, children: ["[h]", qrCodeUserPref ? 'Hide' : 'Show', "URL"] }), _jsx(Text, { dimColor: true, children: "[q]Quit" })] }), serverEnabled && !serverLoading && url && !qrCodeUserPref && (_jsx(Box, { marginTop: 1, borderStyle: "round", borderColor: "gray", paddingX: 1, children: _jsx(Text, { color: "white", children: "\uD83D\uDCF1 Web UI available. Press [h] to show QR code for mobile access. (Same Wi-Fi required)" }) })), serverEnabled && !serverLoading && url && qrCodeUserPref && (_jsxs(Box, { marginTop: 1, paddingX: 1, children: [qrCodeVisible && qrCode && (_jsx(Box, { flexShrink: 0, children: _jsx(Text, { children: qrCode }) })), _jsxs(Box, { flexDirection: "column", marginLeft: qrCodeVisible && qrCode ? 2 : 0, justifyContent: "center", children: [_jsx(Text, { bold: true, color: "magenta", children: "Web UI" }), _jsx(Text, { dimColor: true, children: url }), _jsx(Text, { dimColor: true, children: "Scan QR code to monitor sessions from your phone." }), _jsx(Text, { dimColor: true, children: "Tap a session to focus its terminal on this Mac." }), tailscaleIP && (_jsx(Text, { color: "green", children: "Tailscale: accessible from anywhere in your Tailnet" })), _jsx(Text, { color: "yellow", children: "Do not share this URL with others." }), !canShowQr && _jsx(Text, { color: "yellow", children: "Resize window to show QR code" })] })] }))] }));
}
