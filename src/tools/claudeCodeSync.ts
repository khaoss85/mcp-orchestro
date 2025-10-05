// Orchestro Claude Code Sync Tools
// Synchronize with Claude Code agents and MCP tools

import { promises as fs } from 'fs';
import path from 'path';
import { getSupabaseClient } from '../db/supabase.js';
import { cache } from '../db/cache.js';

// ============================================
// TYPES
// ============================================

interface AgentFrontmatter {
  name: string;
  description: string;
  model?: string;
  tools?: string[];
  [key: string]: any;
}

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

// ============================================
// YAML FRONTMATTER PARSER
// ============================================

function parseYamlFrontmatter(content: string): { frontmatter: AgentFrontmatter; body: string } {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    throw new Error('No YAML frontmatter found');
  }

  const [, yamlContent, body] = match;

  // Simple YAML parser (basic key-value pairs)
  const frontmatter: any = {};
  const lines = yamlContent.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;

    const key = trimmed.substring(0, colonIndex).trim();
    let value: any = trimmed.substring(colonIndex + 1).trim();

    // Handle string values
    if (value.startsWith('"') || value.startsWith("'")) {
      value = value.slice(1, -1);
    }

    // Handle multiline descriptions (basic support)
    if (value.includes('\\n')) {
      value = value.replace(/\\n/g, '\n');
    }

    frontmatter[key] = value;
  }

  return { frontmatter: frontmatter as AgentFrontmatter, body: body.trim() };
}

// ============================================
// READ CLAUDE CODE AGENTS
// ============================================

