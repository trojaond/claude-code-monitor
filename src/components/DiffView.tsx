import { execFileSync } from 'node:child_process';
import { basename, resolve } from 'node:path';
import { Box, Text, useInput, useStdout } from 'ink';
import type React from 'react';
import { useEffect, useState } from 'react';
import type { Session } from '../types/index.js';

interface DiffFile {
  path: string;
  added: number;
  removed: number;
}

interface DiffViewProps {
  session: Session;
  onExit: () => void;
}

function runGit(args: string[], cwd: string): string {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    return '';
  }
}

function getChangedFiles(cwd: string): DiffFile[] {
  const parseNumstat = (text: string): Map<string, DiffFile> => {
    const map = new Map<string, DiffFile>();
    for (const line of text.trim().split('\n')) {
      if (!line) continue;
      const parts = line.split('\t');
      if (parts.length >= 3) {
        map.set(parts[2], {
          path: parts[2],
          added: Number.parseInt(parts[0], 10) || 0,
          removed: Number.parseInt(parts[1], 10) || 0,
        });
      }
    }
    return map;
  };

  const unstaged = parseNumstat(runGit(['diff', '--numstat'], cwd));
  const staged = parseNumstat(runGit(['diff', '--cached', '--numstat'], cwd));

  const merged = new Map<string, DiffFile>(unstaged);
  for (const [p, f] of staged) {
    if (!merged.has(p)) {
      merged.set(p, f);
    } else {
      const existing = merged.get(p) as DiffFile;
      merged.set(p, {
        ...existing,
        added: existing.added + f.added,
        removed: existing.removed + f.removed,
      });
    }
  }
  return Array.from(merged.values());
}

function getDiffLines(cwd: string, filePath: string): string[] {
  const unstaged = runGit(['diff', '--', filePath], cwd);
  const staged = runGit(['diff', '--cached', '--', filePath], cwd);
  const combined = (unstaged || staged).trim();
  return combined ? combined.split('\n') : [];
}

function DiffLine({ line }: { line: string }): React.ReactElement {
  if (line.startsWith('+') && !line.startsWith('+++')) {
    return <Text color="green">{line}</Text>;
  }
  if (line.startsWith('-') && !line.startsWith('---')) {
    return <Text color="red">{line}</Text>;
  }
  if (line.startsWith('@@')) {
    return <Text color="cyan">{line}</Text>;
  }
  if (
    line.startsWith('diff ') ||
    line.startsWith('index ') ||
    line.startsWith('---') ||
    line.startsWith('+++')
  ) {
    return <Text dimColor>{line}</Text>;
  }
  return <Text>{line}</Text>;
}

export function DiffView({ session, onExit }: DiffViewProps): React.ReactElement {
  const { stdout } = useStdout();
  const [files, setFiles] = useState<DiffFile[]>([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [diffLines, setDiffLines] = useState<string[]>([]);
  const [scrollOffset, setScrollOffset] = useState(0);

  const terminalHeight = stdout?.rows ?? 24;
  // Chrome overhead: file-strip box (3) + header row (1) + diff borders (2) + footer (1) = 7
  const visibleLines = Math.max(5, terminalHeight - 7);

  useEffect(() => {
    const changed = getChangedFiles(session.cwd);
    setFiles(changed);
    setSelectedFileIndex(0);
  }, [session.cwd]);

  useEffect(() => {
    if (files.length > 0 && selectedFileIndex < files.length) {
      setDiffLines(getDiffLines(session.cwd, files[selectedFileIndex].path));
      setScrollOffset(0);
    } else {
      setDiffLines([]);
    }
  }, [session.cwd, files, selectedFileIndex]);

  useInput((input, key) => {
    if (input === 'q' || key.escape || input === 'd') {
      onExit();
      return;
    }
    if (input === 'k' || key.leftArrow) {
      setSelectedFileIndex((prev) => (prev <= 0 ? files.length - 1 : prev - 1));
      return;
    }
    if (input === 'j' || key.rightArrow) {
      setSelectedFileIndex((prev) => (prev >= files.length - 1 ? 0 : prev + 1));
      return;
    }
    if (input === 'w' || key.upArrow) {
      setScrollOffset((prev) => Math.max(0, prev - 5));
      return;
    }
    if (input === 's' || key.downArrow) {
      const maxOffset = Math.max(0, diffLines.length - visibleLines);
      setScrollOffset((prev) => Math.min(maxOffset, prev + 5));
      return;
    }
    if (input === 'e' && files[selectedFileIndex]) {
      try {
        execFileSync('code', [resolve(session.cwd, files[selectedFileIndex].path)], {
          stdio: 'ignore',
        });
      } catch {
        // VS Code not in PATH — silently ignore
      }
    }
  });

  const dir = session.cwd.replace(/^\/Users\/[^/]+/, '~');

  if (files.length === 0) {
    return (
      <Box flexDirection="column">
        <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
          <Box>
            <Text bold color="cyan">
              Git Diff
            </Text>
            <Text dimColor> — {dir}</Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>No changes detected in this directory.</Text>
          </Box>
        </Box>
        <Box marginTop={1} justifyContent="center">
          <Text dimColor>[d/q/Esc]Back</Text>
        </Box>
      </Box>
    );
  }

  const currentFile = files[selectedFileIndex];
  const visibleDiffLines = diffLines.slice(scrollOffset, scrollOffset + visibleLines);
  const totalAdded = files.reduce((sum, f) => sum + f.added, 0);
  const totalRemoved = files.reduce((sum, f) => sum + f.removed, 0);
  const maxOffset = Math.max(0, diffLines.length - visibleLines);
  const scrollPercent = maxOffset > 0 ? Math.round((scrollOffset / maxOffset) * 100) : 100;

  return (
    <Box flexDirection="column">
      {/* File strip */}
      <Box borderStyle="round" borderColor="gray" paddingX={1} gap={1}>
        {files.map((f, i) => (
          <Text
            key={f.path}
            bold={i === selectedFileIndex}
            color={i === selectedFileIndex ? 'white' : 'gray'}
          >
            {i === selectedFileIndex ? `[${basename(f.path)}]` : basename(f.path)}
          </Text>
        ))}
      </Box>

      {/* File header */}
      <Box paddingX={1} gap={2}>
        <Text bold color="white">
          {basename(currentFile.path)}
        </Text>
        <Text color="green">+{currentFile.added}</Text>
        <Text color="red">-{currentFile.removed}</Text>
        <Text dimColor>{currentFile.path}</Text>
      </Box>

      {/* Diff content */}
      <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
        {visibleDiffLines.length === 0 ? (
          <Text dimColor>No diff content</Text>
        ) : (
          visibleDiffLines.map((line, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: position-stable diff rendering
            <DiffLine key={scrollOffset + i} line={line} />
          ))
        )}
      </Box>

      {/* Footer */}
      <Box justifyContent="space-between" paddingX={1}>
        <Box gap={1}>
          <Text dimColor>{files.length} files</Text>
          <Text color="green">+{totalAdded}</Text>
          <Text color="red">-{totalRemoved}</Text>
          {maxOffset > 0 && <Text dimColor>{scrollPercent}%</Text>}
        </Box>
        <Box gap={1}>
          <Text dimColor>[j/k/←→]Files</Text>
          <Text dimColor>[w/s/↑↓]Scroll</Text>
          <Text dimColor>[e]VSCode</Text>
          <Text dimColor>[d/q]Back</Text>
        </Box>
      </Box>
    </Box>
  );
}
