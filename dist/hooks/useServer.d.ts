export interface UseServerOptions {
    port?: number;
    preferTailscale?: boolean;
    /** Set to false to skip server startup entirely */
    enabled?: boolean;
}
export interface UseServerResult {
    url: string | null;
    qrCode: string | null;
    port: number | null;
    ip: string | null;
    tailscaleIP: string | null;
    localIP: string | null;
    loading: boolean;
    error: Error | null;
}
export declare function useServer(options?: UseServerOptions): UseServerResult;
//# sourceMappingURL=useServer.d.ts.map