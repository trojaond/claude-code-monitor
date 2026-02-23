# Context Usage Column Design

## Goal

Add a visual context window usage percentage column to the CCN dashboard table, showing how full each session's 200K token context window is.

## Data Layer

- **New field**: `Session.contextPercent?: number` (0-100)
- **New function**: `getContextUsageFromTranscript()` in `src/utils/transcript.ts`
  - Reads the last assistant message's `usage` object
  - Computes: `input_tokens + cache_read_input_tokens + cache_creation_input_tokens`
  - Divides by 200,000 and returns percentage (capped at 100)
- **Hook handler**: Calls `getContextUsageFromTranscript()` alongside existing cost/model extraction, stores result on session

## UI Layer

- **New `CTX USAGE` column** in `SessionTable.tsx` (~16 chars wide), placed between COST and TASKS
- **Progress bar**: 8-char block bar + percentage text (e.g. `████░░░░ 42%`)
  - Filled: `█`, empty: `░`
- **Color thresholds**: green (<50%), yellow (50-80%), red (>80%)

## Mobile Web

- Update `public/index.html` to display context usage bar in the session cards

## Files Changed

1. `src/types/index.ts` - Add `contextPercent` to `Session` and `HookEvent`
2. `src/utils/transcript.ts` - Add `getContextUsageFromTranscript()`
3. `src/hook/handler.ts` - Call new function, pass to session
4. `src/store/file-store.ts` - Persist `contextPercent`
5. `src/components/SessionTable.tsx` - Add CTX USAGE column with progress bar
6. `public/index.html` - Add context usage display to mobile UI
7. Tests for new transcript function
