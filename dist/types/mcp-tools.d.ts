export interface ToolOrchestrationContext {
    taskId: string;
    taskTitle: string;
    taskDescription: string;
    taskType?: string;
    existingTools?: string[];
    metadata?: Record<string, any>;
}
export interface ToolRecommendationEngine {
    /**
     * Analyze task and recommend appropriate tools
     */
    analyzeTaskForTools(context: ToolOrchestrationContext): Promise<ToolRecommendation[]>;
    /**
     * Get tool by name
     */
    getTool(name: string): Promise<MCPToolInfo | null>;
    /**
     * Record tool usage
     */
    recordToolUsage(toolName: string, success: boolean, metadata?: Record<string, any>): Promise<void>;
}
export interface ToolRecommendation {
    toolName: string;
    toolType: string;
    reason: string;
    confidence: number;
    priority: number;
    whenToUse: string[];
}
export interface MCPToolInfo {
    name: string;
    command: string;
    toolType: string;
    whenToUse: string[];
    priority: number;
    enabled: boolean;
    configuration?: Record<string, any>;
}
export interface ToolRegistryEntry {
    name: string;
    command: string;
    description: string;
    whenToUse: string[];
    priority: number;
    category: 'native' | 'mcp' | 'custom';
    requiredConfig?: string[];
    examples?: ToolUsageExample[];
}
export interface ToolUsageExample {
    scenario: string;
    taskDescription: string;
    recommendedTools: string[];
    reasoning: string;
}
export declare const DEFAULT_MCP_TOOLS: Record<string, Omit<ToolRegistryEntry, 'name'>>;
export interface SubAgentRegistryEntry {
    name: string;
    agentType: string;
    description: string;
    whenToTrigger: string[];
    defaultPriority: number;
    capabilities: string[];
    defaultPrompt?: string;
}
export declare const DEFAULT_SUB_AGENTS: Record<string, SubAgentRegistryEntry>;
export interface ToolUsageStats {
    toolName: string;
    totalUsage: number;
    successCount: number;
    failureCount: number;
    successRate: number;
    averageExecutionTime?: number;
    lastUsed?: string;
    commonScenarios: string[];
}
export interface ToolUsageRecord {
    id: string;
    toolName: string;
    taskId: string;
    success: boolean;
    executionTime?: number;
    errorMessage?: string;
    metadata?: Record<string, any>;
    createdAt: string;
}
export interface ToolMatchScore {
    toolName: string;
    keywordMatchCount: number;
    scenarioMatch: boolean;
    historicalSuccessRate: number;
    priorityScore: number;
    finalScore: number;
}
export interface RecommendationAlgorithmConfig {
    keywordWeight: number;
    historicalWeight: number;
    priorityWeight: number;
    minimumConfidence: number;
    maxRecommendations: number;
}
export declare const DEFAULT_RECOMMENDATION_CONFIG: RecommendationAlgorithmConfig;
