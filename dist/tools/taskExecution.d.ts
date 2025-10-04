export interface TaskExecutionNode {
    id: string;
    title: string;
    executionOrder: number;
    dependencies: string[];
}
export interface ExecutionOrderResult {
    success: boolean;
    executionOrder?: TaskExecutionNode[];
    error?: string;
    cycleDetected?: boolean;
    cyclePath?: string[];
}
/**
 * Get execution order for tasks in a project or user story
 *
 * @param params - Filter parameters
 * @returns Topologically sorted tasks with execution order numbers
 */
export declare function getExecutionOrder(params?: {
    userStoryId?: string;
    status?: 'backlog' | 'todo' | 'in_progress' | 'done';
}): Promise<ExecutionOrderResult>;
