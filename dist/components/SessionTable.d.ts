import type React from 'react';
import type { Session } from '../types/index.js';
interface SessionTableProps {
    sessions: Session[];
    selectedIndex: number;
    taskSummaries: Map<string, string>;
    markedSessionIds: Set<string>;
    now: number;
}
export declare const SessionTable: React.NamedExoticComponent<SessionTableProps>;
export {};
//# sourceMappingURL=SessionTable.d.ts.map