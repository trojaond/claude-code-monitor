import { Box, Text } from 'ink';
import type React from 'react';
import { memo } from 'react';
import type { Session } from '../types/index.js';
import { getStatusDisplay } from '../utils/status.js';
import { formatRelativeTime } from '../utils/time.js';

interface SessionCardProps {
  session: Session;
  index: number;
  isSelected: boolean;
  taskSummary?: string; // e.g. "2/5"
}

function abbreviateHomePath(path: string | undefined): string {
  if (!path) return '(unknown)';
  return path.replace(/^\/Users\/[^/]+/, '~');
}

/** Color for each known terminal app */
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

export const SessionCard = memo(function SessionCard({
  session,
  index,
  isSelected,
  taskSummary,
}: SessionCardProps): React.ReactElement {
  const { symbol, color, label } = getStatusDisplay(session.status);
  const dir = abbreviateHomePath(session.cwd);
  const startedAt = formatRelativeTime(session.created_at);
  const modelShort = formatModelShort(session.model);
  const cost = formatCost(session.costUSD);

  // Build right-side metadata segments
  const meta: Array<{ text: string; color?: string }> = [];
  if (session.terminal) {
    meta.push({ text: session.terminal, color: getTerminalColor(session.terminal) });
  }
  if (modelShort) meta.push({ text: modelShort });
  if (cost) meta.push({ text: cost, color: 'yellow' });
  if (taskSummary) meta.push({ text: `${taskSummary} tasks`, color: 'cyan' });
  meta.push({ text: startedAt });

  return (
    <Box paddingX={1}>
      <Text color={isSelected ? 'cyan' : undefined} bold={isSelected}>
        {isSelected ? '>' : ' '} [{index + 1}]
      </Text>
      <Text> </Text>
      <Box width={10}>
        <Text color={color}>
          {symbol} {label}
        </Text>
      </Box>
      <Text> </Text>
      <Text color={isSelected ? 'white' : 'gray'}>{dir}</Text>
      <Text dimColor>{'  '}</Text>
      {meta.map((m, i) => (
        <Text key={m.text} color={m.color} dimColor={!m.color}>
          {i > 0 ? ' · ' : ''}
          {m.text}
        </Text>
      ))}
    </Box>
  );
});
