# Diff View Feature Design

**Date:** 2026-02-24
**Feature:** Press `[d]` in the ccn dashboard to open a live git diff TUI for the selected session's working directory.

---

## Overview

When the user presses `[d]` in the ccn dashboard list view, it switches to a new `'diff'` view mode that shows a scrollable, file-navigable git diff of the selected session's `cwd`. The view matches the visual format of the existing bash diff watcher script (file strip, header, colored diff, footer with stats).

---

## Architecture

Dashboard gains a third view mode: `'list' | 'tasks' | 'diff'`. Pressing `[d]` in list mode switches to `'diff'` and renders a new `DiffView` component — same pattern as the existing `TaskDetailView`. Dashboard's `useInput` returns early in diff mode; `DiffView` owns all keyboard handling via its own `useInput`. Pressing `d`, `q`, or `Esc` inside `DiffView` returns to list mode.

---

## Layout

Four visual sections:

1. **File strip** — horizontal list of changed filenames. Selected file shown as `[filename]` in bold white; others dimmed. Navigated with `j`/`k`.
2. **File header** — full relative path, `+N` (green) / `-N` (red) line counts for selected file.
3. **Diff content** — scrollable window into `git diff -- <file>` output. Line coloring: `+` lines green, `-` lines red, `@@` hunk headers cyan, meta lines (`diff/index/---/+++`) dimmed. Visible line count = terminal height − 7 rows.
4. **Footer** — left: file count + aggregate `+/-` stats + scroll `%`. Right: `[j/k]Files [w/s]Scroll [e]VSCode [d/q]Back`.

---

## Data Flow

On mount, two synchronous `execFileSync` git commands build the file list:
- `git diff --numstat` → unstaged changes
- `git diff --cached --numstat` → staged changes

Results are merged (stats summed for files appearing in both). On file selection change, `git diff -- <file>` is run (falling back to `git diff --cached -- <file>` if empty). Output is split on `\n` and stored as `string[]`. No polling — data is fetched once per mount and per file selection.

VS Code integration: `execFileSync('code', [absFilePath])`, silently ignores failure.

---

## Edge Cases

| Case | Behavior |
|------|----------|
| Not a git repo | `execFileSync` throws → caught → empty file list → "No changes detected" screen |
| Binary files | `--numstat` outputs `- - filename` → parsed as 0/0 stats; diff shows `Binary files differ` as dimmed text |
| File disappears mid-view | `selectedFileIndex` clamped to `files.length - 1`; empty list falls to no-changes screen |
| Terminal resize | `stdout.rows` read at render time; ccn.tsx triggers full remount on real resize, DiffView gets fresh dimensions |

---

## Files Affected

- `src/components/DiffView.tsx` — new component
- `src/components/Dashboard.tsx` — add `'diff'` view mode, `[d]` key handler, `[d]Diff` shortcut hint
