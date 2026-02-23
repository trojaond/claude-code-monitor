import { useEffect, useState } from 'react';
import { DEFAULT_SERVER_PORT } from '../constants.js';
import { createMobileServer } from '../server/index.js';
export function useServer(options = {}) {
    const { port = DEFAULT_SERVER_PORT, preferTailscale = false, enabled = true } = options;
    const [url, setUrl] = useState(null);
    const [qrCode, setQrCode] = useState(null);
    const [actualPort, setActualPort] = useState(null);
    const [ip, setIp] = useState(null);
    const [tailscaleIP, setTailscaleIP] = useState(null);
    const [localIP, setLocalIP] = useState(null);
    const [loading, setLoading] = useState(enabled);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (!enabled)
            return;
        // Use a ref-like object to track server across async boundaries
        // This prevents race condition where cleanup runs before async completes
        const serverRef = { current: null };
        let isMounted = true;
        async function startServer() {
            try {
                const info = await createMobileServer({ port, preferTailscale });
                if (isMounted) {
                    serverRef.current = info;
                    setUrl(info.url);
                    setQrCode(info.qrCode);
                    setActualPort(info.port);
                    setIp(info.ip);
                    setTailscaleIP(info.tailscaleIP);
                    setLocalIP(info.localIP);
                    setLoading(false);
                }
                else {
                    // Component unmounted during async operation - stop server immediately
                    info.stop();
                }
            }
            catch (err) {
                if (isMounted) {
                    setError(err instanceof Error ? err : new Error('Failed to start server'));
                    setLoading(false);
                }
            }
        }
        startServer();
        return () => {
            isMounted = false;
            if (serverRef.current) {
                serverRef.current.stop();
            }
        };
    }, [port, preferTailscale, enabled]);
    return { url, qrCode, port: actualPort, ip, tailscaleIP, localIP, loading, error };
}
