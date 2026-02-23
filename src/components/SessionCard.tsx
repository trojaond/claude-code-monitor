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
}

function abbreviateHomePath(path: string | undefined): string {
  if (!path) return '(unknown)';
  return path.replace(/^\/Users\/[^/]+/, '~');
}

function formatModelShort(model: string | undefined): string {
  if (!model) return '';
  // Strip "claude-" prefix to save space: "claude-opus-4-6" -> "opus-4-6"
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
}: SessionCardProps): React.ReactElement {
  const { symbol, color, label } = getStatusDisplay(session.status);
  const dir = abbreviateHomePath(session.cwd);
  const relativeTime = formatRelativeTime(session.updated_at);
  const modelShort = formatModelShort(session.model);
  const cost = formatCost(session.costUSD);

  // Build metadata parts: terminal, model, cost
  const metaParts: string[] = [];
  if (session.terminal) metaParts.push(session.terminal);
  if (modelShort) metaParts.push(modelShort);
  if (cost) metaParts.push(cost);
  const metaLine = metaParts.join('  ');

  return (
    <Box flexDirection="column">
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
        <Text dimColor>{relativeTime.padEnd(8)}</Text>
        <Text color={isSelected ? 'white' : 'gray'}>{dir}</Text>
      </Box>
      {metaLine && (
        <Box paddingX={1}>
          <Text>{'       '}</Text>
          <Text dimColor>{metaLine}</Text>
        </Box>
      )}
    </Box>
  );
});
