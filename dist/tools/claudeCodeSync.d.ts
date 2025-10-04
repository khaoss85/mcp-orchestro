interface ParsedAgent {
    name: string;
    description: string;
    model: string;
    tools: string[];
    prompt: string;
    filePath: string;
    rawYaml: string;
}
interface ClaudeCodeAgent {
    id: string;
    name: string;
    agentType: string;
    description: string;
    model: string;
    tools: string[];
    promptTemplate: string;
    filePath: string;
    yamlConfig: any;
    lastSyncedAt: string;
}
export declare function readClaudeCodeAgents(params: {
    agentsDir?: string;
}): Promise<{
    success: boolean;
    agents: ParsedAgent[];
    error?: string;
}>;
export declare function syncClaudeCodeAgents(params: {
    projectId: string;
    agentsDir?: string;
}): Promise<{
    success: boolean;
    syncedCount: number;
    agents: ClaudeCodeAgent[];
    error?: string;
}>;
export declare function suggestAgentsForTask(params: {
    projectId: string;
    taskDescription: string;
    taskCategory?: string;
}): Promise<{
    success: boolean;
    suggestions: Array<{
        agentName: string;
        agentType: string;
        reason: string;
        confidence: number;
    }>;
    error?: string;
}>;
export declare function suggestToolsForTask(params: {
    projectId: string;
    taskDescription: string;
    taskCategory?: string;
}): Promise<{
    success: boolean;
    suggestions: Array<{
        toolName: string;
        category: string;
        reason: string;
        confidence: number;
    }>;
    error?: string;
}>;
export declare function updateAgentPromptTemplates(params: {
    projectId: string;
}): Promise<{
    success: boolean;
    updatedCount: number;
    error?: string;
}>;
export {};
