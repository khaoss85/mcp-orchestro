export interface QueuedEvent {
    id?: string;
    event_type: 'task_created' | 'task_updated' | 'feedback_received' | 'codebase_analyzed' | 'decision_made' | 'guardian_intervention' | 'code_changed' | 'status_transition';
    payload: any;
    processed?: boolean;
    created_at?: string;
    processed_at?: string;
}
export declare function emitEvent(eventType: QueuedEvent['event_type'], payload: any): Promise<void>;
export declare function fetchUnprocessedEvents(limit?: number): Promise<QueuedEvent[]>;
export declare function markEventProcessed(eventId: string): Promise<void>;
