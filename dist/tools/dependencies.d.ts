import 'dotenv/config';
export type ResourceType = 'file' | 'component' | 'api' | 'model';
export type ActionType = 'uses' | 'modifies' | 'creates';
export type ConflictSeverity = 'high' | 'medium' | 'low';
export type ConflictType = 'concurrent_write' | 'concurrent_modify' | 'potential_collision';
export interface ResourceNode {
    id: string;
    type: ResourceType;
    name: string;
    path?: string;
    createdAt: string;
}
export interface ResourceEdge {
    id: string;
    from: string;
    to: string;
    type: ActionType;
    taskId: string;
    createdAt: string;
}
export interface AnalyzedResource {
    type: ResourceType;
    name: string;
    path?: string;
    action: ActionType;
    confidence: number;
}
export interface Conflict {
    taskId: string;
    taskTitle?: string;
    resourceId: string;
    resourceName: string;
    conflictType: ConflictType;
    severity: ConflictSeverity;
    description: string;
}
export interface DependencyGraph {
    nodes: ResourceNode[];
    edges: ResourceEdge[];
}
/**
 * NOTE: This module has been simplified. Direct codebase analysis has been moved to taskPreparation.ts
 * analyzeDependencies() is now deprecated - use prepare_task_for_execution instead
 *
 * The new flow:
 * 1. Call prepare_task_for_execution(taskId) - gets structured prompt
 * 2. Claude Code analyzes codebase using its tools (Read, Grep, Glob)
 * 3. Call save_task_analysis(taskId, analysis) - saves results
 * 4. Call get_execution_prompt(taskId) - gets enriched prompt
 */
export declare function saveDependencies(taskId: string, resources: AnalyzedResource[]): Promise<{
    success: boolean;
    conflicts?: Conflict[];
    resourceIds?: string[];
    error?: string;
}>;
export declare function getTaskDependencyGraph(taskId: string): Promise<DependencyGraph | null>;
export declare function getResourceUsage(resourceId: string): Promise<{
    resource: ResourceNode | null;
    tasks: Array<{
        taskId: string;
        taskTitle?: string;
        action: ActionType;
    }>;
}>;
export declare function getTaskConflicts(taskId: string): Promise<Conflict[]>;
