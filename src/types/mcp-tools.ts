// Orchestro MCP Tools Orchestration Types
// Types for MCP tool orchestration, recommendations, and usage tracking

// ============================================
// TOOL ORCHESTRATION TYPES
// ============================================

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

// ============================================
// TOOL REGISTRY TYPES
// ============================================

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

// ============================================
// DEFAULT TOOLS CONFIGURATION
// ============================================

export const DEFAULT_MCP_TOOLS: Record<string, Omit<ToolRegistryEntry, 'name'>> = {
  memory: {
    command: 'native-claude-memory',
    description: 'Access Claude\'s memory for past context and patterns',
    whenToUse: ['need past context', 'similar patterns', 'previous decisions', 'learned solutions'],
    priority: 1,
    category: 'native',
    examples: [
      {
        scenario: 'Implementing similar feature',
        taskDescription: 'Add user authentication',
        recommendedTools: ['memory'],
        reasoning: 'Check if similar authentication was implemented before',
      },
    ],
  },
  'sequential-thinking': {
    command: 'sequential-thinking-mcp',
    description: 'Complex logical reasoning and algorithm design',
    whenToUse: ['complex logic', 'algorithm design', 'step-by-step planning', 'problem decomposition'],
    priority: 2,
    category: 'mcp',
    examples: [
      {
        scenario: 'Complex algorithm',
        taskDescription: 'Implement graph traversal algorithm',
        recommendedTools: ['sequential-thinking'],
        reasoning: 'Break down complex algorithm into logical steps',
      },
    ],
  },
  github: {
    command: 'github-mcp',
    description: 'Access GitHub for version history and code review',
    whenToUse: ['version history', 'code review', 'pull requests', 'commit analysis'],
    priority: 2,
    category: 'mcp',
    requiredConfig: ['github_token'],
  },
  supabase: {
    command: '@supabase/mcp',
    description: 'Database operations and schema management',
    whenToUse: ['database operations', 'schema changes', 'migrations', 'queries'],
    priority: 1,
    category: 'mcp',
    requiredConfig: ['supabase_url', 'supabase_key'],
  },
  'claude-context': {
    command: 'context-mcp',
    description: 'Find similar code and search project',
    whenToUse: ['find similar code', 'search project', 'code discovery', 'pattern matching'],
    priority: 1,
    category: 'mcp',
  },
  orchestro: {
    command: 'orchestro',
    description: 'Task management and workflow orchestration',
    whenToUse: ['task management', 'workflow', 'project planning', 'dependency tracking'],
    priority: 1,
    category: 'native',
  },
};

// ============================================
// SUB-AGENT REGISTRY TYPES
// ============================================

export interface SubAgentRegistryEntry {
  name: string;
  agentType: string;
  description: string;
  whenToTrigger: string[];
  defaultPriority: number;
  capabilities: string[];
  defaultPrompt?: string;
}

export const DEFAULT_SUB_AGENTS: Record<string, SubAgentRegistryEntry> = {
  'architecture-guardian': {
    name: 'Architecture Guardian',
    agentType: 'architecture-guardian',
    description: 'Ensure architectural consistency and prevent violations',
    whenToTrigger: ['creating components', 'refactoring', 'module changes', 'architecture decisions'],
    defaultPriority: 1,
    capabilities: [
      'Detect circular dependencies',
      'Enforce layer boundaries',
      'Check naming conventions',
      'Validate module structure',
    ],
    defaultPrompt: 'Review architectural changes and ensure consistency with project patterns',
  },
  'database-guardian': {
    name: 'Database Guardian',
    agentType: 'database-guardian',
    description: 'Protect database schema and ensure data integrity',
    whenToTrigger: ['database changes', 'migrations', 'schema updates', 'model changes'],
    defaultPriority: 1,
    capabilities: [
      'Check schema consistency',
      'Prevent duplicate tables',
      'Validate migrations',
      'Ensure indexes on FKs',
    ],
    defaultPrompt: 'Review database changes and ensure schema integrity',
  },
  'test-maintainer': {
    name: 'Test Maintainer',
    agentType: 'test-maintainer',
    description: 'Maintain test coverage and quality',
    whenToTrigger: ['code changes', 'new features', 'refactoring', 'bug fixes'],
    defaultPriority: 2,
    capabilities: [
      'Ensure test coverage',
      'Validate test patterns',
      'Check test naming',
      'Update tests after changes',
    ],
    defaultPrompt: 'Update tests to cover recent changes',
  },
  'api-guardian': {
    name: 'API Guardian',
    agentType: 'api-guardian',
    description: 'Ensure API consistency between frontend and backend',
    whenToTrigger: ['api changes', 'endpoint modifications', 'schema updates', 'contract changes'],
    defaultPriority: 1,
    capabilities: [
      'Validate API contracts',
      'Check frontend-backend sync',
      'Ensure type safety',
      'Update API documentation',
    ],
    defaultPrompt: 'Ensure API changes are synchronized across frontend and backend',
  },
  'production-ready-code-reviewer': {
    name: 'Production Ready Code Reviewer',
    agentType: 'production-ready-code-reviewer',
    description: 'Ensure code is production-ready without placeholders',
    whenToTrigger: ['before commit', 'task completion', 'PR creation', 'deployment'],
    defaultPriority: 2,
    capabilities: [
      'Detect placeholders',
      'Check for TODOs',
      'Validate error handling',
      'Ensure logging',
    ],
    defaultPrompt: 'Review code for production readiness',
  },
  'general-purpose': {
    name: 'General Purpose',
    agentType: 'general-purpose',
    description: 'General-purpose agent for complex multi-step tasks',
    whenToTrigger: ['complex tasks', 'multi-step workflows', 'research', 'investigation'],
    defaultPriority: 3,
    capabilities: [
      'Multi-step execution',
      'Code search',
      'File operations',
      'Complex analysis',
    ],
  },
};

// ============================================
// TOOL USAGE TRACKING TYPES
// ============================================

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

// ============================================
// TOOL RECOMMENDATION ALGORITHM TYPES
// ============================================

export interface ToolMatchScore {
  toolName: string;
  keywordMatchCount: number;
  scenarioMatch: boolean;
  historicalSuccessRate: number;
  priorityScore: number;
  finalScore: number;
}

export interface RecommendationAlgorithmConfig {
  keywordWeight: number; // 0.0 to 1.0
  historicalWeight: number; // 0.0 to 1.0
  priorityWeight: number; // 0.0 to 1.0
  minimumConfidence: number; // 0.0 to 1.0
  maxRecommendations: number;
}

export const DEFAULT_RECOMMENDATION_CONFIG: RecommendationAlgorithmConfig = {
  keywordWeight: 0.4,
  historicalWeight: 0.3,
  priorityWeight: 0.3,
  minimumConfidence: 0.3,
  maxRecommendations: 5,
};
