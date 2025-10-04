import { ToolOrchestrationContext, ToolRecommendation, MCPToolInfo, ToolRecommendationEngine, ToolUsageStats, RecommendationAlgorithmConfig } from '../types/mcp-tools.js';
export declare class MCPToolOrchestrator implements ToolRecommendationEngine {
    private config;
    constructor(config?: Partial<RecommendationAlgorithmConfig>);
    /**
     * Analyze task and recommend appropriate MCP tools
     */
    analyzeTaskForTools(context: ToolOrchestrationContext): Promise<ToolRecommendation[]>;
    /**
     * Get tool by name
     */
    getTool(name: string, projectId?: string): Promise<MCPToolInfo | null>;
    /**
     * Record tool usage for learning and statistics
     */
    recordToolUsage(toolName: string, success: boolean, metadata?: Record<string, any>): Promise<void>;
    /**
     * Get tool usage statistics
     */
    getToolStats(toolName: string, projectId?: string): Promise<ToolUsageStats | null>;
    /**
     * Get all enabled tools for a project
     */
    getEnabledTools(projectId: string): Promise<MCPToolInfo[]>;
}
/**
 * Helper function to enrich task context with recommended tools
 */
export declare function enrichTaskContextWithTools(taskId: string, taskDescription: string): Promise<{
    recommendedTools: ToolRecommendation[];
    toolInstructions: string;
}>;
