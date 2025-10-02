/**
 * Task Analysis - Saves Claude Code's codebase analysis and generates execution prompts
 *
 * This module receives the results of Claude Code's codebase analysis and:
 * 1. Saves dependencies to the resource graph
 * 2. Records risks and recommendations
 * 3. Generates enriched prompts for task execution
 */
export interface TaskAnalysis {
    taskId: string;
    analysis: {
        filesToModify: Array<{
            path: string;
            reason: string;
            risk: 'low' | 'medium' | 'high';
        }>;
        filesToCreate: Array<{
            path: string;
            reason: string;
        }>;
        dependencies: Array<{
            type: 'file' | 'component' | 'api' | 'model';
            name: string;
            path: string;
            action: 'uses' | 'modifies' | 'creates';
        }>;
        risks: Array<{
            level: 'low' | 'medium' | 'high';
            description: string;
            mitigation: string;
        }>;
        relatedCode: Array<{
            file: string;
            description: string;
            lines?: string;
        }>;
        recommendations: string[];
    };
}
export interface ExecutionPrompt {
    taskId: string;
    taskTitle: string;
    taskDescription: string;
    prompt: string;
    context: {
        dependencies: any[];
        risks: any[];
        relatedCode: any[];
        recommendations: string[];
        patterns: any[];
        guidelines: string[];
    };
}
/**
 * Save the analysis performed by Claude Code
 */
export declare function saveTaskAnalysis(params: TaskAnalysis): Promise<{
    success: boolean;
    message: string;
}>;
/**
 * Generate enriched execution prompt with all context
 */
export declare function getExecutionPrompt(taskId: string): Promise<ExecutionPrompt>;
