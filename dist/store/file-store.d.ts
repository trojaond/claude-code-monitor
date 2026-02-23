import type { HookEvent, Session, SessionStatus, StoreData } from '../types/index.js';
export { isTtyAlive } from '../utils/tty-cache.js';
export interface Settings {
    qrCodeVisible: boolean;
}
export declare function readStore(): StoreData;
export declare function writeStore(data: StoreData): void;
/** Immediately flush any pending writes (useful for testing and cleanup) */
export declare function flushPendingWrites(): void;
/** Reset the in-memory cache (useful for testing) */
export declare function resetStoreCache(): void;
/** @internal */
export declare function getSessionKey(sessionId: string, tty?: string): string;
/** @internal */
export declare function removeOldSessionsOnSameTty(sessions: Record<string, Session>, newSessionId: string, tty: string): void;
/** @internal */
export declare function determineStatus(event: HookEvent, currentStatus?: SessionStatus): SessionStatus;
export declare function updateSession(event: HookEvent): Session;
export declare function getSessions(): Session[];
/**
 * Remove sessions whose TTY no longer exists from the store.
 * Call this on a timer rather than inside getSessions() to avoid
 * write → chokidar → read → write loops.
 */
export declare function cleanupDeadSessions(): void;
export declare function getSession(sessionId: string, tty?: string): Session | undefined;
export declare function removeSession(sessionId: string, tty?: string): void;
export declare function clearSessions(): void;
export declare function getStorePath(): string;
export declare function readSettings(): Settings;
export declare function writeSettings(settings: Settings): void;
//# sourceMappingURL=file-store.d.ts.map