import 'dotenv/config';
export interface IntelligentDecomposeRequest {
    userStory: string;
    projectId?: string;
}
export interface StoryDecompositionTask {
    title: string;
    description: string;
    complexity: 'simple' | 'medium' | 'complex';
    estimatedHours?: number;
    dependencies: string[];
    tags: string[];
    category?: 'design_frontend' | 'backend_database' | 'test_fix';
    filesToModify?: Array<{
        path: string;
        reason: string;
        risk: 'low' | 'medium' | 'high';
    }>;
    filesToCreate?: Array<{
        path: string;
        reason: string;
    }>;
    codebaseReferences?: Array<{
        file: string;
        description: string;
        lines?: string;
    }>;
}
export interface StoryAnalysisResult {
    tasks: StoryDecompositionTask[];
    overallComplexity: 'simple' | 'medium' | 'complex';
    totalEstimatedHours: number;
    architectureNotes?: string[];
    risks?: Array<{
        level: 'low' | 'medium' | 'high';
        description: string;
        mitigation: string;
    }>;
    recommendations?: string[];
}
/**
 * Generates an intelligent prompt for Claude Code to analyze the codebase
 * and decompose the user story based on real project context
 */
export declare function intelligent_decompose_story(request: IntelligentDecomposeRequest): Promise<any>;
/**
 * Saves the decomposition analysis performed by Claude Code
 */
export declare function save_story_decomposition(args: {
    projectId?: string;
    userStory: string;
    analysis: StoryAnalysisResult;
}): Promise<any>;
