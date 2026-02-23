import type React from 'react';
interface DashboardProps {
    /** Override default QR code visibility (e.g., from --qr CLI flag) */
    initialShowQr?: boolean;
    /** Prefer Tailscale IP for mobile access */
    preferTailscale?: boolean;
    /** Enable/disable the mobile web server (default: true) */
    serverEnabled?: boolean;
}
export declare function Dashboard({ initialShowQr, preferTailscale, serverEnabled, }: DashboardProps): React.ReactElement;
export {};
//# sourceMappingURL=Dashboard.d.ts.map