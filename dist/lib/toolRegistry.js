// Orchestro MCP Tools Registry
// Central registry for all available MCP tools and sub-agents
import { getSupabaseClient } from '../db/supabase.js';
import { DEFAULT_MCP_TOOLS, DEFAULT_SUB_AGENTS, } from '../types/mcp-tools.js';
export class ToolRegistry {
    /**
     * Get all default MCP tools
     */
    static getDefaultTools() {
        return Object.entries(DEFAULT_MCP_TOOLS).map(([name, config]) => ({
            name,
            ...config,
        }));
    }
    /**
     * Get all default sub-agents
     */
    static getDefaultSubAgents() {
        return Object.values(DEFAULT_SUB_AGENTS);
    }
    /**
     * Get tool by name from registry
     */
    static getDefaultTool(name) {
        const config = DEFAULT_MCP_TOOLS[name];
        if (!config)
            return null;
        return {
            name,
            ...config,
        };
    }
    /**
     * Get sub-agent by type from registry
     */
    static getDefaultSubAgent(agentType) {
        return DEFAULT_SUB_AGENTS[agentType] || null;
    }
    /**
     * Initialize default tools for a project
     */
    static async initializeDefaultToolsForProject(projectId) {
        const supabase = getSupabaseClient();
        // Check if tools already exist
        const { data: existing } = await supabase
            .from('mcp_tools')
            .select('id')
            .eq('project_id', projectId)
            .limit(1);
        if (existing && existing.length > 0) {
            console.log('Tools already initialized for project:', projectId);
            return;
        }
        // Insert default tools
        const defaultTools = this.getDefaultTools().map(tool => ({
            project_id: projectId,
            name: tool.name,
            tool_type: tool.name, // Use name as type for defaults
            command: tool.command,
            enabled: true,
            when_to_use: tool.whenToUse,
            priority: tool.priority,
            configuration: {},
        }));
        const { error } = await supabase.from('mcp_tools').insert(defaultTools);
        if (error) {
            console.error('Error initializing default tools:', error);
            throw error;
        }
        console.log('Default tools initialized for project:', projectId);
    }
    /**
     * Initialize default sub-agents for a project
     */
    static async initializeDefaultSubAgentsForProject(projectId) {
        const supabase = getSupabaseClient();
        // Check if sub-agents already exist
        const { data: existing } = await supabase
            .from('sub_agents')
            .select('id')
            .eq('project_id', projectId)
            .limit(1);
        if (existing && existing.length > 0) {
            console.log('Sub-agents already initialized for project:', projectId);
            return;
        }
        // Insert default sub-agents
        const defaultAgents = this.getDefaultSubAgents().map(agent => ({
            project_id: projectId,
            name: agent.name,
            agent_type: agent.agentType,
            enabled: true,
            triggers: agent.whenToTrigger,
            custom_prompt: agent.defaultPrompt,
            rules: [],
            priority: agent.defaultPriority,
            configuration: {
                capabilities: agent.capabilities,
            },
        }));
        const { error } = await supabase.from('sub_agents').insert(defaultAgents);
        if (error) {
            console.error('Error initializing default sub-agents:', error);
            throw error;
        }
        console.log('Default sub-agents initialized for project:', projectId);
    }
    /**
     * Get active sub-agents for a project
     */
    static async getActiveSubAgents(projectId) {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
            .from('sub_agents')
            .select('*')
            .eq('project_id', projectId)
            .eq('enabled', true)
            .order('priority', { ascending: true });
        if (error) {
            console.error('Error fetching active sub-agents:', error);
            return [];
        }
        return (data || []).map((row) => ({
            id: row.id,
            projectId: row.project_id,
            name: row.name,
            agentType: row.agent_type,
            enabled: row.enabled,
            triggers: row.triggers || [],
            customPrompt: row.custom_prompt,
            rules: row.rules || [],
            priority: row.priority,
            configuration: row.configuration || {},
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        }));
    }
    /**
     * Get active MCP tools for a project
     */
    static async getActiveMCPTools(projectId) {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
            .from('mcp_tools')
            .select('*')
            .eq('project_id', projectId)
            .eq('enabled', true)
            .order('priority', { ascending: true });
        if (error) {
            console.error('Error fetching active MCP tools:', error);
            return [];
        }
        return (data || []).map((row) => ({
            id: row.id,
            projectId: row.project_id,
            name: row.name,
            toolType: row.tool_type,
            command: row.command,
            enabled: row.enabled,
            whenToUse: row.when_to_use || [],
            priority: row.priority,
            url: row.url,
            apiKey: row.api_key,
            fallbackTool: row.fallback_tool,
            configuration: row.configuration || {},
            usageCount: row.usage_count || 0,
            successCount: row.success_count || 0,
            lastUsedAt: row.last_used_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        }));
    }
    /**
     * Match sub-agents to task description
     */
    static matchSubAgentsToTask(taskDescription, availableAgents) {
        const taskLower = taskDescription.toLowerCase();
        return availableAgents
            .filter(agent => {
            // Check if any trigger matches
            return agent.triggers.some(trigger => taskLower.includes(trigger.toLowerCase()));
        })
            .sort((a, b) => a.priority - b.priority);
    }
    /**
     * Build context instructions for sub-agents and tools
     */
    static buildToolingInstructions(subAgents, mcpTools) {
        let instructions = '';
        if (subAgents.length > 0) {
            instructions += `\n## Recommended Sub-Agents\n\n`;
            instructions += `The following Claude Code sub-agents are recommended for this task:\n\n`;
            subAgents.forEach((agent, idx) => {
                instructions += `${idx + 1}. **${agent.name}** (${agent.agentType})\n`;
                if (agent.customPrompt) {
                    instructions += `   - Instruction: ${agent.customPrompt}\n`;
                }
                instructions += `   - Triggers: ${agent.triggers.join(', ')}\n`;
                instructions += `   - Priority: ${agent.priority}\n\n`;
            });
        }
        if (mcpTools.length > 0) {
            instructions += `\n## Recommended MCP Tools\n\n`;
            instructions += `The following MCP tools are available for this task:\n\n`;
            mcpTools.forEach((tool, idx) => {
                instructions += `${idx + 1}. **${tool.name}** (${tool.toolType})\n`;
                instructions += `   - Command: ${tool.command}\n`;
                instructions += `   - When to use: ${tool.whenToUse.join(', ')}\n`;
                instructions += `   - Priority: ${tool.priority}\n\n`;
            });
        }
        return instructions.trim();
    }
}
/**
 * Initialize complete tooling for a project
 */
export async function initializeProjectTooling(projectId) {
    console.log('Initializing tooling for project:', projectId);
    await Promise.all([
        ToolRegistry.initializeDefaultToolsForProject(projectId),
        ToolRegistry.initializeDefaultSubAgentsForProject(projectId),
    ]);
    console.log('Project tooling initialized successfully');
}
