# Context Usage Column Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a visual context window usage percentage column (progress bar + %) to the CCN dashboard table, showing how full each Claude session's 200K context window is.

**Architecture:** Extract context usage from transcript JSONL files using the same pattern as existing cost/model extraction. The last assistant message's `usage` object provides token counts. Store percentage on Session, render as a colored progress bar in both terminal and mobile UI.

**Tech Stack:** TypeScript, Ink/React, Vitest

---

### Task 1: Add `contextPercent` to types

**Files:**
- Modify: `src/types/index.ts:18-19` (HookEvent)
- Modify: `src/types/index.ts:36` (Session)

**Step 1: Add field to HookEvent interface**

Add after `costUSD?: number;` (line 19):

```typescript
contextPercent?: number; // 0-100, context window usage percentage
```

**Step 2: Add field to Session interface**

Add after `costUSD?: number;` (line 36):

```typescript
contextPercent?: number; // 0-100, context window usage percentage
```

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (new optional fields don't break anything)

**Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add contextPercent field to HookEvent and Session types"
```

---

### Task 2: Add `getContextUsageFromTranscript()` with tests

**Files:**
- Modify: `src/utils/transcript.ts` (add new function after `getCostFromTranscript`)
- Create: `tests/transcript.test.ts`

**Step 1: Write the failing test**

Create `tests/transcript.test.ts`:

```typescript
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getContextUsageFromTranscript } from '../src/utils/transcript.js';

