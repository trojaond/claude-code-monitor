import { flushPendingWrites, updateSession } from '../store/file-store.js';
import { readJsonFromStdin } from '../utils/stdin.js';
import { detectTerminalApp } from '../utils/terminal-detect.js';
import { buildTranscriptPath, getContextUsageFromTranscript, getCostFromTranscript, getModelFromTranscript, } from '../utils/transcript.js';
// Allowed hook event names (whitelist)
/** @internal */
export const VALID_HOOK_EVENTS = new Set([
    'PreToolUse',
    'PostToolUse',
    'Notification',
    'Stop',
    'UserPromptSubmit',
]);
/** @internal */
export function isValidHookEventName(name) {
    return VALID_HOOK_EVENTS.has(name);
}
/** @internal */
export function isNonEmptyString(value) {
    return typeof value === 'string' && value.length > 0;
}
export async function handleHookEvent(eventName, tty) {
    // Validate event name against whitelist
    if (!isValidHookEventName(eventName)) {
        console.error(`Invalid event name: ${eventName}`);
        process.exit(1);
    }
    let rawInput;
    try {
        rawInput = await readJsonFromStdin();
    }
    catch {
        console.error('Invalid JSON input');
        process.exit(1);
    }
    // Validate required fields
    if (!isNonEmptyString(rawInput.session_id)) {
        console.error('Invalid or missing session_id');
        process.exit(1);
    }
    // Validate optional fields if present
    if (rawInput.cwd !== undefined && typeof rawInput.cwd !== 'string') {
        console.error('Invalid cwd: must be a string');
        process.exit(1);
    }
    if (rawInput.notification_type !== undefined && typeof rawInput.notification_type !== 'string') {
        console.error('Invalid notification_type: must be a string');
        process.exit(1);
    }
    // Get transcript_path: use provided path or build from cwd and session_id
    const cwd = rawInput.cwd || process.cwd();
    const transcriptPath = typeof rawInput.transcript_path === 'string'
        ? rawInput.transcript_path
        : buildTranscriptPath(cwd, rawInput.session_id);
    // Detect terminal app, model, and cost
    const terminal = detectTerminalApp(tty);
    const model = transcriptPath ? getModelFromTranscript(transcriptPath) : undefined;
    const costUSD = transcriptPath ? getCostFromTranscript(transcriptPath) : undefined;
    const contextPercent = transcriptPath ? getContextUsageFromTranscript(transcriptPath) : undefined;
    // Extract user prompt from UserPromptSubmit events
    const lastPrompt = eventName === 'UserPromptSubmit' && typeof rawInput.prompt === 'string'
        ? rawInput.prompt
        : undefined;
    const event = {
        session_id: rawInput.session_id,
        cwd,
        tty,
        hook_event_name: eventName,
        notification_type: rawInput.notification_type,
        transcript_path: transcriptPath,
        terminal,
        model,
        costUSD,
        contextPercent,
        lastPrompt,
    };
    updateSession(event);
    // Ensure data is written before process exits (hooks are short-lived processes)
    flushPendingWrites();
}
