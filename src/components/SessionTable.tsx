import { Box, Text, useStdout } from 'ink';
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

function getContextBarColor(percent: number): string {
  if (percent >= 80) return 'red';
  if (percent >= 50) return 'yellow';
  return 'green';
}

function renderContextBar(percent: number): string {
  const BAR_WIDTH = 8;
  const filled = Math.round((percent / 100) * BAR_WIDTH);
  const empty = BAR_WIDTH - filled;
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
  const pct = `${percent}%`.padStart(4);
  return `${bar}${pct}`;
}

/** Seconds elapsed since last state change */
function secSince(updatedAt: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(updatedAt).getTime()) / 1000));
}

/**
 * Indicator character for the index column.
 * Priority: selected (>) > recently changed (◆/◇/●) > marked (★) > normal ( )
 */
function rowIndicator(sec: number, isSelected: boolean, isMarked: boolean, tick: number): string {
  if (isSelected) return '>';
  if (sec < 5) return tick % 2 === 0 ? '\u25c6' : '\u25c7'; // ◆ / ◇
  if (sec < 20) return '\u25cf'; // ●
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

// Total of all fixed-width columns (index col=4 + rest)
const COL_IDX = 4;
const FIXED_COLS_TOTAL =
  COL_IDX +
  COL_STATUS +
  COL_TERMINAL +
  COL_MODEL +
  COL_COST +
  COL_CTX +
  COL_TASKS +
  COL_LAST +
  COL_AGE;
// Dashboard outer box: round border (2) + paddingX={1} (2) = 4 overhead chars
const DASH_OVERHEAD = 4;

export const SessionTable = memo(function SessionTable({
  sessions,
  selectedIndex,
  taskSummaries,
  markedSessionIds,
  now,
}: SessionTableProps): React.ReactElement {
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns ?? 120;
  const contentWidth = Math.max(40, terminalWidth - DASH_OVERHEAD);
  const flexColWidth = Math.max(8, Math.floor((contentWidth - FIXED_COLS_TOTAL) / 2));
  const tick = Math.floor(now / 1000);

  return (
    <Box flexDirection="column">
      {/* Header row */}
      <Box>
        <Box width={COL_IDX}>
          <Text bold dimColor>
            {'  # '}
          </Text>
        </Box>
        <Box width={COL_STATUS}>
          <Text bold dimColor>
            STATUS
          </Text>
        </Box>
        <Box flexGrow={1} flexBasis={0}>
          <Text bold dimColor>
            CWD
          </Text>
        </Box>
        <Box flexGrow={1} flexBasis={0}>
          <Text bold dimColor>
            LAST PROMPT
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
        <Box width={COL_CTX}>
          <Text bold dimColor>
            CTX USAGE
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
        const sec = secSince(session.updated_at, now);
        const indicator = rowIndicator(sec, isSelected, isMarked, tick);
        const isRecent = sec < 20;

        // Marked rows: single padded Text for true full-row blue highlight
        if (isMarked) {
          const pad = (s: string, w: number) => s.slice(0, w).padEnd(w);
          const ctxStr =
            session.contextPercent !== undefined
              ? renderContextBar(session.contextPercent)
              : '\u2014';
          const rowStr = [
            pad(`${indicator} ${index + 1} `, COL_IDX),
            pad(`${symbol} ${label}`, COL_STATUS),
            pad(truncate(cwd, flexColWidth), flexColWidth),
            pad(truncate(session.lastPrompt ?? '', flexColWidth), flexColWidth),
            pad(truncate(terminal, COL_TERMINAL), COL_TERMINAL),
            pad(truncate(model, COL_MODEL), COL_MODEL),
            pad(cost, COL_COST),
            pad(ctxStr, COL_CTX),
            pad(tasks, COL_TASKS),
            pad(last, COL_LAST),
            pad(age, COL_AGE),
          ]
            .join('')
            .replace(/\r?\n|\r/g, ' ')
            .slice(0, contentWidth - 1)
            .padEnd(contentWidth - 1);

          return (
            <Box key={`${session.session_id}:${session.tty || ''}`}>
              <Text backgroundColor="blue" bold={isSelected || (isRecent && sec < 5)}>
                {rowStr}
              </Text>
            </Box>
          );
        }

        // Normal (unmarked) row
        return (
          <Box key={`${session.session_id}:${session.tty || ''}`}>
            {/* Index + indicator (Option B: animated on recent change) */}
            <Box width={COL_IDX}>
              <Text
                color={isSelected ? 'cyan' : isRecent ? 'yellow' : undefined}
                bold={isSelected || (isRecent && sec < 5)}
                dimColor={!isSelected && sec >= 5 && sec < 20}
              >
                {indicator}
                {index + 1}{' '}
              </Text>
            </Box>
            {/* Status: keep its own semantic color */}
            <Box width={COL_STATUS}>
              <Text color={color}>
                {symbol} {label}
              </Text>
            </Box>
            {/* CWD (Option A: yellow on recent change) */}
            <Box flexGrow={1} flexBasis={0}>
              <Text
                color={isSelected ? 'white' : isRecent ? 'yellow' : 'gray'}
                bold={isRecent && sec < 5}
                dimColor={!isSelected && !isRecent && false}
                wrap="truncate"
              >
                {cwd}
              </Text>
            </Box>
            {/* Last prompt (Option A) */}
            <Box flexGrow={1} flexBasis={0}>
              <Text
                color={isRecent ? 'yellow' : undefined}
                bold={isRecent && sec < 5}
                dimColor={!isRecent}
                wrap="truncate"
              >
                {session.lastPrompt ?? ''}
              </Text>
            </Box>
            {/* Terminal: keep semantic color */}
            <Box width={COL_TERMINAL}>
              <Text color={terminal ? getTerminalColor(terminal) : undefined}>
                {truncate(terminal, COL_TERMINAL)}
              </Text>
            </Box>
            {/* Model (Option A) */}
            <Box width={COL_MODEL}>
              <Text
                color={isRecent ? 'yellow' : undefined}
                bold={isRecent && sec < 5}
                dimColor={!isRecent}
              >
                {truncate(model, COL_MODEL)}
              </Text>
            </Box>
            {/* Cost: keep semantic color */}
            <Box width={COL_COST}>
              <Text color={cost ? 'yellow' : undefined}>{cost}</Text>
            </Box>
            {/* CTX: keep semantic color */}
            <Box width={COL_CTX}>
              {session.contextPercent !== undefined ? (
                <Text color={getContextBarColor(session.contextPercent)}>
                  {renderContextBar(session.contextPercent)}
                </Text>
              ) : (
                <Text dimColor>{'\u2014'}</Text>
              )}
            </Box>
            {/* Tasks: keep semantic color */}
            <Box width={COL_TASKS}>
              <Text color={tasks ? 'cyan' : undefined}>{tasks}</Text>
            </Box>
            {/* Last (Option A) */}
            <Box width={COL_LAST}>
              <Text
                color={isRecent ? 'yellow' : undefined}
                bold={isRecent && sec < 5}
                dimColor={!isRecent}
              >
                {last}
              </Text>
            </Box>
            {/* Age (Option A) */}
            <Box width={COL_AGE}>
              <Text dimColor={!isRecent} color={isRecent ? 'yellow' : undefined}>
                {age}
              </Text>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
});
