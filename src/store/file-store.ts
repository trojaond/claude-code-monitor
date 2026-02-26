import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { WRITE_DEBOUNCE_MS } from '../constants.js';
import type { HookEvent, Session, SessionStatus, StoreData } from '../types/index.js';
import { getLastAssistantMessage } from '../utils/transcript.js';
import { isTtyAlive } from '../utils/tty-cache.js';

// Re-export for backward compatibility
export { isTtyAlive } from '../utils/tty-cache.js';

const STORE_DIR = join(homedir(), '.claude-navigator');
const STORE_FILE = join(STORE_DIR, 'sessions.json');
const STORE_LOCK_FILE = join(STORE_DIR, 'sessions.json.lock');
const SETTINGS_FILE = join(STORE_DIR, 'settings.json');

export interface Settings {
  qrCodeVisible: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  qrCodeVisible: false,
};

// In-memory cache for batched writes
let cachedStore: StoreData | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;

function ensureStoreDir(): void {
  if (!existsSync(STORE_DIR)) {
    mkdirSync(STORE_DIR, { recursive: true, mode: 0o700 });
  }
}

/**
 * Acquire an advisory file lock using O_EXCL (atomic on POSIX).
 * Returns true if the lock was acquired, false if another process holds it.
 * Automatically removes stale locks from crashed processes.
 */
function acquireLock(): boolean {
  try {
    // Try to create lock file exclusively
    const fd = openSync(STORE_LOCK_FILE, 'wx', 0o600);
    // Write PID for stale lock detection
    writeFileSync(fd, `${process.pid}\n`, 'utf-8');
    closeSync(fd);
    return true;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
      return false;
    }
    // Lock file exists — check if it's stale
    try {
      const stat = readFileSync(STORE_LOCK_FILE, 'utf-8');
      const lockPid = Number.parseInt(stat.trim(), 10);
      // Check if the process is still alive
      if (lockPid && !Number.isNaN(lockPid)) {
        try {
          process.kill(lockPid, 0); // Signal 0 = check existence
          // Process is alive, lock is valid — give up
          return false;
        } catch {
          // Process is dead, lock is stale — remove it
        }
      }
    } catch {
      // Can't read lock file — check age as fallback
    }
    // Remove stale lock and retry once
    try {
      unlinkSync(STORE_LOCK_FILE);
      const fd = openSync(STORE_LOCK_FILE, 'wx', 0o600);
      writeFileSync(fd, `${process.pid}\n`, 'utf-8');
      closeSync(fd);
      return true;
    } catch {
      return false;
    }
  }
}

function releaseLock(): void {
  try {
    unlinkSync(STORE_LOCK_FILE);
  } catch {
    // Lock already removed — acceptable
  }
}

/**
 * Atomically write data to a file using temp file + rename.
 * On POSIX systems, rename() is atomic within the same filesystem.
 */
function atomicWriteFileSync(filePath: string, data: string, mode: number): void {
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  writeFileSync(tmpPath, data, { encoding: 'utf-8', mode });
  renameSync(tmpPath, filePath);
}

function getEmptyStoreData(): StoreData {
  return {
    sessions: {},
    updated_at: new Date().toISOString(),
  };
}

export function readStore(): StoreData {
  if (cachedStore) {
    return cachedStore;
  }

  ensureStoreDir();
  if (!existsSync(STORE_FILE)) {
    return getEmptyStoreData();
  }
  try {
    const content = readFileSync(STORE_FILE, 'utf-8');
    return JSON.parse(content) as StoreData;
  } catch {
    return getEmptyStoreData();
  }
}

function flushWrite(): void {
  if (cachedStore) {
    try {
      ensureStoreDir();
      cachedStore.updated_at = new Date().toISOString();
      const locked = acquireLock();
      try {
        atomicWriteFileSync(STORE_FILE, JSON.stringify(cachedStore), 0o600);
      } finally {
        if (locked) releaseLock();
      }
    } catch {
      // Silently ignore write errors to avoid crashing the hook process
      // Data loss is acceptable as session data is ephemeral
    } finally {
      cachedStore = null;
      writeTimer = null;
    }
  } else {
    writeTimer = null;
  }
}

export function writeStore(data: StoreData): void {
  cachedStore = data;

  // Cancel previous timer and schedule new write
  if (writeTimer) {
    clearTimeout(writeTimer);
  }
  writeTimer = setTimeout(flushWrite, WRITE_DEBOUNCE_MS);
}

/** Immediately flush any pending writes (useful for testing and cleanup) */
export function flushPendingWrites(): void {
  if (writeTimer) {
    clearTimeout(writeTimer);
    flushWrite();
  }
}

/** Reset the in-memory cache (useful for testing) */
export function resetStoreCache(): void {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  cachedStore = null;
}

