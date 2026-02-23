import { existsSync, readFileSync } from 'node:fs';
import type { Task, TaskStatus } from '../types/index.js';

interface ToolUseBlock {
  type: 'tool_use';
  name: string;
  input: Record<string, unknown>;
}

interface ContentBlock {
  type: string;
  name?: string;
  input?: Record<string, unknown>;
}

/** Normalize various status strings to our TaskStatus type. */
function normalizeStatus(raw: unknown): TaskStatus {
  if (typeof raw !== 'string') return 'pending';
  const lower = raw.toLowerCase().replace(/[-_\s]/g, '_');
  if (lower === 'done' || lower === 'completed') return 'completed';
  if (lower === 'in_progress' || lower === 'in progress') return 'in_progress';
  return 'pending';
}

/**
 * Parse a transcript JSONL file for task/todo tool calls and return the
 * reconstructed task list. Returns undefined if the file doesn't exist
 * or contains no task-related tool calls.
 */
export function getTasksFromTranscript(transcriptPath: string): Task[] | undefined {
  if (!transcriptPath || !existsSync(transcriptPath)) {
    return undefined;
  }

  try {
    const content = readFileSync(transcriptPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    // Collect all tool_use blocks from assistant messages
    const toolUseBlocks: ToolUseBlock[] = [];

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.type === 'assistant' && entry.message?.content) {
          const contentBlocks = entry.message.content as ContentBlock[];
          for (const block of contentBlocks) {
            if (
              block.type === 'tool_use' &&
              block.name &&
              block.input &&
              (block.name === 'TodoWrite' ||
                block.name === 'TaskCreate' ||
                block.name === 'TaskUpdate')
            ) {
              toolUseBlocks.push(block as ToolUseBlock);
            }
          }
        }
      } catch {
        // Skip malformed JSON lines
      }
    }

    if (toolUseBlocks.length === 0) return undefined;

    const hasTodoWrite = toolUseBlocks.some((b) => b.name === 'TodoWrite');
    const hasTaskCreateUpdate = toolUseBlocks.some(
      (b) => b.name === 'TaskCreate' || b.name === 'TaskUpdate'
    );

    // Prefer TaskCreate/TaskUpdate if present
    if (hasTaskCreateUpdate) {
      return parseTaskCreateUpdate(toolUseBlocks);
    }
    if (hasTodoWrite) {
      return parseTodoWrite(toolUseBlocks);
    }

    return undefined;
  } catch {
    return undefined;
  }
}

/** Parse TodoWrite calls — take the last call's full list as final state. */
function parseTodoWrite(blocks: ToolUseBlock[]): Task[] | undefined {
  let lastTodos: ToolUseBlock | undefined;

  for (const block of blocks) {
    if (block.name === 'TodoWrite') {
      lastTodos = block;
    }
  }

  if (!lastTodos) return undefined;

  const todos = lastTodos.input.todos as
    | Array<{ id?: string; content?: string; status?: string }>
    | undefined;

  if (!Array.isArray(todos) || todos.length === 0) return undefined;

  return todos.map((todo, index) => ({
    id: String(todo.id ?? index + 1),
    subject: String(todo.content ?? ''),
    status: normalizeStatus(todo.status),
  }));
}

/** Parse TaskCreate/TaskUpdate calls — build task map and apply updates. */
function parseTaskCreateUpdate(blocks: ToolUseBlock[]): Task[] | undefined {
  const tasks = new Map<string, Task>();
  let autoId = 1;

  for (const block of blocks) {
    if (block.name === 'TaskCreate') {
      const id = String(autoId++);
      tasks.set(id, {
        id,
        subject: String(block.input.subject ?? ''),
        description: block.input.description ? String(block.input.description) : undefined,
        status: normalizeStatus(block.input.status ?? 'pending'),
      });
    } else if (block.name === 'TaskUpdate') {
      const taskId = String(block.input.taskId ?? '');
      const existing = tasks.get(taskId);
      if (existing) {
        // Check for deletion
        if (block.input.status === 'deleted') {
          tasks.delete(taskId);
          continue;
        }
        if (block.input.status !== undefined) {
          existing.status = normalizeStatus(block.input.status);
        }
        if (block.input.subject !== undefined) {
          existing.subject = String(block.input.subject);
        }
        if (block.input.description !== undefined) {
          existing.description = String(block.input.description);
        }
      }
    }
  }

  const result = Array.from(tasks.values());
  return result.length > 0 ? result : undefined;
}
