// Hook event types
export type HookEventName =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'Notification'
  | 'Stop'
  | 'UserPromptSubmit';

// Event received from hooks (for internal processing)
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
}

// Session status
export type SessionStatus = 'running' | 'waiting_input' | 'stopped';

// Session information (minimal)
export interface Session {
  session_id: string;
  cwd: string;
  tty?: string;
  status: SessionStatus;
  created_at: string;
  updated_at: string;
  lastMessage?: string;
  terminal?: string; // e.g., "iTerm2", "VSCode", "Terminal.app", "Ghostty"
  model?: string; // e.g., "claude-opus-4-6"
  costUSD?: number; // e.g., 0.42
}

// File store data structure
export interface StoreData {
  sessions: Record<string, Session>;
  updated_at: string;
}
