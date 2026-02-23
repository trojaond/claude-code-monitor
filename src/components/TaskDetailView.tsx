import { Box, Text } from 'ink';
import type React from 'react';
import type { Session, Task } from '../types/index.js';

interface TaskDetailViewProps {
  session: Session;
  tasks: Task[] | undefined;
  loading: boolean;
}

function abbreviateHomePath(path: string | undefined): string {
  if (!path) return '(unknown)';
  return path.replace(/^\/Users\/[^/]+/, '~');
}

function statusIndicator(status: string): { symbol: string; color: string } {
  switch (status) {
    case 'completed':
      return { symbol: '[x]', color: 'green' };
    case 'in_progress':
      return { symbol: '[~]', color: 'yellow' };
    default:
      return { symbol: '[ ]', color: 'gray' };
  }
}

export function TaskDetailView({
  session,
  tasks,
  loading,
}: TaskDetailViewProps): React.ReactElement {
  const dir = abbreviateHomePath(session.cwd);
  const completedCount = tasks?.filter((t) => t.status === 'completed').length ?? 0;
  const totalCount = tasks?.length ?? 0;

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
        <Box>
          <Text bold color="cyan">
            Tasks
          </Text>
          <Text dimColor> - </Text>
          <Text color="gray">{dir}</Text>
        </Box>

        <Box flexDirection="column" marginTop={1}>
          {loading ? (
            <Text dimColor>Loading tasks...</Text>
          ) : !tasks || tasks.length === 0 ? (
            <Text dimColor>No tasks found in transcript</Text>
          ) : (
            <>
              <Text dimColor>
                Progress: {completedCount}/{totalCount} completed
              </Text>
              <Box flexDirection="column" marginTop={1}>
                {tasks.map((task) => {
                  const { symbol, color } = statusIndicator(task.status);
                  const isCompleted = task.status === 'completed';
                  return (
                    <Box key={task.id} paddingX={1}>
                      <Text color={color}>{symbol}</Text>
                      <Text> </Text>
                      <Text dimColor={isCompleted}>{task.subject}</Text>
                    </Box>
                  );
                })}
              </Box>
            </>
          )}
        </Box>
      </Box>

      <Box marginTop={1} justifyContent="center" gap={1}>
        <Text dimColor>[s/Esc]Back</Text>
      </Box>
    </Box>
  );
}
