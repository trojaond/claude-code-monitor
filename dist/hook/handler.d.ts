import type { HookEventName } from '../types/index.js';
/** @internal */
export declare const VALID_HOOK_EVENTS: ReadonlySet<string>;
/** @internal */
export declare function isValidHookEventName(name: string): name is HookEventName;
/** @internal */
export declare function isNonEmptyString(value: unknown): value is string;
export declare function handleHookEvent(eventName: string, tty?: string): Promise<void>;
//# sourceMappingURL=handler.d.ts.map