describe('getContextUsageFromTranscript', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'ccn-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeTranscript(lines: object[]): string {
    const filePath = join(tmpDir, 'test.jsonl');
    writeFileSync(filePath, lines.map((l) => JSON.stringify(l)).join('\n'));
    return filePath;
  }

  it('should return undefined for non-existent file', () => {
    expect(getContextUsageFromTranscript('/tmp/nonexistent.jsonl')).toBeUndefined();
  });

  it('should return undefined for empty file', () => {
    const path = writeTranscript([]);
    expect(getContextUsageFromTranscript(path)).toBeUndefined();
  });

  it('should compute percentage from last assistant message usage', () => {
    const path = writeTranscript([
      {
        type: 'assistant',
        message: {
          model: 'claude-opus-4-6',
          usage: {
            input_tokens: 50000,
            output_tokens: 1000,
            cache_read_input_tokens: 100000,
            cache_creation_input_tokens: 10000,
          },
        },
      },
    ]);
    // (50000 + 100000 + 10000) / 200000 * 100 = 80
    expect(getContextUsageFromTranscript(path)).toBe(80);
  });

  it('should use the last assistant message, not earlier ones', () => {
    const path = writeTranscript([
      {
        type: 'assistant',
        message: {
          model: 'claude-opus-4-6',
          usage: { input_tokens: 10000, output_tokens: 500, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
        },
      },
      {
        type: 'assistant',
        message: {
          model: 'claude-opus-4-6',
          usage: { input_tokens: 40000, output_tokens: 2000, cache_read_input_tokens: 60000, cache_creation_input_tokens: 0 },
        },
      },
    ]);
    // Last message: (40000 + 60000 + 0) / 200000 * 100 = 50
    expect(getContextUsageFromTranscript(path)).toBe(50);
  });

  it('should cap at 100%', () => {
    const path = writeTranscript([
      {
        type: 'assistant',
        message: {
          model: 'claude-opus-4-6',
          usage: { input_tokens: 180000, output_tokens: 5000, cache_read_input_tokens: 50000, cache_creation_input_tokens: 0 },
        },
      },
    ]);
    // (180000 + 50000 + 0) / 200000 * 100 = 115 -> capped at 100
    expect(getContextUsageFromTranscript(path)).toBe(100);
  });

  it('should handle missing usage fields gracefully', () => {
    const path = writeTranscript([
      {
        type: 'assistant',
        message: {
          model: 'claude-opus-4-6',
          usage: { input_tokens: 20000, output_tokens: 500 },
        },
      },
    ]);
    // (20000 + 0 + 0) / 200000 * 100 = 10
    expect(getContextUsageFromTranscript(path)).toBe(10);
  });

  it('should return undefined when no assistant messages exist', () => {
    const path = writeTranscript([
      { type: 'user', message: { role: 'user', content: [{ type: 'text', text: 'hello' }] } },
    ]);
    expect(getContextUsageFromTranscript(path)).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest tests/transcript.test.ts --run`
Expected: FAIL — `getContextUsageFromTranscript` is not exported

**Step 3: Implement `getContextUsageFromTranscript`**

Add to `src/utils/transcript.ts` after `getCostFromTranscript`:

```typescript
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
```

**Step 4: Run test to verify it passes**

Run: `npx vitest tests/transcript.test.ts --run`
Expected: PASS

**Step 5: Commit**

```bash
git add src/utils/transcript.ts tests/transcript.test.ts
git commit -m "feat: add getContextUsageFromTranscript for context window percentage"
```

---

### Task 3: Wire context usage through hook handler and store

**Files:**
- Modify: `src/hook/handler.ts:73` (add contextPercent extraction)
- Modify: `src/hook/handler.ts:75-85` (add to HookEvent)
- Modify: `src/store/file-store.ts:253-264` (add to Session construction)

**Step 1: Update handler to extract contextPercent**

In `src/hook/handler.ts`, add import for `getContextUsageFromTranscript`:

```typescript
import {
  buildTranscriptPath,
  getCostFromTranscript,
  getContextUsageFromTranscript,
  getModelFromTranscript,
} from '../utils/transcript.js';
```

After line 73 (`const costUSD = ...`), add:

```typescript
const contextPercent = transcriptPath ? getContextUsageFromTranscript(transcriptPath) : undefined;
```

Add `contextPercent` to the event object (after `costUSD` on line 84):

```typescript
contextPercent,
```

**Step 2: Update file-store to persist contextPercent**

In `src/store/file-store.ts:updateSession`, add `contextPercent` to the session object (after `costUSD` on line 263):

```typescript
contextPercent: event.contextPercent ?? existing?.contextPercent,
```

**Step 3: Run typecheck and tests**

Run: `npm run typecheck && npm run test`
Expected: PASS

**Step 4: Commit**

```bash
git add src/hook/handler.ts src/store/file-store.ts
git commit -m "feat: wire contextPercent through hook handler and store"
```

---

### Task 4: Add CTX USAGE column to SessionTable

**Files:**
- Modify: `src/components/SessionTable.tsx`

**Step 1: Add column constant and helper function**

After `const COL_AGE = 6;` (line 63), add:

```typescript
const COL_CTX = 16;
```

Add helper function after `formatLastChange`:

```typescript
/** Build a colored progress bar string for context usage */
function getContextBarColor(percent: number): string {
  if (percent >= 80) return 'red';
  if (percent >= 50) return 'yellow';
  return 'green';
}
```

**Step 2: Add column header**

In the header row, add between the COST and TASKS headers:

```tsx
<Box width={COL_CTX}>
  <Text bold dimColor>
    CTX USAGE
  </Text>
</Box>
```

**Step 3: Add column data row**

In the data row section, add between COST and TASKS cells. Compute the bar inside the `.map()`:

```tsx
<Box width={COL_CTX}>
  {session.contextPercent !== undefined ? (
    <Text color={getContextBarColor(session.contextPercent)} backgroundColor={bg}>
      {renderContextBar(session.contextPercent)}
    </Text>
  ) : (
    <Text dimColor backgroundColor={bg}>
      {'—'}
    </Text>
  )}
</Box>
```

Add the `renderContextBar` function:

```typescript
function renderContextBar(percent: number): string {
  const BAR_WIDTH = 8;
  const filled = Math.round((percent / 100) * BAR_WIDTH);
  const empty = BAR_WIDTH - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const pct = `${percent}%`.padStart(4);
  return `${bar}${pct}`;
}
```

**Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/SessionTable.tsx
git commit -m "feat: add CTX USAGE column with progress bar to dashboard table"
```

---

### Task 5: Add context usage to mobile web UI

**Files:**
- Modify: `public/index.html`

**Step 1: Add CSS for context bar**

Add after the `.card-meta-item` styles (around line 288):

```css
.ctx-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.ctx-bar-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  min-width: 32px;
}

.ctx-bar-track {
  flex: 1;
  height: 6px;
  background: var(--bg-input);
  border-radius: 3px;
  overflow: hidden;
}

.ctx-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.ctx-bar-fill.green { background: var(--status-running); }
.ctx-bar-fill.yellow { background: var(--status-waiting); }
.ctx-bar-fill.red { background: var(--danger); }

.ctx-bar-pct {
  font-size: 12px;
  font-weight: 700;
  min-width: 36px;
  text-align: right;
}

.ctx-bar-pct.green { color: var(--status-running); }
.ctx-bar-pct.yellow { color: var(--status-waiting); }
.ctx-bar-pct.red { color: var(--danger); }
```

**Step 2: Add context bar to card rendering**

In the `render()` function, after `metaHtml` construction and before the card template, add:

```javascript
function getCtxBarColor(percent) {
  if (percent >= 80) return 'red';
  if (percent >= 50) return 'yellow';
  return 'green';
}
```

In the card template, add the context bar between `${metaHtml}` and the `card-message` div:

```javascript
const ctxHtml = session.contextPercent !== undefined
  ? `<div class="ctx-bar">
       <span class="ctx-bar-label">CTX</span>
       <div class="ctx-bar-track">
         <div class="ctx-bar-fill ${getCtxBarColor(session.contextPercent)}" style="width: ${Math.min(session.contextPercent, 100)}%"></div>
       </div>
       <span class="ctx-bar-pct ${getCtxBarColor(session.contextPercent)}">${session.contextPercent}%</span>
     </div>`
  : '';
```

**Step 3: Commit**

```bash
git add public/index.html
git commit -m "feat: add context usage bar to mobile web UI"
```

---

### Task 6: Final verification

**Step 1: Run all tests**

Run: `npm run test`
Expected: All PASS

**Step 2: Run lint and typecheck**

Run: `npm run lint && npm run typecheck`
Expected: PASS

**Step 3: Run dev mode to verify visually**

Run: `npm run dev`
Expected: Dashboard shows new CTX USAGE column with progress bars
