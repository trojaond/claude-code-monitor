import type { Task } from '../types/index.js';
/**
 * Parse a transcript JSONL file for task/todo tool calls and return the
 * reconstructed task list. Returns undefined if the file doesn't exist
 * or contains no task-related tool calls.
 */
export declare function getTasksFromTranscript(transcriptPath: string): Task[] | undefined;
//# sourceMappingURL=tasks.d.ts.map