export interface ServerOptions {
    port?: number;
    preferTailscale?: boolean;
}
export interface ServerInfo {
    url: string;
    qrCode: string;
    token: string;
    port: number;
    ip: string;
    tailscaleIP: string | null;
    localIP: string;
    stop: () => void;
}
export declare function createMobileServer(options?: ServerOptions): Promise<ServerInfo>;
export declare function startServer(options?: ServerOptions): Promise<void>;
//# sourceMappingURL=index.d.ts.map