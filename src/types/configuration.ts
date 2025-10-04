// Orchestro Configuration System Types
// Types for project configuration, tech stack, sub-agents, MCP tools, and guidelines

// ============================================
// TECH STACK TYPES
// ============================================

export type TechStackCategory = 'frontend' | 'backend' | 'database' | 'testing' | 'deployment' | 'other';

export interface TechStack {
  id: string;
  projectId: string;
  category: TechStackCategory;
  framework: string;
  version?: string;
  isPrimary: boolean;
  configuration: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface TechStackInput {
  category: TechStackCategory;
  framework: string;
  version?: string;
  isPrimary?: boolean;
  configuration?: Record<string, any>;
}

// ============================================
// SUB AGENTS TYPES
// ============================================

export type SubAgentType =
  | 'architecture-guardian'
  | 'database-guardian'
  | 'test-maintainer'
  | 'api-guardian'
  | 'production-ready-code-reviewer'
  | 'general-purpose'
  | 'custom';

export interface SubAgent {
  id: string;
  projectId: string;
  name: string;
  agentType: SubAgentType;
  enabled: boolean;
  triggers: string[];
  customPrompt?: string;
  rules: SubAgentRule[];
  priority: number;
  configuration: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface SubAgentRule {
  condition: string;
  action: string;
  description?: string;
}

export interface SubAgentInput {
  name: string;
  agentType: SubAgentType;
  enabled?: boolean;
  triggers?: string[];
  customPrompt?: string;
  rules?: SubAgentRule[];
  priority?: number;
  configuration?: Record<string, any>;
}

// ============================================
// MCP TOOLS TYPES
// ============================================

export type MCPToolType =
  | 'memory'
  | 'sequential-thinking'
  | 'github'
  | 'supabase'
  | 'claude-context'
  | 'orchestro'
  | 'custom';

export interface MCPTool {
  id: string;
  projectId: string;
  name: string;
  toolType: MCPToolType;
  command: string;
  enabled: boolean;
  whenToUse: string[];
  priority: number;
  url?: string;
  apiKey?: string;
  fallbackTool?: string;
  configuration: Record<string, any>;
  usageCount: number;
  successCount: number;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MCPToolInput {
  name: string;
  toolType: MCPToolType;
  command: string;
  enabled?: boolean;
  whenToUse?: string[];
  priority?: number;
  url?: string;
  apiKey?: string;
  fallbackTool?: string;
  configuration?: Record<string, any>;
}

export interface ToolRecommendation {
  toolName: string;
  toolType: MCPToolType;
  reason: string;
  confidence: number;
  priority: number;
}

// ============================================
// PROJECT GUIDELINES TYPES
// ============================================

export type GuidelineType = 'always' | 'never' | 'pattern' | 'architecture' | 'best_practice';

export interface ProjectGuideline {
  id: string;
  projectId: string;
  guidelineType: GuidelineType;
  title: string;
  description: string;
  example?: string;
  category?: string;
  priority: number;
  tags: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectGuidelineInput {
  guidelineType: GuidelineType;
  title: string;
  description: string;
  example?: string;
  category?: string;
  priority?: number;
  tags?: string[];
  isActive?: boolean;
}

// ============================================
// CODE PATTERNS LIBRARY TYPES
// ============================================

export interface CodePattern {
  id: string;
  projectId: string;
  name: string;
  description: string;
  exampleCode?: string;
  language?: string;
  framework?: string;
  category?: string;
  tags: string[];
  usageCount: number;
  successRate: number;
  createdAt: string;
  updatedAt: string;
}

export interface CodePatternInput {
  name: string;
  description: string;
  exampleCode?: string;
  language?: string;
  framework?: string;
  category?: string;
  tags?: string[];
}

// ============================================
// PROJECT CONFIGURATION TYPES
// ============================================

export interface ProjectConfiguration {
  id: string;
  projectId: string;
  name: string;
  version: number;
  isActive: boolean;
  configuration: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CompleteProjectConfig {
  projectId: string;
  techStack: TechStack[];
  subAgents: SubAgent[];
  mcpTools: MCPTool[];
  guidelines: {
    always: string[];
    never: string[];
    patterns: Array<{
      name: string;
      description: string;
      example?: string;
    }>;
  };
  guardians: Array<{
    name: string;
    guardianType: string;
    enabled: boolean;
    canAutoFix: boolean;
    rules: any[];
    priority: number;
  }>;
}

export interface ConfigurationVersion {
  id: string;
  projectId: string;
  version: number;
  configurationSnapshot: CompleteProjectConfig;
  changesDescription?: string;
  createdBy?: string;
  createdAt: string;
}

// ============================================
// CONFIGURATION INPUT TYPES
// ============================================

export interface UpdateProjectConfigInput {
  techStack?: TechStackInput[];
  subAgents?: SubAgentInput[];
  mcpTools?: MCPToolInput[];
  guidelines?: {
    always?: string[];
    never?: string[];
    patterns?: CodePatternInput[];
  };
}

// ============================================
// DATABASE ROW TYPES (internal)
// ============================================

export interface TechStackRow {
  id: string;
  project_id: string;
  category: string;
  framework: string;
  version?: string;
  is_primary: boolean;
  configuration: any;
  created_at: string;
  updated_at: string;
}

export interface SubAgentRow {
  id: string;
  project_id: string;
  name: string;
  agent_type: string;
  enabled: boolean;
  triggers: string[];
  custom_prompt?: string;
  rules: any;
  priority: number;
  configuration: any;
  created_at: string;
  updated_at: string;
}

export interface MCPToolRow {
  id: string;
  project_id: string;
  name: string;
  tool_type: string;
  command: string;
  enabled: boolean;
  when_to_use: string[];
  priority: number;
  url?: string;
  api_key?: string;
  fallback_tool?: string;
  configuration: any;
  usage_count: number;
  success_count: number;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectGuidelineRow {
  id: string;
  project_id: string;
  guideline_type: string;
  title: string;
  description: string;
  example?: string;
  category?: string;
  priority: number;
  tags: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CodePatternRow {
  id: string;
  project_id: string;
  name: string;
  description: string;
  example_code?: string;
  language?: string;
  framework?: string;
  category?: string;
  tags: string[];
  usage_count: number;
  success_rate: number;
  created_at: string;
  updated_at: string;
}
