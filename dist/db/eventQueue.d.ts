export interface QueuedEvent {
    id?: string;
    event_type: 'task_created' | 'task_updated' | 'task_deleted' | 'feedback_received' | 'codebase_analyzed' | 'decision_made' | 'guardian_intervention' | 'code_changed' | 'status_transition' | 'user_story_created' | 'user_story_deleted' | 'dependency_added' | 'dependency_removed' | 'execution_order_changed' | 'auto_analysis_started' | 'task_analysis_prepared' | 'auto_analysis_completed';
    payload: any;
    processed?: boolean;
    created_at?: string;
    processed_at?: string;
}
export declare function emitEvent(eventType: QueuedEvent['event_type'], payload: any): Promise<void>;
export declare function fetchUnprocessedEvents(limit?: number): Promise<QueuedEvent[]>;
export declare function markEventProcessed(eventId: string): Promise<void>;
/**
 * Emit a dependency_added event
 */
export declare function emitDependencyAdded(taskId: string, resourceId: string, resourceName: string, action: string): Promise<void>;
/**
 * Emit a dependency_removed event
 */
export declare function emitDependencyRemoved(taskId: string, resourceId: string, resourceName: string): Promise<void>;
/**
 * Emit an execution_order_changed event
 */
export declare function emitExecutionOrderChanged(affectedTasks: string[]): Promise<void>;
