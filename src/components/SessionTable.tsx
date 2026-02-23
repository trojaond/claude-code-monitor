import { Box, Text } from 'ink';
import type React from 'react';
import { memo } from 'react';
import type { Session } from '../types/index.js';
import { getStatusDisplay } from '../utils/status.js';
import { formatRelativeTimeShort } from '../utils/time.js';

interface SessionTableProps {
  sessions: Session[];
  selectedIndex: number;
  taskSummaries: Map<string, string>;
  markedSessionIds: Set<string>;
  now: number;
}

function abbreviateHomePath(path: string | undefined): string {
  if (!path) return '(unknown)';
  return path.replace(/^\/Users\/[^/]+/, '~');
}

function getTerminalColor(terminal: string): string {
  const lower = terminal.toLowerCase();
  if (lower.includes('iterm')) return 'green';
  if (lower.includes('vscode') || lower.includes('vs code')) return 'blue';
  if (lower.includes('ghostty')) return 'magenta';
  if (lower.includes('terminal')) return 'white';
  return 'gray';
}

function formatModelShort(model: string | undefined): string {
  if (!model) return '';
  return model.replace(/^claude-/, '');
}

function formatCost(cost: number | undefined): string {
  if (cost === undefined) return '';
  return `$${cost.toFixed(2)}`;
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return `${str.slice(0, max - 1)}\u2026`;
}

/** Format time since last status change: exact seconds when <60s, then minutes */
function formatLastChange(timestamp: string, now: number): string {
  const diffMs = now - new Date(timestamp).getTime();
  const seconds = Math.max(0, Math.floor(diffMs / 1000));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

// Column widths
const COL_STATUS = 12;
const COL_TERMINAL = 13;
const COL_MODEL = 12;
const COL_COST = 7;
const COL_TASKS = 6;
const COL_LAST = 6;
const COL_AGE = 6;

export const SessionTable = memo(function SessionTable({
  sessions,
  selectedIndex,
  taskSummaries,
  markedSessionIds,
  now,
}: SessionTableProps): React.ReactElement {
  return (
    <Box flexDirection="column">
      {/* Header row */}
      <Box>
        <Box width={4}>
          <Text bold dimColor>
            {'  # '}
          </Text>
        </Box>
        <Box width={COL_STATUS}>
          <Text bold dimColor>
            STATUS
          </Text>
        </Box>
        <Box flexGrow={1}>
          <Text bold dimColor>
            CWD
          </Text>
        </Box>
        <Box width={COL_TERMINAL}>
          <Text bold dimColor>
            TERMINAL
          </Text>
        </Box>
        <Box width={COL_MODEL}>
          <Text bold dimColor>
            MODEL
          </Text>
        </Box>
        <Box width={COL_COST}>
          <Text bold dimColor>
            COST
          </Text>
        </Box>
        <Box width={COL_TASKS}>
          <Text bold dimColor>
            TASKS
          </Text>
        </Box>
        <Box width={COL_LAST}>
          <Text bold dimColor>
            LAST
          </Text>
        </Box>
        <Box width={COL_AGE}>
          <Text bold dimColor>
            AGE
          </Text>
        </Box>
      </Box>

      {/* Data rows */}
      {sessions.map((session, index) => {
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

        return (
          <Box key={`${session.session_id}:${session.tty || ''}`}>
            <Box width={4}>
              <Text color={isSelected ? 'cyan' : undefined} bold={isSelected} backgroundColor={bg}>
                {isSelected ? '>' : ' '}
                {index + 1}{' '}
              </Text>
            </Box>
            <Box width={COL_STATUS}>
              <Text color={color} backgroundColor={bg}>
                {symbol} {label}
              </Text>
            </Box>
            <Box flexGrow={1}>
              <Text color={isSelected ? 'white' : 'gray'} backgroundColor={bg}>
                {cwd}
              </Text>
            </Box>
            <Box width={COL_TERMINAL}>
              <Text
                color={terminal ? getTerminalColor(terminal) : undefined}
                backgroundColor={bg}
              >
                {truncate(terminal, COL_TERMINAL)}
              </Text>
            </Box>
            <Box width={COL_MODEL}>
              <Text dimColor={!isMarked} backgroundColor={bg}>
                {truncate(model, COL_MODEL)}
              </Text>
            </Box>
            <Box width={COL_COST}>
              <Text color={cost ? 'yellow' : undefined} backgroundColor={bg}>
                {cost}
              </Text>
            </Box>
            <Box width={COL_TASKS}>
              <Text color={tasks ? 'cyan' : undefined} backgroundColor={bg}>
                {tasks}
              </Text>
            </Box>
            <Box width={COL_LAST}>
              <Text dimColor={!isMarked} backgroundColor={bg}>
                {last}
              </Text>
            </Box>
            <Box width={COL_AGE}>
              <Text dimColor={!isMarked} backgroundColor={bg}>
                {age}
              </Text>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
});
