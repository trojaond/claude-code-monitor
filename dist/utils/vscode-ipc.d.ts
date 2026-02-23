export interface VSCodeIPCResponse {
    success: boolean;
    error?: string;
    windowTitle?: string;
}
/**
 * Validate that a path matches the expected CCM VSCode socket pattern.
 * @internal
 */
export declare function isValidSocketPath(path: string): boolean;
/**
 * Scan /tmp for active CCM VSCode extension sockets.
 * Returns paths matching /tmp/ccm-vscode-{pid}.sock.
 */
export declare function findVSCodeSockets(): string[];
/**
 * Send a focus request to a VSCode extension socket.
 * Uses a Node.js one-liner via execFileSync to keep the call synchronous,
 * matching CCM's existing sync focus architecture (executeAppleScript pattern).
 */
export declare function sendFocusRequest(socketPath: string, tty: string): VSCodeIPCResponse | null;
//# sourceMappingURL=vscode-ipc.d.ts.map