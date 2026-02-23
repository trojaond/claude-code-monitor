import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getTasksFromTranscript } from '../src/utils/tasks.js';

function assistantMessage(contentBlocks: unknown[]): string {
  return JSON.stringify({
    type: 'assistant',
    message: { content: contentBlocks },
  });
}

function toolUse(name: string, input: Record<string, unknown>): unknown {
  return { type: 'tool_use', id: 'tu_1', name, input };
}

describe('getTasksFromTranscript', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `tasks-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns undefined for non-existent file', () => {
    expect(getTasksFromTranscript('/nonexistent/path.jsonl')).toBeUndefined();
  });

  it('returns undefined for empty path', () => {
    expect(getTasksFromTranscript('')).toBeUndefined();
  });

  it('returns undefined for transcript with no task tools', () => {
    const file = join(tmpDir, 'no-tasks.jsonl');
    writeFileSync(
      file,
      [
        assistantMessage([{ type: 'text', text: 'Hello!' }]),
        assistantMessage([toolUse('Read', { file_path: '/foo.ts' })]),
      ].join('\n')
    );
    expect(getTasksFromTranscript(file)).toBeUndefined();
  });

  // --- TodoWrite ---

  it('parses TodoWrite todos correctly', () => {
    const file = join(tmpDir, 'todowrite.jsonl');
    writeFileSync(
      file,
      assistantMessage([
        toolUse('TodoWrite', {
          todos: [
            { id: '1', content: 'Fix auth bug', status: 'completed' },
            { id: '2', content: 'Add validation', status: 'in_progress' },
            { id: '3', content: 'Write docs', status: 'pending' },
          ],
        }),
      ])
    );

    const tasks = getTasksFromTranscript(file);
    expect(tasks).toHaveLength(3);
    expect(tasks?.[0]).toEqual({ id: '1', subject: 'Fix auth bug', status: 'completed' });
    expect(tasks?.[1]).toEqual({ id: '2', subject: 'Add validation', status: 'in_progress' });
    expect(tasks?.[2]).toEqual({ id: '3', subject: 'Write docs', status: 'pending' });
  });

  it('uses last TodoWrite when multiple exist', () => {
    const file = join(tmpDir, 'multi-todowrite.jsonl');
    writeFileSync(
      file,
      [
        assistantMessage([
          toolUse('TodoWrite', {
            todos: [{ id: '1', content: 'Old task', status: 'pending' }],
          }),
        ]),
        assistantMessage([
          toolUse('TodoWrite', {
            todos: [
              { id: '1', content: 'Updated task', status: 'completed' },
              { id: '2', content: 'New task', status: 'pending' },
            ],
          }),
        ]),
      ].join('\n')
    );

    const tasks = getTasksFromTranscript(file);
    expect(tasks).toHaveLength(2);
    expect(tasks?.[0]).toEqual({ id: '1', subject: 'Updated task', status: 'completed' });
    expect(tasks?.[1]).toEqual({ id: '2', subject: 'New task', status: 'pending' });
  });

  // --- TaskCreate / TaskUpdate ---

  it('parses TaskCreate into tasks with auto-IDs', () => {
    const file = join(tmpDir, 'taskcreate.jsonl');
    writeFileSync(
      file,
      [
        assistantMessage([
          toolUse('TaskCreate', { subject: 'Build API', description: 'REST endpoints' }),
        ]),
        assistantMessage([
          toolUse('TaskCreate', { subject: 'Write tests', description: 'Unit tests' }),
        ]),
      ].join('\n')
    );

    const tasks = getTasksFromTranscript(file);
    expect(tasks).toHaveLength(2);
    expect(tasks?.[0]).toEqual({
      id: '1',
      subject: 'Build API',
      description: 'REST endpoints',
      status: 'pending',
    });
    expect(tasks?.[1]).toEqual({
      id: '2',
      subject: 'Write tests',
      description: 'Unit tests',
      status: 'pending',
    });
  });

  it('applies TaskUpdate status changes', () => {
    const file = join(tmpDir, 'taskupdate.jsonl');
    writeFileSync(
      file,
      [
        assistantMessage([toolUse('TaskCreate', { subject: 'Task A' })]),
        assistantMessage([toolUse('TaskCreate', { subject: 'Task B' })]),
        assistantMessage([toolUse('TaskUpdate', { taskId: '1', status: 'in_progress' })]),
        assistantMessage([toolUse('TaskUpdate', { taskId: '1', status: 'completed' })]),
      ].join('\n')
    );

    const tasks = getTasksFromTranscript(file);
    expect(tasks).toHaveLength(2);
    expect(tasks?.[0].status).toBe('completed');
    expect(tasks?.[1].status).toBe('pending');
  });

  it('filters out deleted tasks', () => {
    const file = join(tmpDir, 'taskdelete.jsonl');
    writeFileSync(
      file,
      [
        assistantMessage([toolUse('TaskCreate', { subject: 'Keep me' })]),
        assistantMessage([toolUse('TaskCreate', { subject: 'Delete me' })]),
        assistantMessage([toolUse('TaskUpdate', { taskId: '2', status: 'deleted' })]),
      ].join('\n')
    );

    const tasks = getTasksFromTranscript(file);
    expect(tasks).toHaveLength(1);
    expect(tasks?.[0].subject).toBe('Keep me');
  });

  // --- Status normalization ---

  it('normalizes status strings', () => {
    const file = join(tmpDir, 'normalize.jsonl');
    writeFileSync(
      file,
      assistantMessage([
        toolUse('TodoWrite', {
          todos: [
            { id: '1', content: 'Done task', status: 'done' },
            { id: '2', content: 'Progress task', status: 'in-progress' },
            { id: '3', content: 'Pending task', status: 'pending' },
          ],
        }),
      ])
    );

    const tasks = getTasksFromTranscript(file);
    expect(tasks?.[0].status).toBe('completed');
    expect(tasks?.[1].status).toBe('in_progress');
    expect(tasks?.[2].status).toBe('pending');
  });

  // --- Edge cases ---

  it('handles malformed JSON lines gracefully', () => {
    const file = join(tmpDir, 'malformed.jsonl');
    writeFileSync(
      file,
      [
        'not json at all',
        '{"broken": true',
        assistantMessage([toolUse('TaskCreate', { subject: 'Valid task' })]),
      ].join('\n')
    );

    const tasks = getTasksFromTranscript(file);
    expect(tasks).toHaveLength(1);
    expect(tasks?.[0].subject).toBe('Valid task');
  });

  it('prefers TaskCreate/TaskUpdate over TodoWrite when both present', () => {
    const file = join(tmpDir, 'mixed.jsonl');
    writeFileSync(
      file,
      [
        assistantMessage([
          toolUse('TodoWrite', {
            todos: [{ id: '1', content: 'Old todo', status: 'pending' }],
          }),
        ]),
        assistantMessage([toolUse('TaskCreate', { subject: 'New task' })]),
      ].join('\n')
    );

    const tasks = getTasksFromTranscript(file);
    expect(tasks).toHaveLength(1);
    expect(tasks?.[0].subject).toBe('New task');
  });
});
