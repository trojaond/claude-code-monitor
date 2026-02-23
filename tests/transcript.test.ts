import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getContextUsageFromTranscript } from '../src/utils/transcript.js';

describe('getContextUsageFromTranscript', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'ccm-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeTranscript(lines: object[]): string {
    const filePath = join(tmpDir, 'test.jsonl');
    writeFileSync(filePath, lines.map((l) => JSON.stringify(l)).join('\n'));
    return filePath;
  }

  it('should return undefined for non-existent file', () => {
    expect(getContextUsageFromTranscript('/tmp/nonexistent.jsonl')).toBeUndefined();
  });

  it('should return undefined for empty file', () => {
    const path = writeTranscript([]);
    expect(getContextUsageFromTranscript(path)).toBeUndefined();
  });

  it('should compute percentage from last assistant message usage', () => {
    const path = writeTranscript([
      {
        type: 'assistant',
        message: {
          model: 'claude-opus-4-6',
          usage: {
            input_tokens: 50000,
            output_tokens: 1000,
            cache_read_input_tokens: 100000,
            cache_creation_input_tokens: 10000,
          },
        },
      },
    ]);
    // (50000 + 100000 + 10000) / 200000 * 100 = 80
    expect(getContextUsageFromTranscript(path)).toBe(80);
  });

  it('should use the last assistant message, not earlier ones', () => {
    const path = writeTranscript([
      {
        type: 'assistant',
        message: {
          model: 'claude-opus-4-6',
          usage: { input_tokens: 10000, output_tokens: 500, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
        },
      },
      {
        type: 'assistant',
        message: {
          model: 'claude-opus-4-6',
          usage: { input_tokens: 40000, output_tokens: 2000, cache_read_input_tokens: 60000, cache_creation_input_tokens: 0 },
        },
      },
    ]);
    // Last message: (40000 + 60000 + 0) / 200000 * 100 = 50
    expect(getContextUsageFromTranscript(path)).toBe(50);
  });

  it('should cap at 100%', () => {
    const path = writeTranscript([
      {
        type: 'assistant',
        message: {
          model: 'claude-opus-4-6',
          usage: { input_tokens: 180000, output_tokens: 5000, cache_read_input_tokens: 50000, cache_creation_input_tokens: 0 },
        },
      },
    ]);
    expect(getContextUsageFromTranscript(path)).toBe(100);
  });

  it('should handle missing usage fields gracefully', () => {
    const path = writeTranscript([
      {
        type: 'assistant',
        message: {
          model: 'claude-opus-4-6',
          usage: { input_tokens: 20000, output_tokens: 500 },
        },
      },
    ]);
    expect(getContextUsageFromTranscript(path)).toBe(10);
  });

  it('should return undefined when no assistant messages exist', () => {
    const path = writeTranscript([
      { type: 'user', message: { role: 'user', content: [{ type: 'text', text: 'hello' }] } },
    ]);
    expect(getContextUsageFromTranscript(path)).toBeUndefined();
  });
});
