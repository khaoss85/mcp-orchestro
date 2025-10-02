/**
 * Task Preparation - Orchestrates analysis by requesting Claude Code to inspect codebase
 *
 * This module doesn't analyze code directly - instead it provides structured prompts
 * that guide Claude Code to analyze the codebase using its own tools (Read, Grep, Glob, etc.)
 */
export interface AnalysisRequest {
    taskId: string;
    taskTitle: string;
    taskDescription: string;
    prompt: string;
    searchPatterns: string[];
    filesToCheck: string[];
    risksToIdentify: string[];
}
/**
 * Prepares a task for execution by generating a structured analysis request for Claude Code
 *
 * Claude Code will receive this and use its tools to analyze the codebase, then call
 * save_task_analysis with the results.
 */
export declare function prepareTaskForExecution(taskId: string): Promise<AnalysisRequest>;
