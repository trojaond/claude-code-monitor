export type HookEventName = 'PreToolUse' | 'PostToolUse' | 'Notification' | 'Stop' | 'UserPromptSubmit';
export interface HookEvent {
    session_id: string;
    cwd: string;
    tty?: string;
    hook_event_name: HookEventName;
    notification_type?: string;
    transcript_path?: string;
    terminal?: string;
    model?: string;
    costUSD?: number;
    contextPercent?: number;
    lastPrompt?: string;
}
export type SessionStatus = 'running' | 'waiting_input' | 'stopped';
export interface Session {
    session_id: string;
    cwd: string;
    tty?: string;
    status: SessionStatus;
    created_at: string;
    updated_at: string;
    lastMessage?: string;
    terminal?: string;
    model?: string;
    costUSD?: number;
    contextPercent?: number;
    lastPrompt?: string;
}
export type TaskStatus = 'pending' | 'in_progress' | 'completed';
export interface Task {
    id: string;
    subject: string;
    description?: string;
    status: TaskStatus;
}
export interface StoreData {
    sessions: Record<string, Session>;
    updated_at: string;
}
//# sourceMappingURL=index.d.ts.map