import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { dirname, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import chokidar from 'chokidar';
import qrcode from 'qrcode-terminal';
import { WebSocketServer } from 'ws';
import { DEFAULT_SERVER_PORT } from '../constants.js';
import { clearSessions, getSessions, getStorePath } from '../store/file-store.js';
import { focusSession } from '../utils/focus.js';
import { getLocalIP, getTailscaleIP } from '../utils/network.js';
import { captureTerminalScreen } from '../utils/screen-capture.js';
import { sendKeystrokeToTerminal, sendTextToTerminal } from '../utils/send-text.js';
const __dirname = dirname(fileURLToPath(import.meta.url));
const MAX_PORT_ATTEMPTS = 10;
/**
 * Check if a port is available on the specified host.
 */
function isPortAvailable(port, host) {
    return new Promise((resolve) => {
        const server = createNetServer();
        server.once('error', () => {
            server.close(); // Ensure server is closed on error
            resolve(false);
        });
        server.once('listening', () => {
            server.close(() => {
                resolve(true);
            });
        });
        server.listen(port, host);
    });
}
/**
 * Find an available port starting from the given port on the specified host.
 * Tries up to MAX_PORT_ATTEMPTS ports.
 */
async function findAvailablePort(startPort, host) {
    for (let i = 0; i < MAX_PORT_ATTEMPTS; i++) {
        const port = startPort + i;
        if (await isPortAvailable(port, host)) {
            return port;
        }
    }
    throw new Error(`No available port found in range ${startPort}-${startPort + MAX_PORT_ATTEMPTS - 1}`);
}
/** Token TTL: 24 hours (local tool, re-scanning QR daily is reasonable) */
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
/**
 * Generate a random authentication token with creation timestamp.
 */
function generateAuthToken() {
    return {
        value: randomBytes(32).toString('hex'),
        createdAt: Date.now(),
    };
}
/**
 * Validate that a request token matches and has not expired.
 */
function isValidToken(requestToken, authToken) {
    if (!requestToken || requestToken !== authToken.value)
        return false;
    return Date.now() - authToken.createdAt < TOKEN_TTL_MS;
}
// WebSocket.OPEN constant (avoid magic number)
const WEBSOCKET_OPEN = 1;
/**
 * Patterns for dangerous shell commands that should be blocked.
 * These commands can cause irreversible damage to the system.
 */
const DANGEROUS_COMMAND_PATTERNS = [
    /rm\s+(-rf?|--recursive)/i, // Recursive file deletion
    /sudo\s+rm/i, // Sudo remove
    /mkfs/i, // Format filesystem
    /dd\s+if=/i, // Disk dump (can overwrite disks)
    />\s*\/dev\//i, // Write to device files
    /chmod\s+777/i, // Overly permissive permissions
    /curl.*\|\s*(ba)?sh/i, // Pipe curl to shell
    /wget.*\|\s*(ba)?sh/i, // Pipe wget to shell
];
/**
 * Check if a command text contains dangerous patterns.
 * Returns the matched pattern description if dangerous, undefined otherwise.
 */
function isDangerousCommand(text) {
    return DANGEROUS_COMMAND_PATTERNS.some((pattern) => pattern.test(text));
}
/**
 * Find a session by session ID.
 */
function findSessionById(sessionId) {
    const sessions = getSessions();
    return sessions.find((s) => s.session_id === sessionId);
}
/**
 * Handle focus command from WebSocket client.
 */
function handleFocusCommand(ws, sessionId) {
    const session = findSessionById(sessionId);
    if (!session?.tty) {
        ws.send(JSON.stringify({
            type: 'focusResult',
            success: false,
            error: 'Session not found or no TTY',
        }));
        return;
    }
    const success = focusSession(session.tty, session.cwd);
    ws.send(JSON.stringify({ type: 'focusResult', success }));
}
/**
 * Handle sendText command from WebSocket client.
 * Validates input and blocks dangerous commands before execution.
 */
function handleSendTextCommand(ws, sessionId, text) {
    // Block dangerous commands at server level
    if (isDangerousCommand(text)) {
        ws.send(JSON.stringify({
            type: 'sendTextResult',
            success: false,
            error: 'Dangerous command blocked for security',
        }));
        return;
    }
    const session = findSessionById(sessionId);
    if (!session?.tty) {
        ws.send(JSON.stringify({ type: 'sendTextResult', success: false, error: 'Session not found' }));
        return;
    }
    const result = sendTextToTerminal(session.tty, text);
    ws.send(JSON.stringify({ type: 'sendTextResult', ...result }));
}
/**
 * Handle sendKeystroke command from WebSocket client.
 * Used for permission prompt responses (y/n/a) and Ctrl+C.
 */
function handleSendKeystrokeCommand(ws, sessionId, key, useControl = false) {
    const session = findSessionById(sessionId);
    if (!session?.tty) {
        ws.send(JSON.stringify({ type: 'sendKeystrokeResult', success: false, error: 'Session not found' }));
        return;
    }
    const result = sendKeystrokeToTerminal(session.tty, key, useControl);
    ws.send(JSON.stringify({ type: 'sendKeystrokeResult', ...result }));
}
/**
 * Handle clearSessions command from WebSocket client.
 */
function handleClearSessionsCommand(ws) {
    try {
        clearSessions();
        ws.send(JSON.stringify({ type: 'clearSessionsResult', success: true }));
    }
    catch {
        ws.send(JSON.stringify({
            type: 'clearSessionsResult',
            success: false,
            error: 'Failed to clear sessions',
        }));
    }
}
/**
 * Handle captureScreen command from WebSocket client.
 * Focuses the terminal window first, then captures it.
 */
async function handleCaptureScreenCommand(ws, sessionId) {
    const session = findSessionById(sessionId);
    if (!session?.tty) {
        ws.send(JSON.stringify({
            type: 'screenCaptureError',
            message: 'Session not found or no TTY',
        }));
        return;
    }
    try {
        // Focus the terminal window first to ensure it's visible
        focusSession(session.tty, session.cwd);
        // Wait a bit for the window to come to front
        await new Promise((resolve) => setTimeout(resolve, 100));
        const base64Data = await captureTerminalScreen(session.tty);
        if (base64Data === null) {
            ws.send(JSON.stringify({
                type: 'screenCaptureError',
                message: 'Failed to capture screen. Screen recording permission may be required.',
            }));
            return;
        }
        ws.send(JSON.stringify({
            type: 'screenCapture',
            data: base64Data,
        }));
    }
    catch (error) {
        ws.send(JSON.stringify({
            type: 'screenCaptureError',
            message: error instanceof Error ? error.message : 'Unknown error during screen capture',
        }));
    }
}
/**
 * Handle incoming WebSocket message from client.
 * Processes focus, sendText, clearSessions, and captureScreen commands.
 */
function handleWebSocketMessage(ws, data) {
    let message;
    try {
        message = JSON.parse(data.toString());
    }
    catch {
        return; // Ignore invalid messages
    }
    if (message.type === 'focus' && message.sessionId) {
        handleFocusCommand(ws, message.sessionId);
        return;
    }
    if (message.type === 'sendText' && message.sessionId && message.text) {
        handleSendTextCommand(ws, message.sessionId, message.text);
        return;
    }
    if (message.type === 'sendKeystroke' && message.sessionId && message.key) {
        handleSendKeystrokeCommand(ws, message.sessionId, message.key, message.useControl ?? false);
        return;
    }
    if (message.type === 'clearSessions') {
        handleClearSessionsCommand(ws);
        return;
    }
    if (message.type === 'captureScreen' && message.sessionId) {
        // Handle async operation without blocking
        void handleCaptureScreenCommand(ws, message.sessionId);
    }
}
/**
 * Broadcast message to all connected WebSocket clients.
 */
function broadcastToClients(wss, message) {
    const data = JSON.stringify(message);
    for (const client of wss.clients) {
        if (client.readyState === WEBSOCKET_OPEN) {
            client.send(data);
        }
    }
}
/**
 * Send current sessions to a WebSocket client.
 */
function sendSessionsToClient(ws) {
    const sessions = getSessions();
    ws.send(JSON.stringify({ type: 'sessions', data: sessions }));
}
/** Maximum number of concurrent WebSocket connections */
const MAX_WS_CONNECTIONS = 20;
/**
 * Setup WebSocket connection handlers.
 */
function setupWebSocketHandlers(wss, authToken) {
    wss.on('connection', (ws, req) => {
        // Enforce connection limit to prevent resource exhaustion
        if (wss.clients.size > MAX_WS_CONNECTIONS) {
            ws.close(1013, 'Too many connections');
            return;
        }
        const url = new URL(req.url || '/', `ws://${req.headers.host}`);
        const requestToken = url.searchParams.get('token');
        if (!isValidToken(requestToken, authToken)) {
            ws.close(1008, 'Unauthorized');
            return;
        }
        sendSessionsToClient(ws);
        ws.on('message', (data) => handleWebSocketMessage(ws, data));
        // Handle client connection errors to prevent process crashes
        ws.on('error', (error) => {
            // Log error but don't crash - client disconnections are expected
            console.error('WebSocket client error:', error.message);
        });
    });
}
/**
 * Resolve server IP address based on preference.
 * If preferTailscale is true, attempts to use Tailscale IP, falling back to local IP.
 */
function resolveServerIP(preferTailscale) {
    const localIP = getLocalIP();
    const tailscaleIP = preferTailscale ? getTailscaleIP() : null;
    return {
        ip: tailscaleIP ?? localIP,
        localIP,
        tailscaleIP,
    };
}
function generateQRCode(text) {
    return new Promise((resolve) => {
        qrcode.generate(text, { small: true }, (qrCode) => {
            resolve(qrCode);
        });
    });
}
function getContentType(path) {
    if (path.endsWith('.html'))
        return 'text/html';
    if (path.endsWith('.css'))
        return 'text/css';
    if (path.endsWith('.js'))
        return 'application/javascript';
    return 'text/plain';
}
function serveStatic(req, res, authToken) {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const requestToken = url.searchParams.get('token');
    const filePath = url.pathname === '/' ? '/index.html' : url.pathname;
    // Allow static library files without token (they contain no sensitive data)
    const isPublicLibrary = filePath.startsWith('/lib/') && filePath.endsWith('.js');
    if (!isPublicLibrary && !isValidToken(requestToken, authToken)) {
        const expired = requestToken === authToken.value;
        const message = expired
            ? 'Token expired - restart the server to get a new token'
            : 'Unauthorized - Invalid or missing token';
        res.writeHead(401, { 'Content-Type': 'text/plain' });
        res.end(message);
        return;
    }
    const publicDir = resolve(__dirname, '../../public');
    // Prevent directory traversal
    // Remove leading slashes and normalize to prevent absolute path injection
    const safePath = normalize(filePath)
        .replace(/^(\.\.(\/|\\|$))+/, '')
        .replace(/^\/+/, '');
    const fullPath = resolve(publicDir, safePath);
    // Verify the resolved path is within publicDir
    if (!fullPath.startsWith(publicDir)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
    }
    try {
        const content = readFileSync(fullPath, 'utf-8');
        res.writeHead(200, {
            'Content-Type': getContentType(filePath),
            'Cache-Control': 'no-cache, no-store, must-revalidate',
        });
        res.end(content);
    }
    catch {
        res.writeHead(404);
        res.end('Not Found');
    }
}
/**
 * Create server components (HTTP server, WebSocket server, file watcher).
 * Shared by createMobileServer and startServer.
 */
function createServerComponents(authToken) {
    const server = createServer((req, res) => serveStatic(req, res, authToken));
    const wss = new WebSocketServer({ server });
    setupWebSocketHandlers(wss, authToken);
    const storePath = getStorePath();
    const watcher = chokidar.watch(storePath, {
        ignoreInitial: true,
        awaitWriteFinish: {
            stabilityThreshold: 100,
            pollInterval: 50,
        },
    });
    watcher.on('change', () => {
        const sessions = getSessions();
        broadcastToClients(wss, { type: 'sessions', data: sessions });
    });
    return { server, wss, watcher };
}
/**
 * Stop all server components.
 * Terminates all WebSocket clients before closing to prevent hanging.
 */
function stopServerComponents({ watcher, wss, server }) {
    // Close file watcher (async but we don't wait - acceptable for shutdown)
    void watcher.close();
    // Terminate all WebSocket clients before closing server
    for (const client of wss.clients) {
        client.terminate();
    }
    wss.close();
    server.close();
}
export async function createMobileServer(options = {}) {
    const { port = DEFAULT_SERVER_PORT, preferTailscale = false } = options;
    const { ip, localIP, tailscaleIP } = resolveServerIP(preferTailscale);
    const actualPort = await findAvailablePort(port, ip);
    const authToken = generateAuthToken();
    const url = `http://${ip}:${actualPort}?token=${authToken.value}`;
    const qrCode = await generateQRCode(url);
    const components = createServerComponents(authToken);
    await new Promise((resolve) => {
        components.server.listen(actualPort, ip, resolve);
    });
    return {
        url,
        qrCode,
        token: authToken.value,
        port: actualPort,
        ip,
        tailscaleIP,
        localIP,
        stop: () => stopServerComponents(components),
    };
}
// CLI standalone mode
export async function startServer(options = {}) {
    const { port = DEFAULT_SERVER_PORT, preferTailscale = false } = options;
    const { ip, tailscaleIP } = resolveServerIP(preferTailscale);
    const actualPort = await findAvailablePort(port, ip);
    const authToken = generateAuthToken();
    const url = `http://${ip}:${actualPort}?token=${authToken.value}`;
    const components = createServerComponents(authToken);
    components.server.listen(actualPort, ip, () => {
        console.log('\n  Claude Code Navigator - Mobile Web Interface\n');
        console.log(`  Server running at: ${url}\n`);
        if (actualPort !== port) {
            console.log(`  (Port ${port} was in use, using ${actualPort} instead)\n`);
        }
        if (tailscaleIP) {
            console.log(`  Tailscale: ${tailscaleIP} (accessible from anywhere in your Tailnet)\n`);
        }
        console.log('  Scan this QR code with your phone:\n');
        qrcode.generate(url, { small: true });
        console.log(`\n  Token expires in 24 hours. Restart server to refresh.`);
        console.log('  Press Ctrl+C to stop the server.\n');
    });
    // Graceful shutdown handler for both SIGINT (Ctrl+C) and SIGTERM (Docker/K8s)
    const shutdown = () => {
        console.log('\n  Shutting down...');
        stopServerComponents(components);
        process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}
