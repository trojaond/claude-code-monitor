/**
 * Tailscale CGNAT range: 100.64.0.0/10
 * This covers 100.64.0.0 - 100.127.255.255
 */
export declare function isTailscaleIP(address: string): boolean;
/**
 * Get Tailscale IP using the CLI command.
 * Tries both the CLI binary and the App Store version path.
 */
export declare function getTailscaleIPFromCLI(): string | null;
/**
 * Get Tailscale IP from network interfaces.
 * Fallback when CLI is not available.
 */
export declare function getTailscaleIPFromInterfaces(): string | null;
/**
 * Get Tailscale IP address.
 * Prefers CLI result, falls back to network interfaces.
 */
export declare function getTailscaleIP(): string | null;
/**
 * Get local IP address (excluding Tailscale addresses).
 */
export declare function getLocalIP(): string;
export interface NetworkAddresses {
    local: string;
    tailscale: string | null;
}
/**
 * Get all relevant network addresses.
 */
export declare function getNetworkAddresses(): NetworkAddresses;
//# sourceMappingURL=network.d.ts.map