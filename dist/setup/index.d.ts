/** @internal */
interface HookConfig {
    type: 'command';
    command: string;
}
/** @internal */
interface HookEntry {
    matcher?: string;
    hooks: HookConfig[];
}
/** @internal */
export interface Settings {
    hooks?: Record<string, HookEntry[]>;
    env?: Record<string, string>;
    [key: string]: unknown;
}
/**
 * Check if hooks are already configured
 */
export declare function isHooksConfigured(): boolean;
export declare function setupHooks(): Promise<void>;
/**
 * Prompt for Ghostty setting if needed (called from ccm command when hooks are already configured)
 */
export declare function promptGhosttySettingIfNeeded(): Promise<void>;
export {};
//# sourceMappingURL=index.d.ts.map