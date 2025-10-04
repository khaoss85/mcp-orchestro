import 'dotenv/config';
import { Task } from './task.js';
export type Complexity = 'simple' | 'medium' | 'complex';
export interface DecomposedTaskData {
    title: string;
    description: string;
    complexity: Complexity;
    estimatedHours?: number;
    dependencies: string[];
    tags: string[];
}
export interface CreatedTaskInfo {
    task: Task;
    complexity: Complexity;
    estimatedHours?: number;
}
export interface DecompositionResult {
    success: boolean;
    originalStory: string;
    tasks?: CreatedTaskInfo[];
    dependencyMap?: Record<string, string[]>;
    totalEstimatedHours?: number;
    error?: string;
    nextSteps?: any;
    recommendedAnalysisOrder?: Array<{
        taskId: string;
        title: string;
    }>;
}
export declare function decomposeStory(userStory: string): Promise<DecompositionResult>;