/** @internal */
export function getSessionKey(sessionId: string, tty?: string): string {
  return tty ? `${sessionId}:${tty}` : sessionId;
}

/** @internal */
export function removeOldSessionsOnSameTty(
  sessions: Record<string, Session>,
  newSessionId: string,
  tty: string
): void {
  for (const [key, session] of Object.entries(sessions)) {
    if (session.tty === tty && session.session_id !== newSessionId) {
      delete sessions[key];
    }
  }
}

/** @internal */
export function determineStatus(event: HookEvent, currentStatus?: SessionStatus): SessionStatus {
  // Explicit stop event
  if (event.hook_event_name === 'Stop') {
    return 'stopped';
  }

  // UserPromptSubmit starts a new operation, so resume even if stopped
  if (event.hook_event_name === 'UserPromptSubmit') {
    return 'running';
  }

  // Keep stopped state (don't resume except for UserPromptSubmit)
  if (currentStatus === 'stopped') {
    return 'stopped';
  }

  // Active operation event
  if (event.hook_event_name === 'PreToolUse') {
    return 'running';
  }

  // Waiting for permission prompt
  const isPermissionPrompt =
    event.hook_event_name === 'Notification' && event.notification_type === 'permission_prompt';
  if (isPermissionPrompt) {
    return 'waiting_input';
  }

  // Default: running for other events (PostToolUse, etc.)
  return 'running';
}

export function updateSession(event: HookEvent): Session {
  const store = readStore();
  const key = getSessionKey(event.session_id, event.tty);
  const now = new Date().toISOString();

  // Remove old session if a different session exists on the same TTY
  // (e.g., when a new session starts after /clear)
  if (event.tty) {
    removeOldSessionsOnSameTty(store.sessions, event.session_id, event.tty);
  }

  const existing = store.sessions[key];

  // Get latest assistant message from transcript
  const assistantMessage = event.transcript_path
    ? getLastAssistantMessage(event.transcript_path)
    : undefined;
  const lastMessage = assistantMessage ?? existing?.lastMessage;

  const session: Session = {
    session_id: event.session_id,
    cwd: event.cwd,
    tty: event.tty ?? existing?.tty,
    status: determineStatus(event, existing?.status),
    created_at: existing?.created_at ?? now,
    updated_at: now,
    lastMessage,
    terminal: event.terminal ?? existing?.terminal,
    model: event.model ?? existing?.model,
    costUSD: event.costUSD ?? existing?.costUSD,
    contextPercent: event.contextPercent ?? existing?.contextPercent,
    lastPrompt: event.lastPrompt ?? existing?.lastPrompt,
  };

  store.sessions[key] = session;
  writeStore(store);

  return session;
}

export function getSessions(): Session[] {
  const store = readStore();

  // Filter out dead-TTY sessions from the result without writing to disk.
  // Cleanup is handled separately by cleanupDeadSessions() to avoid
  // triggering chokidar → loadSessions → getSessions write loops.
  const liveSessions = Object.values(store.sessions).filter((session) => isTtyAlive(session.tty));

  return liveSessions.sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

/**
 * Remove sessions whose TTY no longer exists from the store.
 * Call this on a timer rather than inside getSessions() to avoid
 * write → chokidar → read → write loops.
 */
export function cleanupDeadSessions(): void {
  const store = readStore();

  let hasChanges = false;
  for (const [key, session] of Object.entries(store.sessions)) {
    if (!isTtyAlive(session.tty)) {
      delete store.sessions[key];
      hasChanges = true;
    }
  }

  if (hasChanges) {
    writeStore(store);
  }
}

export function getSession(sessionId: string, tty?: string): Session | undefined {
  const store = readStore();
  const key = getSessionKey(sessionId, tty);
  return store.sessions[key];
}

export function removeSession(sessionId: string, tty?: string): void {
  const store = readStore();
  const key = getSessionKey(sessionId, tty);
  delete store.sessions[key];
  writeStore(store);
}

export function clearSessions(): void {
  writeStore(getEmptyStoreData());
}

export function deleteSessionsByIds(sessionIds: Set<string>): void {
  const store = readStore();
  for (const [key, session] of Object.entries(store.sessions)) {
    if (sessionIds.has(session.session_id)) {
      delete store.sessions[key];
    }
  }
  writeStore(store);
}

export function getStorePath(): string {
  return STORE_FILE;
}

export function readSettings(): Settings {
  ensureStoreDir();
  if (!existsSync(SETTINGS_FILE)) {
    return DEFAULT_SETTINGS;
  }
  try {
    const content = readFileSync(SETTINGS_FILE, 'utf-8');
    const parsed = JSON.parse(content) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function writeSettings(settings: Settings): void {
  ensureStoreDir();
  try {
    atomicWriteFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 0o600);
  } catch {
    // Silently ignore write errors
  }
}
