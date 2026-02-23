export interface VSCodeIPCResponse {
    success: boolean;
    error?: string;
    windowTitle?: string;
}
/**
 * Validate that a path matches the expected CCN VSCode socket pattern.
 * @internal
 */
export declare function isValidSocketPath(path: string): boolean;
/**
 * Scan /tmp for active CCN VSCode extension sockets.
 * Returns paths matching /tmp/ccn-vscode-{pid}.sock.
 */
export declare function findVSCodeSockets(): string[];
/**
 * Send a focus request to a VSCode extension socket.
 * Uses a Node.js one-liner via execFileSync to keep the call synchronous,
 * matching CCN's existing sync focus architecture (executeAppleScript pattern).
 */
export declare function sendFocusRequest(socketPath: string, tty: string): VSCodeIPCResponse | null;
//# sourceMappingURL=vscode-ipc.d.ts.map