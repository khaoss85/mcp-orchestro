import { ToolRegistryEntry, SubAgentRegistryEntry } from '../types/mcp-tools.js';
import { SubAgent, MCPTool } from '../types/configuration.js';
export declare class ToolRegistry {
    /**
     * Get all default MCP tools
     */
    static getDefaultTools(): ToolRegistryEntry[];
    /**
     * Get all default sub-agents
     */
    static getDefaultSubAgents(): SubAgentRegistryEntry[];
    /**
     * Get tool by name from registry
     */
    static getDefaultTool(name: string): ToolRegistryEntry | null;
    /**
     * Get sub-agent by type from registry
     */
    static getDefaultSubAgent(agentType: string): SubAgentRegistryEntry | null;
    /**
     * Initialize default tools for a project
     */
    static initializeDefaultToolsForProject(projectId: string): Promise<void>;
    /**
     * Initialize default sub-agents for a project
     */
    static initializeDefaultSubAgentsForProject(projectId: string): Promise<void>;
    /**
     * Get active sub-agents for a project
     */
    static getActiveSubAgents(projectId: string): Promise<SubAgent[]>;
    /**
     * Get active MCP tools for a project
     */
    static getActiveMCPTools(projectId: string): Promise<MCPTool[]>;
    /**
     * Match sub-agents to task description
     */
    static matchSubAgentsToTask(taskDescription: string, availableAgents: SubAgent[]): SubAgent[];
    /**
     * Build context instructions for sub-agents and tools
     */
    static buildToolingInstructions(subAgents: SubAgent[], mcpTools: MCPTool[]): string;
}
/**
 * Initialize complete tooling for a project
 */
export declare function initializeProjectTooling(projectId: string): Promise<void>;
