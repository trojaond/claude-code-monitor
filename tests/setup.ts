import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, vi } from 'vitest';

export const TEST_STORE_DIR = join(tmpdir(), 'claude-navigator-test');
export const TEST_STORE_FILE = join(TEST_STORE_DIR, 'sessions.json');

afterEach(() => {
  vi.restoreAllMocks();

  // Clean up test store directory after each test
  if (existsSync(TEST_STORE_DIR)) {
    rmSync(TEST_STORE_DIR, { recursive: true, force: true });
  }
});
