/**
 * Check if a TTY device is still alive (exists in filesystem)
 * Results are cached for TTY_CACHE_TTL_MS to avoid repeated stat calls
 * @internal
 */
export declare function isTtyAlive(tty: string | undefined): boolean;
//# sourceMappingURL=tty-cache.d.ts.map