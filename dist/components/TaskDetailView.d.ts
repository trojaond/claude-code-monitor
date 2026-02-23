import type React from 'react';
import type { Session, Task } from '../types/index.js';
interface TaskDetailViewProps {
    session: Session;
    tasks: Task[] | undefined;
    loading: boolean;
}
export declare function TaskDetailView({ session, tasks, loading, }: TaskDetailViewProps): React.ReactElement;
export {};
//# sourceMappingURL=TaskDetailView.d.ts.map