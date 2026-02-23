import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Build transcript file path from cwd and session_id.
 * Claude Code stores transcripts at ~/.claude/projects/{encoded-cwd}/{session_id}.jsonl
 */
export function buildTranscriptPath(cwd: string, sessionId: string): string {
  // Encode cwd: replace / and . with - (including leading /)
  const encodedCwd = cwd.replace(/[/.]/g, '-');
  return join(homedir(), '.claude', 'projects', encodedCwd, `${sessionId}.jsonl`);
}

interface ContentBlock {
  type: string;
  text?: string;
}

interface TokenUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

interface ModelPricing {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

/**
 * Pricing per 1M tokens by model pattern.
 * @internal
 */
const MODEL_PRICING: ReadonlyArray<[pattern: string, pricing: ModelPricing]> = [
  ['opus', { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 }],
  ['sonnet', { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 }],
  ['haiku', { input: 0.8, output: 4, cacheRead: 0.08, cacheWrite: 1.0 }],
];

/** @internal */
function getPricingForModel(model: string): ModelPricing | undefined {
  const lower = model.toLowerCase();
  for (const [pattern, pricing] of MODEL_PRICING) {
    if (lower.includes(pattern)) return pricing;
  }
  return undefined;
}

/**
 * Get the last assistant text message from a transcript file.
 */
export function getLastAssistantMessage(transcriptPath: string): string | undefined {
  if (!transcriptPath || !existsSync(transcriptPath)) {
    return undefined;
  }

  try {
    const content = readFileSync(transcriptPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    // Read from end to find last text message
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]);
        if (entry.type === 'assistant' && entry.message?.content) {
          const contentBlocks = entry.message.content as ContentBlock[];

          for (const block of contentBlocks) {
            if (block.type === 'text' && block.text) {
              return block.text;
            }
          }
        }
      } catch {
        // Skip invalid JSON lines
      }
    }
  } catch {
    // Ignore file read errors
  }

  return undefined;
}

/**
 * Get the model name from the last assistant entry in a transcript file.
 * Reads from the end to find the most recent model.
 */
export function getModelFromTranscript(transcriptPath: string): string | undefined {
  if (!transcriptPath || !existsSync(transcriptPath)) {
    return undefined;
  }

  try {
    const content = readFileSync(transcriptPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]);
        if (entry.type === 'assistant' && entry.message?.model) {
          return entry.message.model as string;
        }
      } catch {
        // Skip invalid JSON lines
      }
    }
  } catch {
    // Ignore file read errors
  }

  return undefined;
}

/**
 * Compute estimated USD cost from cumulative token usage in a transcript file.
 * Sums all message.usage entries and applies model-specific pricing.
 */
export function getCostFromTranscript(transcriptPath: string): number | undefined {
  if (!transcriptPath || !existsSync(transcriptPath)) {
    return undefined;
  }

  try {
    const content = readFileSync(transcriptPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCacheReadTokens = 0;
    let totalCacheWriteTokens = 0;
    let lastModel: string | undefined;

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.type === 'assistant' && entry.message) {
          if (entry.message.model) {
            lastModel = entry.message.model as string;
          }
          const usage = entry.message.usage as TokenUsage | undefined;
          if (usage) {
            totalInputTokens += usage.input_tokens ?? 0;
            totalOutputTokens += usage.output_tokens ?? 0;
            totalCacheReadTokens += usage.cache_read_input_tokens ?? 0;
            totalCacheWriteTokens += usage.cache_creation_input_tokens ?? 0;
          }
        }
      } catch {
        // Skip invalid JSON lines
      }
    }

    if (!lastModel) return undefined;

    const pricing = getPricingForModel(lastModel);
    if (!pricing) return undefined;

    const cost =
      (totalInputTokens / 1_000_000) * pricing.input +
      (totalOutputTokens / 1_000_000) * pricing.output +
      (totalCacheReadTokens / 1_000_000) * pricing.cacheRead +
      (totalCacheWriteTokens / 1_000_000) * pricing.cacheWrite;

    return Math.round(cost * 100) / 100; // Round to 2 decimal places
  } catch {
    // Ignore file read errors
  }

  return undefined;
}

const CONTEXT_WINDOW_TOKENS = 200_000;

/**
 * Get context window usage percentage from the last assistant message.
 * Returns 0-100 representing how full the context window is.
 */
export function getContextUsageFromTranscript(transcriptPath: string): number | undefined {
  if (!transcriptPath || !existsSync(transcriptPath)) {
    return undefined;
  }

  try {
    const content = readFileSync(transcriptPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    // Read from end to find last assistant message with usage
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]);
        if (entry.type === 'assistant' && entry.message?.usage) {
          const usage = entry.message.usage as TokenUsage;
          const totalInput =
            (usage.input_tokens ?? 0) +
            (usage.cache_read_input_tokens ?? 0) +
            (usage.cache_creation_input_tokens ?? 0);

          const percent = Math.round((totalInput / CONTEXT_WINDOW_TOKENS) * 100);
          return Math.min(percent, 100);
        }
      } catch {
        // Skip invalid JSON lines
      }
    }
  } catch {
    // Ignore file read errors
  }

  return undefined;
}
