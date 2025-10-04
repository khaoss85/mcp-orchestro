// Orchestro MCP Tools Orchestration System
// Intelligent tool recommendation and orchestration
import { getSupabaseClient } from '../db/supabase.js';
import { DEFAULT_RECOMMENDATION_CONFIG, } from '../types/mcp-tools.js';
export class MCPToolOrchestrator {
    config;
    constructor(config = {}) {
        this.config = { ...DEFAULT_RECOMMENDATION_CONFIG, ...config };
    }
    /**
     * Analyze task and recommend appropriate MCP tools
     */
    async analyzeTaskForTools(context) {
        const supabase = getSupabaseClient();
        // Get project ID from task
        const { data: taskData } = await supabase
            .from('tasks')
            .select('project_id')
            .eq('id', context.taskId)
            .single();
        if (!taskData) {
            throw new Error(`Task not found: ${context.taskId}`);
        }
        const projectId = taskData.project_id;
        // Use the database function to get recommendations
        const { data: recommendations, error } = await supabase.rpc('recommend_tools_for_task', {
            p_task_description: `${context.taskTitle} ${context.taskDescription}`,
            p_project_id: projectId,
            p_limit: this.config.maxRecommendations,
        });
        if (error) {
            console.error('Error getting tool recommendations:', error);
            return [];
        }
        // Filter by minimum confidence
        return (recommendations || [])
            .filter((rec) => rec.confidence >= this.config.minimumConfidence)
            .map((rec) => ({
            toolName: rec.tool_name,
            toolType: rec.tool_type,
            reason: rec.reason,
            confidence: parseFloat(rec.confidence),
            priority: rec.priority,
            whenToUse: rec.reason.split(', '),
        }));
    }
    /**
     * Get tool by name
     */
    async getTool(name, projectId) {
        const supabase = getSupabaseClient();
        let query = supabase
            .from('mcp_tools')
            .select('*')
            .eq('name', name)
            .eq('enabled', true);
        if (projectId) {
            query = query.eq('project_id', projectId);
        }
        const { data, error } = await query.maybeSingle();
        if (error || !data) {
            return null;
        }
        return {
            name: data.name,
            command: data.command,
            toolType: data.tool_type,
            whenToUse: data.when_to_use || [],
            priority: data.priority,
            enabled: data.enabled,
            configuration: data.configuration,
        };
    }
    /**
     * Record tool usage for learning and statistics
     */
    async recordToolUsage(toolName, success, metadata) {
        const supabase = getSupabaseClient();
        // Update usage statistics
        const { data: tool } = await supabase
            .from('mcp_tools')
            .select('id, usage_count, success_count')
            .eq('name', toolName)
            .maybeSingle();
        if (!tool) {
            console.warn(`Tool not found for usage tracking: ${toolName}`);
            return;
        }
        await supabase
            .from('mcp_tools')
            .update({
            usage_count: tool.usage_count + 1,
            success_count: success ? tool.success_count + 1 : tool.success_count,
            last_used_at: new Date().toISOString(),
        })
            .eq('id', tool.id);
    }
    /**
     * Get tool usage statistics
     */
    async getToolStats(toolName, projectId) {
        const supabase = getSupabaseClient();
        let query = supabase
            .from('mcp_tools')
            .select('*')
            .eq('name', toolName);
        if (projectId) {
            query = query.eq('project_id', projectId);
        }
        const { data, error } = await query.maybeSingle();
        if (error || !data) {
            return null;
        }
        const successRate = data.usage_count > 0 ? data.success_count / data.usage_count : 0;
        return {
            toolName: data.name,
            totalUsage: data.usage_count,
            successCount: data.success_count,
            failureCount: data.usage_count - data.success_count,
            successRate: Math.round(successRate * 100) / 100,
            lastUsed: data.last_used_at,
            commonScenarios: data.when_to_use || [],
        };
    }
    /**
     * Get all enabled tools for a project
     */
    async getEnabledTools(projectId) {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
            .from('mcp_tools')
            .select('*')
            .eq('project_id', projectId)
            .eq('enabled', true)
            .order('priority', { ascending: true });
        if (error) {
            console.error('Error fetching enabled tools:', error);
            return [];
        }
        return (data || []).map((tool) => ({
            name: tool.name,
            command: tool.command,
            toolType: tool.tool_type,
            whenToUse: tool.when_to_use || [],
            priority: tool.priority,
            enabled: tool.enabled,
            configuration: tool.configuration,
        }));
    }
}
/**
 * Helper function to enrich task context with recommended tools
 */
export async function enrichTaskContextWithTools(taskId, taskDescription) {
    const orchestrator = new MCPToolOrchestrator();
    const recommendations = await orchestrator.analyzeTaskForTools({
        taskId,
        taskTitle: '',
        taskDescription,
    });
    if (recommendations.length === 0) {
        return {
            recommendedTools: [],
            toolInstructions: '',
        };
    }
    // Build instructions for Claude Code
    const toolInstructions = `
## Recommended MCP Tools

Based on your task description, the following MCP tools are recommended:

${recommendations
        .map((rec, idx) => `
${idx + 1}. **${rec.toolName}** (${rec.toolType})
   - Confidence: ${Math.round(rec.confidence * 100)}%
   - When to use: ${rec.reason}
   - Priority: ${rec.priority}
`)
        .join('\n')}

**Usage Instructions:**
- Use these tools when their scenarios match your current needs
- Higher confidence tools are more likely to be helpful
- Lower priority number = higher priority
- Consult tool documentation if needed
`.trim();
    return {
        recommendedTools: recommendations,
        toolInstructions,
    };
}
