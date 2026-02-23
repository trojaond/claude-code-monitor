/**
 * Format a timestamp as relative time (e.g., "5s ago", "2m ago", "1h ago")
 */
export function formatRelativeTime(timestamp) {
    const now = Date.now();
    const then = new Date(timestamp).getTime();
    const diffMs = now - then;
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    // Check from largest to smallest unit (use the first matching unit)
    if (hours > 0)
        return `${hours}h ago`;
    if (minutes > 0)
        return `${minutes}m ago`;
    return `${seconds}s ago`;
}
/**
 * Format a timestamp as short relative time without "ago" suffix (e.g., "5s", "2m", "1h")
 */
export function formatRelativeTimeShort(timestamp) {
    const now = Date.now();
    const then = new Date(timestamp).getTime();
    const diffMs = now - then;
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0)
        return `${hours}h`;
    if (minutes > 0)
        return `${minutes}m`;
    return `${seconds}s`;
}
