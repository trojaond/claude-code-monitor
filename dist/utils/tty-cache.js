import { statSync } from 'node:fs';
import { MAX_TTY_CACHE_SIZE, TTY_CACHE_TTL_MS } from '../constants.js';
// TTY check cache to avoid repeated statSync calls
const ttyCache = new Map();
/**
 * Evict oldest entries when cache exceeds max size
 * Uses FIFO eviction based on checkedAt timestamp
 */
function evictOldestIfNeeded() {
    if (ttyCache.size <= MAX_TTY_CACHE_SIZE) {
        return;
    }
    // Find and remove oldest entries until we're under the limit
    const entriesToRemove = ttyCache.size - MAX_TTY_CACHE_SIZE;
    const sortedEntries = [...ttyCache.entries()].sort((a, b) => a[1].checkedAt - b[1].checkedAt);
    for (let i = 0; i < entriesToRemove; i++) {
        ttyCache.delete(sortedEntries[i][0]);
    }
}
/**
 * Check if a TTY device is still alive (exists in filesystem)
 * Results are cached for TTY_CACHE_TTL_MS to avoid repeated stat calls
 * @internal
 */
export function isTtyAlive(tty) {
    if (!tty)
        return true; // Treat unknown TTY as alive
    const now = Date.now();
    const cached = ttyCache.get(tty);
    // Return cached result if still valid
    if (cached && now - cached.checkedAt < TTY_CACHE_TTL_MS) {
        return cached.alive;
    }
    // Check TTY and cache result
    let alive;
    try {
        statSync(tty);
        alive = true;
    }
    catch {
        alive = false;
    }
    ttyCache.set(tty, { alive, checkedAt: now });
    evictOldestIfNeeded();
    return alive;
}
