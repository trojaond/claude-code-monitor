import { Box, Text, useApp, useInput, useStdout } from 'ink';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { MIN_TERMINAL_HEIGHT_FOR_QR } from '../constants.js';
import { useServer } from '../hooks/useServer.js';
import { useSessions } from '../hooks/useSessions.js';
import { clearSessions, readSettings, writeSettings } from '../store/file-store.js';
import type { Task } from '../types/index.js';
import { focusSession } from '../utils/focus.js';
import { getTasksFromTranscript } from '../utils/tasks.js';
import { buildTranscriptPath } from '../utils/transcript.js';
import { DiffView } from './DiffView.js';
import { SessionTable } from './SessionTable.js';
import { TaskDetailView } from './TaskDetailView.js';

type ViewMode = 'list' | 'tasks' | 'diff';

const QUICK_SELECT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

interface DashboardProps {
  /** Override default QR code visibility (e.g., from --qr CLI flag) */
  initialShowQr?: boolean;
  /** Prefer Tailscale IP for mobile access */
  preferTailscale?: boolean;
  /** Enable/disable the mobile web server (default: true) */
  serverEnabled?: boolean;
}

export function Dashboard({
  initialShowQr,
  preferTailscale,
  serverEnabled = false,
}: DashboardProps): React.ReactElement {
  const { sessions, loading, error } = useSessions();
  const {
    url,
    qrCode,
    tailscaleIP,
    loading: serverLoading,
  } = useServer({ preferTailscale, enabled: serverEnabled });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [markedSessionIds, setMarkedSessionIds] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(Date.now());
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [taskData, setTaskData] = useState<Task[] | undefined>();
  const [taskLoading, setTaskLoading] = useState(false);
  const { exit } = useApp();
  const { stdout } = useStdout();

  // QRコード表示状態: --qrフラグが指定された場合はそれを優先、なければ設定を読み込む
  const [qrCodeUserPref, setQrCodeUserPref] = useState(
    () => initialShowQr ?? readSettings().qrCodeVisible
  );
  // Read terminal height at render time. On actual resize, ccn.tsx triggers
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

  const focusSessionByIndex = (index: number) => {
    const session = sessions[index];
    if (session?.tty) {
      focusSession(session.tty, session.cwd);
    }
  };

  const handleQuickSelect = (input: string) => {
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
    if ((viewMode === 'tasks' || viewMode === 'diff') && selectedIndex >= sessions.length) {
      setViewMode('list');
    }
  }, [viewMode, selectedIndex, sessions.length]);

  const openTaskView = () => {
    const session = sessions[selectedIndex];
    if (!session) return;
    setTaskLoading(true);
    setViewMode('tasks');
    try {
      const transcriptPath = buildTranscriptPath(session.cwd, session.session_id);
      setTaskData(getTasksFromTranscript(transcriptPath));
    } catch {
      setTaskData(undefined);
    } finally {
      setTaskLoading(false);
    }
  };

  // Compute task summaries for all sessions (e.g. "2/5")
  const taskSummaries = useMemo(() => {
    const map = new Map<string, string>();
    for (const session of sessions) {
      try {
        const path = buildTranscriptPath(session.cwd, session.session_id);
        const tasks = getTasksFromTranscript(path);
        if (tasks && tasks.length > 0) {
          const done = tasks.filter((t) => t.status === 'completed').length;
          map.set(session.session_id, `${done}/${tasks.length}`);
        }
      } catch {
        // Skip failed transcript reads
      }
    }
    return map;
  }, [sessions]);

  const statusCounts = useMemo(
    () =>
      sessions.reduce(
        (counts, session) => {
          counts[session.status]++;
          return counts;
        },
        { running: 0, waiting_input: 0, stopped: 0 }
      ),
    [sessions]
  );

  useInput((input, key) => {
    // Tasks detail view: only back navigation
    if (viewMode === 'tasks') {
      if (input === 's' || key.escape || input === 'q') {
        setViewMode('list');
      }
      return;
    }

    if (viewMode === 'diff') {
      return; // DiffView handles its own input
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
    if (input === 'd') {
      if (sessions[selectedIndex]) {
        setViewMode('diff');
      }
      return;
    }
    if (input === 'm') {
      const session = sessions[selectedIndex];
      if (session) {
        setMarkedSessionIds((prev) => {
          const next = new Set(prev);
          if (next.has(session.session_id)) {
            next.delete(session.session_id);
          } else {
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
    return <Text dimColor>Loading...</Text>;
  }

  if (error) {
    return <Text color="red">Error: {error.message}</Text>;
  }

  const { running, waiting_input: waitingInput, stopped } = statusCounts;

  if (viewMode === 'tasks') {
    const session = sessions[selectedIndex];
    if (session) {
      return <TaskDetailView session={session} tasks={taskData} loading={taskLoading} />;
    }
    // Session gone, fall through to list
  }

  if (viewMode === 'diff') {
    const session = sessions[selectedIndex];
    if (session) {
      return <DiffView session={session} onExit={() => setViewMode('list')} />;
    }
    // Session gone, fall through to list
  }

  return (
    <Box flexDirection="column">
      {/* Main Panel: Header + Sessions */}
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
        {/* Header */}
        <Box>
          <Text bold color="cyan">
            Claude Code Navigator
          </Text>
          <Text dimColor> </Text>
          <Text color="gray">● {running}</Text>
          <Text dimColor> </Text>
          <Text color="yellow">◐ {waitingInput}</Text>
          <Text dimColor> </Text>
          <Text color="green">✓ {stopped}</Text>
        </Box>

        {/* Sessions */}
        <Box flexDirection="column" marginTop={1}>
          {sessions.length === 0 ? (
            <Box>
              <Text dimColor>No active sessions</Text>
            </Box>
          ) : (
            <SessionTable
              sessions={sessions}
              selectedIndex={selectedIndex}
              taskSummaries={taskSummaries}
              markedSessionIds={markedSessionIds}
              now={now}
            />
          )}
        </Box>
      </Box>

      {/* Keyboard Shortcuts */}
      <Box marginTop={1} justifyContent="center" gap={1}>
        <Text dimColor>[↑↓]Select</Text>
        <Text dimColor>[Enter]Focus</Text>
        <Text dimColor>[s]Tasks</Text>
        <Text dimColor>[d]Diff</Text>
        <Text dimColor>[m]Mark</Text>
        <Text dimColor>[1-9]Quick</Text>
        <Text dimColor>[c]Clear</Text>
        {serverEnabled && <Text dimColor>[h]{qrCodeUserPref ? 'Hide' : 'Show'}URL</Text>}
        <Text dimColor>[q]Quit</Text>
      </Box>

      {/* Web UI hint - shown when URL is hidden */}
      {serverEnabled && !serverLoading && url && !qrCodeUserPref && (
        <Box marginTop={1} borderStyle="round" borderColor="gray" paddingX={1}>
          <Text color="white">
            📱 Web UI available. Press [h] to show QR code for mobile access. (Same Wi-Fi required)
          </Text>
        </Box>
      )}

      {/* Web UI - only shown when qrCodeUserPref is true (security: URL contains token) */}
      {serverEnabled && !serverLoading && url && qrCodeUserPref && (
        <Box marginTop={1} paddingX={1}>
          {qrCodeVisible && qrCode && (
            <Box flexShrink={0}>
              <Text>{qrCode}</Text>
            </Box>
          )}
          <Box
            flexDirection="column"
            marginLeft={qrCodeVisible && qrCode ? 2 : 0}
            justifyContent="center"
          >
            <Text bold color="magenta">
              Web UI
            </Text>
            <Text dimColor>{url}</Text>
            <Text dimColor>Scan QR code to monitor sessions from your phone.</Text>
            <Text dimColor>Tap a session to focus its terminal on this Mac.</Text>
            {tailscaleIP && (
              <Text color="green">Tailscale: accessible from anywhere in your Tailnet</Text>
            )}
            <Text color="yellow">Do not share this URL with others.</Text>
            {!canShowQr && <Text color="yellow">Resize window to show QR code</Text>}
          </Box>
        </Box>
      )}
    </Box>
  );
}
