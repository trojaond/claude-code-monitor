import chokidar from 'chokidar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SESSION_REFRESH_INTERVAL_MS, SESSION_UPDATE_DEBOUNCE_MS } from '../constants.js';
import { cleanupDeadSessions, getSessions, getStorePath } from '../store/file-store.js';
/**
 * Shallow-compare two session arrays by key fields to avoid unnecessary re-renders.
 * Returns true if sessions are identical.
 */
function sessionsEqual(a, b) {
    if (a.length !== b.length)
        return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i].session_id !== b[i].session_id ||
            a[i].status !== b[i].status ||
            a[i].updated_at !== b[i].updated_at ||
            a[i].lastMessage !== b[i].lastMessage ||
            a[i].model !== b[i].model ||
            a[i].costUSD !== b[i].costUSD ||
            a[i].terminal !== b[i].terminal) {
            return false;
        }
    }
    return true;
}
export function useSessions() {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const debounceTimerRef = useRef(null);
    const prevSessionsRef = useRef([]);
    const loadSessions = useCallback(() => {
        try {
            const data = getSessions();
            // Only update state if data actually changed to avoid unnecessary re-renders.
            // getSessions() always returns a new array reference, so React would
            // re-render on every chokidar event without this check.
            if (!sessionsEqual(prevSessionsRef.current, data)) {
                prevSessionsRef.current = data;
                setSessions(data);
            }
            setError(null);
        }
        catch (e) {
            setError(e instanceof Error ? e : new Error('Failed to load sessions'));
        }
        finally {
            setLoading(false);
        }
    }, []);
    const debouncedLoadSessions = useCallback(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
            loadSessions();
            debounceTimerRef.current = null;
        }, SESSION_UPDATE_DEBOUNCE_MS);
    }, [loadSessions]);
    useEffect(() => {
        // Initial load (immediate, no debounce)
        loadSessions();
        // Watch file changes (debounced)
        const storePath = getStorePath();
        const watcher = chokidar.watch(storePath, {
            persistent: true,
            ignoreInitial: true,
        });
        watcher.on('change', debouncedLoadSessions);
        watcher.on('add', debouncedLoadSessions);
        // Periodic cleanup of dead TTY sessions and refresh.
        // Cleanup writes to disk only when dead sessions are found, which then
        // triggers chokidar → loadSessions for a fresh read.
        const interval = setInterval(() => {
            cleanupDeadSessions();
            loadSessions();
        }, SESSION_REFRESH_INTERVAL_MS);
        return () => {
            watcher.close();
            clearInterval(interval);
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [loadSessions, debouncedLoadSessions]);
    return { sessions, loading, error };
}