export async function readClaudeCodeAgents(params: {
  agentsDir?: string;
}): Promise<{
  success: boolean;
  agents: ParsedAgent[];
  error?: string;
}> {
  try {
    const agentsDir = params.agentsDir || path.join(process.cwd(), '.claude', 'agents');

    // Check if directory exists
    try {
      await fs.access(agentsDir);
    } catch {
      return {
        success: false,
        agents: [],
        error: `Agents directory not found: ${agentsDir}`,
      };
    }

    // Read all .md files
    const files = await fs.readdir(agentsDir);
    const mdFiles = files.filter(f => f.endsWith('.md'));

    if (mdFiles.length === 0) {
      return {
        success: true,
        agents: [],
      };
    }

    // Parse each agent file
    const agents: ParsedAgent[] = [];

    for (const file of mdFiles) {
      try {
        const filePath = path.join(agentsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');

        const { frontmatter, body } = parseYamlFrontmatter(content);

        agents.push({
          name: frontmatter.name || file.replace('.md', ''),
          description: frontmatter.description || '',
          model: frontmatter.model || 'sonnet',
          tools: frontmatter.tools || [],
          prompt: body,
          filePath,
          rawYaml: JSON.stringify(frontmatter),
        });
      } catch (err) {
        console.error(`Error parsing agent file ${file}:`, err);
        // Continue with other files
      }
    }

    return {
      success: true,
      agents,
    };
  } catch (error) {
    return {
      success: false,
      agents: [],
      error: (error as Error).message,
    };
  }
}

// ============================================
// SYNC AGENTS TO DATABASE
// ============================================

export async function syncClaudeCodeAgents(params: {
  projectId: string;
  agentsDir?: string;
}): Promise<{
  success: boolean;
  syncedCount: number;
  agents: ClaudeCodeAgent[];
  error?: string;
}> {
  try {
    const supabase = getSupabaseClient();

    // Read agents from filesystem
    const { success, agents, error } = await readClaudeCodeAgents({
      agentsDir: params.agentsDir,
    });

    if (!success) {
      return {
        success: false,
        syncedCount: 0,
        agents: [],
        error,
      };
    }

    // Map agent type from name
    const agentTypeMap: Record<string, string> = {
      'architecture-guardian': 'architecture-guardian',
      'database-guardian': 'database-guardian',
      'test-maintainer': 'test-maintainer',
      'api-guardian': 'api-guardian',
      'production-ready-code-reviewer': 'production-ready-code-reviewer',
    };

    const syncedAgents: ClaudeCodeAgent[] = [];

    for (const agent of agents) {
      const agentType = agentTypeMap[agent.name] || 'custom';

      // Upsert agent
      const { data, error: upsertError } = await supabase
        .from('sub_agents')
        .upsert(
          {
            project_id: params.projectId,
            name: agent.name,
            agent_type: agentType,
            enabled: true,
            description: agent.description,
            triggers: [], // Extract from description if needed
            custom_prompt: agent.prompt,
            rules: [],
            priority: 1,
            configuration: {
              model: agent.model,
              tools: agent.tools,
              filePath: agent.filePath,
              yamlConfig: JSON.parse(agent.rawYaml),
            },
          },
          {
            onConflict: 'project_id,name,agent_type',
          }
        )
        .select()
        .single();

      if (upsertError) {
        console.error(`Error upserting agent ${agent.name}:`, upsertError);
        continue;
      }

      syncedAgents.push({
        id: data.id,
        name: data.name,
        agentType: data.agent_type,
        description: agent.description,
        model: agent.model,
        tools: agent.tools,
        promptTemplate: data.custom_prompt,
        filePath: agent.filePath,
        yamlConfig: JSON.parse(agent.rawYaml),
        lastSyncedAt: data.updated_at,
      });
    }

    // Invalidate cache
    cache.invalidate(`config:${params.projectId}`);

    return {
      success: true,
      syncedCount: syncedAgents.length,
      agents: syncedAgents,
    };
  } catch (error) {
    return {
      success: false,
      syncedCount: 0,
      agents: [],
      error: (error as Error).message,
    };
  }
}

// ============================================
// GET AGENT SUGGESTIONS FOR TASK
// ============================================

export async function suggestAgentsForTask(params: {
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
}> {
  try {
    const supabase = getSupabaseClient();

    // Get all enabled agents
    const { data: agents, error } = await supabase
      .from('sub_agents')
      .select('*')
      .eq('project_id', params.projectId)
      .eq('enabled', true);

    if (error) {
      throw error;
    }

    const taskLower = params.taskDescription.toLowerCase();
    const categoryLower = params.taskCategory?.toLowerCase() || '';

    const suggestions: Array<{
      agentName: string;
      agentType: string;
      reason: string;
      confidence: number;
    }> = [];

    // Agent matching logic
    const agentRules: Record<string, { keywords: string[]; category?: string }> = {
      'database-guardian': {
        keywords: ['database', 'schema', 'migration', 'sql', 'table', 'entity', 'model'],
        category: 'backend_database',
      },
      'architecture-guardian': {
        keywords: ['component', 'refactor', 'architecture', 'module', 'dependency', 'structure'],
      },
      'test-maintainer': {
        keywords: ['test', 'unit test', 'integration', 'coverage', 'testing'],
        category: 'test_fix',
      },
      'api-guardian': {
        keywords: ['api', 'endpoint', 'route', 'rest', 'graphql', 'controller'],
        category: 'backend_database',
      },
      'production-ready-code-reviewer': {
        keywords: ['review', 'production', 'deploy', 'release', 'quality'],
      },
    };

    for (const agent of agents || []) {
      const rules = agentRules[agent.agent_type];
      if (!rules) continue;

      let matchCount = 0;
      const matchedKeywords: string[] = [];

      // Check keywords
      for (const keyword of rules.keywords) {
        if (taskLower.includes(keyword)) {
          matchCount++;
          matchedKeywords.push(keyword);
        }
      }

      // Check category match
      if (rules.category && categoryLower === rules.category) {
        matchCount += 2; // Category match is worth more
      }

      if (matchCount > 0) {
        const confidence = Math.min(0.95, matchCount / rules.keywords.length + 0.2);

        suggestions.push({
          agentName: agent.name,
          agentType: agent.agent_type,
          reason: `Matched keywords: ${matchedKeywords.join(', ')}`,
          confidence: Math.round(confidence * 100) / 100,
        });
      }
    }

    // Sort by confidence
    suggestions.sort((a, b) => b.confidence - a.confidence);

    return {
      success: true,
      suggestions: suggestions.slice(0, 3), // Top 3
    };
  } catch (error) {
    return {
      success: false,
      suggestions: [],
      error: (error as Error).message,
    };
  }
}

// ============================================
// SUGGEST MCP TOOLS FOR TASK
// ============================================

export async function suggestToolsForTask(params: {
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
}> {
  try {
    const supabase = getSupabaseClient();

    // Get all enabled MCP tools
    const { data: tools, error } = await supabase
      .from('mcp_tools')
      .select('*')
      .eq('project_id', params.projectId)
      .eq('enabled', true);

    if (error) {
      throw error;
    }

    const taskLower = params.taskDescription.toLowerCase();
    const categoryLower = params.taskCategory?.toLowerCase() || '';

    const suggestions: Array<{
      toolName: string;
      category: string;
      reason: string;
      confidence: number;
    }> = [];

    // Tool matching logic based on keywords
    const toolRules: Record<string, { keywords: string[]; category?: string }> = {
      memory: {
        keywords: ['remember', 'recall', 'previous', 'history', 'pattern', 'similar'],
      },
      'sequential-thinking': {
        keywords: ['complex', 'analyze', 'solve', 'algorithm', 'logic', 'reasoning'],
      },
      supabase: {
        keywords: ['database', 'query', 'schema', 'migration', 'sql', 'table'],
        category: 'backend_database',
      },
      'claude-context': {
        keywords: ['search', 'codebase', 'find', 'context', 'semantic'],
      },
      orchestro: {
        keywords: ['task', 'workflow', 'decompose', 'project', 'management'],
      },
    };

    for (const tool of tools || []) {
      const rules = toolRules[tool.name];
      if (!rules) continue;

      let matchCount = 0;
      const matchedKeywords: string[] = [];

      // Check keywords
      for (const keyword of rules.keywords) {
        if (taskLower.includes(keyword)) {
          matchCount++;
          matchedKeywords.push(keyword);
        }
      }

      // Check category match
      if (rules.category && categoryLower === rules.category) {
        matchCount += 2; // Category match is worth more
      }

      if (matchCount > 0) {
        const confidence = Math.min(0.95, matchCount / rules.keywords.length + 0.2);

        suggestions.push({
          toolName: tool.name,
          category: tool.tool_type,
          reason: `Matched keywords: ${matchedKeywords.join(', ')}`,
          confidence: Math.round(confidence * 100) / 100,
        });
      }
    }

    // Sort by confidence
    suggestions.sort((a, b) => b.confidence - a.confidence);

    return {
      success: true,
      suggestions: suggestions.slice(0, 3), // Top 3
    };
  } catch (error) {
    return {
      success: false,
      suggestions: [],
      error: (error as Error).message,
    };
  }
}

// ============================================
// UPDATE AGENT PROMPT TEMPLATES
// ============================================

export async function updateAgentPromptTemplates(params: {
  projectId: string;
}): Promise<{
  success: boolean;
  updatedCount: number;
  error?: string;
}> {
  try {
    const supabase = getSupabaseClient();

    // Default prompt templates for each agent type
    const promptTemplates: Record<string, string> = {
      'database-guardian': `You are the Database Guardian, an elite database architect and integrity specialist responsible for maintaining perfect alignment between your codebase and database schema.

When analyzing database changes:
1. Verify schema-code alignment
2. Prevent duplicate tables
3. Detect orphaned fields
4. Manage cascading relationships
5. Recommend optimization opportunities

Always provide specific file paths, table names, and actionable recommendations.`,

      'architecture-guardian': `You are the Architecture Guardian, an elite software architect specializing in maintaining codebase coherence and preventing duplication.

When reviewing code:
1. Scan for existing similar functionality
2. Prevent code duplication
3. Ensure architectural consistency
4. Check dependency graph impact
5. Suggest refactoring opportunities

Never approve new code without comprehensive codebase scan.`,

      'test-maintainer': `You are the Test Maintainer, responsible for ensuring comprehensive test coverage and quality.

When handling code changes:
1. Update existing tests
2. Create new tests for new features
3. Ensure test naming conventions
4. Maintain test coverage standards
5. Clean up temporary test files

Always run tests before marking task complete.`,

      'api-guardian': `You are the API Guardian, ensuring consistency between frontend and backend.

When API changes occur:
1. Verify API contract updates
2. Check frontend-backend synchronization
3. Ensure type safety across layers
4. Update API documentation
5. Validate response structures

Never allow breaking changes without migration path.`,

      'production-ready-code-reviewer': `You are the Production Ready Code Reviewer, ensuring code quality before deployment.

Review checklist:
1. No placeholders or TODOs
2. Proper error handling
3. Logging and monitoring
4. Security considerations
5. Performance optimization

Block deployment if quality standards not met.`,
    };

    let updatedCount = 0;

    for (const [agentType, template] of Object.entries(promptTemplates)) {
      const { error } = await supabase
        .from('sub_agents')
        .update({
          custom_prompt: template,
        })
        .eq('project_id', params.projectId)
        .eq('agent_type', agentType);

      if (!error) {
        updatedCount++;
      }
    }

    // Invalidate cache
    cache.invalidate(`config:${params.projectId}`);

    return {
      success: true,
      updatedCount,
    };
  } catch (error) {
    return {
      success: false,
      updatedCount: 0,
      error: (error as Error).message,
    };
  }
}
