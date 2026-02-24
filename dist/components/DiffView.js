import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { execFileSync } from 'node:child_process';
import { basename, resolve } from 'node:path';
import { Box, Text, useInput, useStdout } from 'ink';
import { useEffect, useState } from 'react';
function runGit(args, cwd) {
    try {
        return execFileSync('git', args, {
            cwd,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
    }
    catch {
        return '';
    }
}
function getChangedFiles(cwd) {
    const parseNumstat = (text) => {
        const map = new Map();
        for (const line of text.trim().split('\n')) {
            if (!line)
                continue;
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
    const merged = new Map(unstaged);
    for (const [p, f] of staged) {
        if (!merged.has(p)) {
            merged.set(p, f);
        }
        else {
            const existing = merged.get(p);
            merged.set(p, {
                ...existing,
                added: existing.added + f.added,
                removed: existing.removed + f.removed,
            });
        }
    }
    return Array.from(merged.values());
}
function getDiffLines(cwd, filePath) {
    const unstaged = runGit(['diff', '--', filePath], cwd);
    const staged = runGit(['diff', '--cached', '--', filePath], cwd);
    const combined = (unstaged || staged).trim();
    return combined ? combined.split('\n') : [];
}
function DiffLine({ line }) {
    if (line.startsWith('+') && !line.startsWith('+++')) {
        return _jsx(Text, { color: "green", children: line });
    }
    if (line.startsWith('-') && !line.startsWith('---')) {
        return _jsx(Text, { color: "red", children: line });
    }
    if (line.startsWith('@@')) {
        return _jsx(Text, { color: "cyan", children: line });
    }
    if (line.startsWith('diff ') ||
        line.startsWith('index ') ||
        line.startsWith('---') ||
        line.startsWith('+++')) {
        return _jsx(Text, { dimColor: true, children: line });
    }
    return _jsx(Text, { children: line });
}
export function DiffView({ session, onExit }) {
    const { stdout } = useStdout();
    const [files, setFiles] = useState([]);
    const [selectedFileIndex, setSelectedFileIndex] = useState(0);
    const [diffLines, setDiffLines] = useState([]);
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
        }
        else {
            setDiffLines([]);
        }
    }, [session.cwd, files, selectedFileIndex]);
    useInput((input, key) => {
        if (input === 'q' || key.escape || input === 'd') {
            onExit();
            return;
        }
        if (input === 'k') {
            setSelectedFileIndex((prev) => Math.max(0, prev - 1));
            return;
        }
        if (input === 'j') {
            setSelectedFileIndex((prev) => Math.min(files.length - 1, prev + 1));
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
            }
            catch {
                // VS Code not in PATH — silently ignore
            }
        }
    });
    const dir = session.cwd.replace(/^\/Users\/[^/]+/, '~');
    if (files.length === 0) {
        return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: "cyan", paddingX: 1, children: [_jsxs(Box, { children: [_jsx(Text, { bold: true, color: "cyan", children: "Git Diff" }), _jsxs(Text, { dimColor: true, children: [" \u2014 ", dir] })] }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { dimColor: true, children: "No changes detected in this directory." }) })] }), _jsx(Box, { marginTop: 1, justifyContent: "center", children: _jsx(Text, { dimColor: true, children: "[d/q/Esc]Back" }) })] }));
    }
    const currentFile = files[selectedFileIndex];
    const visibleDiffLines = diffLines.slice(scrollOffset, scrollOffset + visibleLines);
    const totalAdded = files.reduce((sum, f) => sum + f.added, 0);
    const totalRemoved = files.reduce((sum, f) => sum + f.removed, 0);
    const maxOffset = Math.max(0, diffLines.length - visibleLines);
    const scrollPercent = maxOffset > 0 ? Math.round((scrollOffset / maxOffset) * 100) : 100;
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Box, { borderStyle: "round", borderColor: "gray", paddingX: 1, gap: 1, children: files.map((f, i) => (_jsx(Text, { bold: i === selectedFileIndex, color: i === selectedFileIndex ? 'white' : 'gray', children: i === selectedFileIndex ? `[${basename(f.path)}]` : basename(f.path) }, f.path))) }), _jsxs(Box, { paddingX: 1, gap: 2, children: [_jsx(Text, { bold: true, color: "white", children: basename(currentFile.path) }), _jsxs(Text, { color: "green", children: ["+", currentFile.added] }), _jsxs(Text, { color: "red", children: ["-", currentFile.removed] }), _jsx(Text, { dimColor: true, children: currentFile.path })] }), _jsx(Box, { flexDirection: "column", borderStyle: "round", borderColor: "gray", paddingX: 1, children: visibleDiffLines.length === 0 ? (_jsx(Text, { dimColor: true, children: "No diff content" })) : (visibleDiffLines.map((line, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: position-stable diff rendering
                _jsx(DiffLine, { line: line }, scrollOffset + i)))) }), _jsxs(Box, { justifyContent: "space-between", paddingX: 1, children: [_jsxs(Box, { gap: 1, children: [_jsxs(Text, { dimColor: true, children: [files.length, " files"] }), _jsxs(Text, { color: "green", children: ["+", totalAdded] }), _jsxs(Text, { color: "red", children: ["-", totalRemoved] }), maxOffset > 0 && _jsxs(Text, { dimColor: true, children: [scrollPercent, "%"] })] }), _jsxs(Box, { gap: 1, children: [_jsx(Text, { dimColor: true, children: "[j/k]Files" }), _jsx(Text, { dimColor: true, children: "[w/s]Scroll" }), _jsx(Text, { dimColor: true, children: "[e]VSCode" }), _jsx(Text, { dimColor: true, children: "[d/q]Back" })] })] })] }));
}
