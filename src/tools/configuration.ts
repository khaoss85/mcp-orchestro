// Orchestro Configuration Management Tools
// MCP tools for managing project configuration

import { getSupabaseClient, withRetry } from '../db/supabase.js';
import { cache } from '../db/cache.js';
import {
  TechStack,
  SubAgent,
  MCPTool,
  ProjectGuideline,
  CodePattern,
  CompleteProjectConfig,
  TechStackInput,
  SubAgentInput,
  MCPToolInput,
  ProjectGuidelineInput,
  CodePatternInput,
} from '../types/configuration.js';
import { ToolRegistry, initializeProjectTooling } from '../lib/toolRegistry.js';
import { GuardianRegistry } from '../lib/guardians/GuardianRegistry.js';

// ============================================
// GET CONFIGURATION
// ============================================

export async function getProjectConfiguration(params: {
  projectId: string;
}): Promise<CompleteProjectConfig> {
  const cacheKey = `config:${params.projectId}`;

  return cache.getOrSet(
    cacheKey,
    async () => {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase.rpc('get_active_project_config', {
        p_project_id: params.projectId,
      });

      if (error) {
        throw new Error(`Failed to get project configuration: ${error.message}`);
      }

      return data;
    },
    10 * 60 * 1000 // 10 minutes cache
  );
}

// ============================================
// TECH STACK MANAGEMENT
// ============================================

