export interface HistoryEvent {
    id: string;
    event_type: 'task_created' | 'task_updated' | 'feedback_received' | 'decision_made' | 'guardian_intervention' | 'code_changed' | 'status_transition';
    timestamp: string;
    payload: any;
    actor: 'claude' | 'human' | 'guardian' | 'system';
}
export interface DecisionEntry {
    taskId: string;
    decision: string;
    rationale: string;
    timestamp: Date;
    actor: 'claude' | 'human';
    context?: string;
}
export interface CodeChangeEntry {
    taskId: string;
    files: string[];
    diff?: string;
    commitHash?: string;
    description: string;
    timestamp: Date;
}
export interface GuardianIntervention {
    taskId: string;
    guardianType: 'database' | 'architecture' | 'api' | 'production-ready' | 'test-maintainer';
    issue: string;
    action: string;
    timestamp: Date;
}
/**
 * Get complete history for a task
 */
export declare function getTaskHistory(taskId: string): Promise<HistoryEvent[]>;
/**
 * Get status transition history
 */
export declare function getStatusHistory(taskId: string): Promise<any[]>;
/**
 * Get decisions made for a task
 */
export declare function getDecisions(taskId: string): Promise<any[]>;
/**
 * Get guardian interventions for a task
 */
export declare function getGuardianInterventions(taskId: string): Promise<any[]>;
/**
 * Get code changes for a task
 */
export declare function getCodeChanges(taskId: string): Promise<any[]>;
/**
 * Record a decision
 */
export declare function recordDecision(entry: DecisionEntry): Promise<void>;
/**
 * Record a code change
 */
export declare function recordCodeChange(entry: CodeChangeEntry): Promise<void>;
/**
 * Record a guardian intervention
 */
export declare function recordGuardianIntervention(entry: GuardianIntervention): Promise<void>;
/**
 * Record a status transition with context
 */
export declare function recordStatusTransition(taskId: string, fromStatus: string, toStatus: string, reason?: string): Promise<void>;
/**
 * Get task iteration count
 */
export declare function getIterationCount(taskId: string): Promise<number>;
/**
 * Get snapshot of task at specific time
 */
export declare function getTaskSnapshot(taskId: string, timestamp: Date): Promise<any>;
/**
 * Rollback task to previous state
 */
export declare function rollbackTask(taskId: string, targetTimestamp: Date): Promise<any>;
/**
 * Get aggregated stats for task
 */
export declare function getTaskStats(taskId: string): Promise<{
    totalEvents: number;
    iterations: number;
    decisions: number;
    guardianInterventions: number;
    codeChanges: number;
    statusTransitions: number;
    firstEvent: string;
    lastEvent: string;
}>;
