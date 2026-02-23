/**
 * Build transcript file path from cwd and session_id.
 * Claude Code stores transcripts at ~/.claude/projects/{encoded-cwd}/{session_id}.jsonl
 */
export declare function buildTranscriptPath(cwd: string, sessionId: string): string;
/**
 * Get the last assistant text message from a transcript file.
 */
export declare function getLastAssistantMessage(transcriptPath: string): string | undefined;
/**
 * Get the model name from the last assistant entry in a transcript file.
 * Reads from the end to find the most recent model.
 */
export declare function getModelFromTranscript(transcriptPath: string): string | undefined;
/**
 * Compute estimated USD cost from cumulative token usage in a transcript file.
 * Sums all message.usage entries and applies model-specific pricing.
 */
export declare function getCostFromTranscript(transcriptPath: string): number | undefined;
/**
 * Get context window usage percentage from the last assistant message.
 * Returns 0-100 representing how full the context window is.
 */
export declare function getContextUsageFromTranscript(transcriptPath: string): number | undefined;
//# sourceMappingURL=transcript.d.ts.map