export async function addTechStack(params: {
  projectId: string;
  techStack: TechStackInput;
}): Promise<TechStack> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('tech_stack')
    .insert({
      project_id: params.projectId,
      category: params.techStack.category,
      framework: params.techStack.framework,
      version: params.techStack.version,
      is_primary: params.techStack.isPrimary ?? false,
      configuration: params.techStack.configuration ?? {},
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add tech stack: ${error.message}`);
  }

  // Invalidate cache
  cache.invalidate(`config:${params.projectId}`);

  return {
    id: data.id,
    projectId: data.project_id,
    category: data.category,
    framework: data.framework,
    version: data.version,
    isPrimary: data.is_primary,
    configuration: data.configuration,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function updateTechStack(params: {
  id: string;
  updates: Partial<TechStackInput>;
}): Promise<TechStack> {
  const supabase = getSupabaseClient();

  const updateData: any = {};
  if (params.updates.framework) updateData.framework = params.updates.framework;
  if (params.updates.version !== undefined) updateData.version = params.updates.version;
  if (params.updates.isPrimary !== undefined) updateData.is_primary = params.updates.isPrimary;
  if (params.updates.configuration !== undefined)
    updateData.configuration = params.updates.configuration;

  const { data, error } = await supabase
    .from('tech_stack')
    .update(updateData)
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update tech stack: ${error.message}`);
  }

  // Invalidate cache
  cache.invalidate(`config:${data.project_id}`);

  return {
    id: data.id,
    projectId: data.project_id,
    category: data.category,
    framework: data.framework,
    version: data.version,
    isPrimary: data.is_primary,
    configuration: data.configuration,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function removeTechStack(params: { id: string }): Promise<{ success: boolean }> {
  const supabase = getSupabaseClient();

  // Get project_id before deleting
  const { data: techStack } = await supabase
    .from('tech_stack')
    .select('project_id')
    .eq('id', params.id)
    .single();

  const { error } = await supabase.from('tech_stack').delete().eq('id', params.id);

  if (error) {
    throw new Error(`Failed to remove tech stack: ${error.message}`);
  }

  // Invalidate cache
  if (techStack) {
    cache.invalidate(`config:${techStack.project_id}`);
  }

  return { success: true };
}

// ============================================
// SUB-AGENT MANAGEMENT
// ============================================

export async function addSubAgent(params: {
  projectId: string;
  subAgent: SubAgentInput;
}): Promise<SubAgent> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('sub_agents')
    .insert({
      project_id: params.projectId,
      name: params.subAgent.name,
      agent_type: params.subAgent.agentType,
      enabled: params.subAgent.enabled ?? true,
      triggers: params.subAgent.triggers ?? [],
      custom_prompt: params.subAgent.customPrompt,
      rules: params.subAgent.rules ?? [],
      priority: params.subAgent.priority ?? 5,
      configuration: params.subAgent.configuration ?? {},
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add sub-agent: ${error.message}`);
  }

  cache.invalidate(`config:${params.projectId}`);

  return {
    id: data.id,
    projectId: data.project_id,
    name: data.name,
    agentType: data.agent_type,
    enabled: data.enabled,
    triggers: data.triggers,
    customPrompt: data.custom_prompt,
    rules: data.rules,
    priority: data.priority,
    configuration: data.configuration,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function updateSubAgent(params: {
  id: string;
  updates: Partial<SubAgentInput>;
}): Promise<SubAgent> {
  const supabase = getSupabaseClient();

  const updateData: any = {};
  if (params.updates.name) updateData.name = params.updates.name;
  if (params.updates.enabled !== undefined) updateData.enabled = params.updates.enabled;
  if (params.updates.triggers) updateData.triggers = params.updates.triggers;
  if (params.updates.customPrompt !== undefined)
    updateData.custom_prompt = params.updates.customPrompt;
  if (params.updates.rules) updateData.rules = params.updates.rules;
  if (params.updates.priority !== undefined) updateData.priority = params.updates.priority;
  if (params.updates.configuration) updateData.configuration = params.updates.configuration;

  const { data, error } = await supabase
    .from('sub_agents')
    .update(updateData)
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update sub-agent: ${error.message}`);
  }

  cache.invalidate(`config:${data.project_id}`);

  return {
    id: data.id,
    projectId: data.project_id,
    name: data.name,
    agentType: data.agent_type,
    enabled: data.enabled,
    triggers: data.triggers,
    customPrompt: data.custom_prompt,
    rules: data.rules,
    priority: data.priority,
    configuration: data.configuration,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

// ============================================
// MCP TOOL MANAGEMENT
// ============================================

export async function addMCPTool(params: {
  projectId: string;
  tool: MCPToolInput;
}): Promise<MCPTool> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('mcp_tools')
    .insert({
      project_id: params.projectId,
      name: params.tool.name,
      tool_type: params.tool.toolType,
      command: params.tool.command,
      enabled: params.tool.enabled ?? true,
      when_to_use: params.tool.whenToUse ?? [],
      priority: params.tool.priority ?? 5,
      url: params.tool.url,
      api_key: params.tool.apiKey,
      fallback_tool: params.tool.fallbackTool,
      configuration: params.tool.configuration ?? {},
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add MCP tool: ${error.message}`);
  }

  cache.invalidate(`config:${params.projectId}`);

  return {
    id: data.id,
    projectId: data.project_id,
    name: data.name,
    toolType: data.tool_type,
    command: data.command,
    enabled: data.enabled,
    whenToUse: data.when_to_use,
    priority: data.priority,
    url: data.url,
    apiKey: data.api_key,
    fallbackTool: data.fallback_tool,
    configuration: data.configuration,
    usageCount: data.usage_count,
    successCount: data.success_count,
    lastUsedAt: data.last_used_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function updateMCPTool(params: {
  id: string;
  updates: Partial<MCPToolInput>;
}): Promise<MCPTool> {
  const supabase = getSupabaseClient();

  const updateData: any = {};
  if (params.updates.name) updateData.name = params.updates.name;
  if (params.updates.command) updateData.command = params.updates.command;
  if (params.updates.enabled !== undefined) updateData.enabled = params.updates.enabled;
  if (params.updates.whenToUse) updateData.when_to_use = params.updates.whenToUse;
  if (params.updates.priority !== undefined) updateData.priority = params.updates.priority;
  if (params.updates.url !== undefined) updateData.url = params.updates.url;
  if (params.updates.apiKey !== undefined) updateData.api_key = params.updates.apiKey;
  if (params.updates.fallbackTool !== undefined)
    updateData.fallback_tool = params.updates.fallbackTool;
  if (params.updates.configuration) updateData.configuration = params.updates.configuration;

  const { data, error } = await supabase
    .from('mcp_tools')
    .update(updateData)
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update MCP tool: ${error.message}`);
  }

  cache.invalidate(`config:${data.project_id}`);

  return {
    id: data.id,
    projectId: data.project_id,
    name: data.name,
    toolType: data.tool_type,
    command: data.command,
    enabled: data.enabled,
    whenToUse: data.when_to_use,
    priority: data.priority,
    url: data.url,
    apiKey: data.api_key,
    fallbackTool: data.fallback_tool,
    configuration: data.configuration,
    usageCount: data.usage_count,
    successCount: data.success_count,
    lastUsedAt: data.last_used_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

// ============================================
// GUIDELINE MANAGEMENT
// ============================================

export async function addGuideline(params: {
  projectId: string;
  guideline: ProjectGuidelineInput;
}): Promise<ProjectGuideline> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('project_guidelines')
    .insert({
      project_id: params.projectId,
      guideline_type: params.guideline.guidelineType,
      title: params.guideline.title,
      description: params.guideline.description,
      example: params.guideline.example,
      category: params.guideline.category,
      priority: params.guideline.priority ?? 5,
      tags: params.guideline.tags ?? [],
      is_active: params.guideline.isActive ?? true,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add guideline: ${error.message}`);
  }

  cache.invalidate(`config:${params.projectId}`);

  return {
    id: data.id,
    projectId: data.project_id,
    guidelineType: data.guideline_type,
    title: data.title,
    description: data.description,
    example: data.example,
    category: data.category,
    priority: data.priority,
    tags: data.tags,
    isActive: data.is_active,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

// ============================================
// CODE PATTERN MANAGEMENT
// ============================================

export async function addCodePattern(params: {
  projectId: string;
  pattern: CodePatternInput;
}): Promise<CodePattern> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('code_patterns_library')
    .insert({
      project_id: params.projectId,
      name: params.pattern.name,
      description: params.pattern.description,
      example_code: params.pattern.exampleCode,
      language: params.pattern.language,
      framework: params.pattern.framework,
      category: params.pattern.category,
      tags: params.pattern.tags ?? [],
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add code pattern: ${error.message}`);
  }

  cache.invalidate(`config:${params.projectId}`);

  return {
    id: data.id,
    projectId: data.project_id,
    name: data.name,
    description: data.description,
    exampleCode: data.example_code,
    language: data.language,
    framework: data.framework,
    category: data.category,
    tags: data.tags,
    usageCount: data.usage_count,
    successRate: data.success_rate,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

// ============================================
// INITIALIZATION
// ============================================

export async function initializeProjectConfiguration(params: {
  projectId: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    // Initialize tools and sub-agents
    await initializeProjectTooling(params.projectId);

    // Initialize guardians
    await GuardianRegistry.initializeDefaultGuardians(params.projectId);

    // Invalidate cache
    cache.invalidate(`config:${params.projectId}`);

    return {
      success: true,
      message: 'Project configuration initialized successfully',
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to initialize project configuration: ${error.message}`,
    };
  }
}
