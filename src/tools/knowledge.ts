import { getSupabaseClient, withRetry } from '../db/supabase.js';
import { cache } from '../db/cache.js';
import { emitEvent } from '../db/eventQueue.js';

// Template for generating prompts and content
export interface Template {
  id: string;
  name: string;
  category: 'prompt' | 'code' | 'architecture' | 'review';
  content: string;
  variables: string[];
  created_at: string;
  updated_at: string;
}

// Pattern learned from the codebase
export interface Pattern {
  id: string;
  name: string;
  category: string;
  description: string;
  examples: string[];
  tags: string[];
  created_at: string;
  updated_at: string;
}

// Learning from past experience
export interface Learning {
  id: string;
  task_id?: string | null;
  context: string;
  action: string;
  result: string;
  lesson: string;
  type?: 'success' | 'failure' | 'improvement' | null;
  pattern?: string | null;
  tags: string[];
  created_at: string;
}

// Cache TTLs
const TEMPLATE_CACHE_TTL = 15 * 60 * 1000; // 15 minutes (rarely changes)
const PATTERN_CACHE_TTL = 15 * 60 * 1000; // 15 minutes (rarely changes)
const LEARNING_CACHE_TTL = 5 * 60 * 1000; // 5 minutes (more dynamic)

// Initialize mock data if tables are empty
async function ensureMockData() {
  const supabase = getSupabaseClient();

  // Check if templates exist
  const { count: templateCount } = await supabase
    .from('templates')
    .select('*', { count: 'exact', head: true });

  if (templateCount === 0) {
    // Insert mock templates
    await supabase.from('templates').insert([
      {
        name: 'Task Implementation Prompt',
        category: 'prompt',
        content: `You are implementing: {{taskTitle}}

Description: {{taskDescription}}

Previous Work Completed:
{{previousWork}}

Guidelines to Follow:
{{guidelines}}

Tech Stack:
{{techStack}}

Please implement this task following the established patterns.`,
        variables: ['taskTitle', 'taskDescription', 'previousWork', 'guidelines', 'techStack'],
      },
      {
        name: 'Code Review Prompt',
        category: 'review',
        content: `Review the following changes for task: {{taskTitle}}

Focus Areas:
- Code quality and patterns
- Test coverage
- Documentation
- Performance considerations

Previous similar work: {{previousWork}}`,
        variables: ['taskTitle', 'previousWork'],
      },
    ]);
  }

  // Check if patterns exist
  const { count: patternCount } = await supabase
    .from('patterns')
    .select('*', { count: 'exact', head: true });

  if (patternCount === 0) {
    // Insert mock patterns
    await supabase.from('patterns').insert([
      {
        name: 'Error Handling Pattern',
        category: 'error-handling',
        description: 'All functions return success/error response objects for consistent error handling',
        examples: [
          'function operation(): { success: boolean; data?: T; error?: string }',
          'if (!valid) return { success: false, error: "Validation failed" }',
          'return { success: true, data: result }',
        ],
        tags: ['error-handling', 'return-types', 'typescript'],
      },
      {
        name: 'In-Memory Storage Pattern',
        category: 'storage',
        description: 'Use Map<string, Entity> for in-memory storage with UUID keys',
        examples: [
          'const storage = new Map<string, Entity>()',
          'storage.set(entity.id, entity)',
          'storage.get(id)',
          'Array.from(storage.values())',
        ],
        tags: ['storage', 'in-memory', 'typescript', 'map'],
      },
      {
        name: 'MCP Tool Registration Pattern',
        category: 'mcp',
        description: 'MCP tools are registered in server.ts with name, description, and JSON schema',
        examples: [
          'Import function from tools/ directory',
          'Add tool definition to ListToolsRequestSchema handler',
          'Add handler in CallToolRequestSchema',
          'Use lowercase_with_underscores for tool names',
        ],
        tags: ['mcp', 'tools', 'server', 'registration'],
      },
    ]);
  }

  // Check if learnings exist
  const { count: learningCount } = await supabase
    .from('learnings')
    .select('*', { count: 'exact', head: true });

  if (learningCount === 0) {
    // Insert mock learnings
    await supabase.from('learnings').insert([
      {
        context: 'Task management system needed dependency tracking',
        action: 'Implemented dependency validation and circular dependency detection',
        result: 'Tasks cannot be started until dependencies are completed, preventing workflow issues',
        lesson: 'Always validate dependencies and check for circular references in graph structures',
        tags: ['dependencies', 'validation', 'task-management'],
      },
      {
        context: 'Tasks were transitioning to invalid states',
        action: 'Created VALID_TRANSITIONS map to enforce state machine rules',
        result: 'Status transitions are now validated, preventing invalid state changes',
        lesson: 'Use state machines for entities with defined workflows',
        tags: ['state-machine', 'validation', 'workflow'],
      },
      {
        context: 'New features were being added without checking existing code',
        action: 'Introduced architecture-guardian pattern to check for duplication',
        result: 'Prevented code duplication and maintained architectural consistency',
        lesson: 'Always check existing codebase before adding new functionality',
        tags: ['architecture', 'patterns', 'refactoring'],
      },
    ]);
  }
}

// Template operations
export async function getTemplate(id: string): Promise<Template | undefined> {
  const cacheKey = `template:${id}`;
  const cached = cache.get<Template>(cacheKey);
  if (cached) return cached;

  const supabase = getSupabaseClient();

  return withRetry(async () => {
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return undefined;

    cache.set(cacheKey, data, TEMPLATE_CACHE_TTL);
    return data;
  });
}

export async function listTemplates(params?: { category?: Template['category'] }): Promise<Template[]> {
  const cacheKey = `templates:list:${params?.category || 'all'}`;
  const cached = cache.get<Template[]>(cacheKey);
  if (cached) return cached;

  const supabase = getSupabaseClient();

  return withRetry(async () => {
    await ensureMockData();

    let query = supabase.from('templates').select('*');

    if (params?.category) {
      query = query.eq('category', params.category);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to list templates: ${error.message}`);

    cache.set(cacheKey, data || [], TEMPLATE_CACHE_TTL);
    return data || [];
  });
}

export async function renderTemplate(
  id: string,
  variables: Record<string, any>
): Promise<{ success: boolean; rendered?: string; error?: string }> {
  try {
    const template = await getTemplate(id);
    if (!template) {
      return { success: false, error: `Template ${id} not found` };
    }

    let rendered = template.content;

    // Replace variables in template
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      const replacement = Array.isArray(value)
        ? value.map((v) => `- ${v}`).join('\n')
        : typeof value === 'object'
        ? JSON.stringify(value, null, 2)
        : String(value);

      rendered = rendered.replace(new RegExp(placeholder, 'g'), replacement);
    }

    return { success: true, rendered };
  } catch (error) {
    return {
      success: false,
      error: `Failed to render template: ${(error as Error).message}`,
    };
  }
}

// Pattern operations
export async function getPattern(id: string): Promise<Pattern | undefined> {
  const cacheKey = `pattern:${id}`;
  const cached = cache.get<Pattern>(cacheKey);
  if (cached) return cached;

  const supabase = getSupabaseClient();

  return withRetry(async () => {
    const { data, error } = await supabase
      .from('patterns')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return undefined;

    cache.set(cacheKey, data, PATTERN_CACHE_TTL);
    return data;
  });
}

export async function listPatterns(params?: {
  category?: string;
  tags?: string[];
}): Promise<Pattern[]> {
  const cacheKey = `patterns:list:${params?.category || 'all'}:${params?.tags?.join(',') || 'all'}`;
  const cached = cache.get<Pattern[]>(cacheKey);
  if (cached) return cached;

  const supabase = getSupabaseClient();

  return withRetry(async () => {
    await ensureMockData();

    let query = supabase.from('patterns').select('*');

    if (params?.category) {
      query = query.eq('category', params.category);
    }

    if (params?.tags && params.tags.length > 0) {
      query = query.overlaps('tags', params.tags);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to list patterns: ${error.message}`);

    cache.set(cacheKey, data || [], PATTERN_CACHE_TTL);
    return data || [];
  });
}

export async function searchPatterns(query: string): Promise<Pattern[]> {
  const supabase = getSupabaseClient();

  return withRetry(async () => {
    const lowerQuery = query.toLowerCase();

    const { data, error } = await supabase
      .from('patterns')
      .select('*')
      .or(`name.ilike.%${lowerQuery}%,description.ilike.%${lowerQuery}%`);

    if (error) throw new Error(`Failed to search patterns: ${error.message}`);

    return data || [];
  });
}

// Learning operations
export async function getLearning(id: string): Promise<Learning | undefined> {
  const supabase = getSupabaseClient();

  return withRetry(async () => {
    const { data, error } = await supabase
      .from('learnings')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return undefined;
    return data;
  });
}

export async function listLearnings(params?: { tags?: string[] }): Promise<Learning[]> {
  const cacheKey = `learnings:list:${params?.tags?.join(',') || 'all'}`;
  const cached = cache.get<Learning[]>(cacheKey);
  if (cached) return cached;

  const supabase = getSupabaseClient();

  return withRetry(async () => {
    await ensureMockData();

    let query = supabase.from('learnings').select('*').order('created_at', { ascending: false });

    if (params?.tags && params.tags.length > 0) {
      query = query.overlaps('tags', params.tags);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to list learnings: ${error.message}`);

    cache.set(cacheKey, data || [], LEARNING_CACHE_TTL);
    return data || [];
  });
}

export async function searchLearnings(query: string, pattern?: string): Promise<Learning[]> {
  const supabase = getSupabaseClient();

  return withRetry(async () => {
    const lowerQuery = query.toLowerCase();

    let dbQuery = supabase
      .from('learnings')
      .select('*')
      .or(`context.ilike.%${lowerQuery}%,action.ilike.%${lowerQuery}%,lesson.ilike.%${lowerQuery}%`);

    if (pattern) {
      dbQuery = dbQuery.ilike('pattern', `%${pattern}%`);
    }

    const { data, error } = await dbQuery.order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to search learnings: ${error.message}`);

    return data || [];
  });
}

// Get relevant knowledge for a task context
export async function getRelevantKnowledge(params: {
  taskTitle: string;
  taskDescription: string;
  tags?: string[];
  taskId?: string;
}): Promise<{
  templates: Template[];
  patterns: Pattern[];
  learnings: Learning[];
}> {
  const { taskTitle, taskDescription, tags = [], taskId } = params;
  const searchText = `${taskTitle} ${taskDescription}`.toLowerCase();

  // Find relevant templates (prompt templates are usually relevant)
  const relevantTemplates = await listTemplates({ category: 'prompt' });

  // Find relevant patterns by tags or search
  const relevantPatterns =
    tags.length > 0
      ? await listPatterns({ tags })
      : (await searchPatterns(searchText)).slice(0, 3);

  // Find relevant learnings by tags or search
  let relevantLearnings =
    tags.length > 0
      ? await listLearnings({ tags })
      : (await searchLearnings(searchText)).slice(0, 5);

  // If taskId provided, prioritize task-specific feedback
  if (taskId) {
    const supabase = getSupabaseClient();
    const { data: taskSpecificLearnings } = await supabase
      .from('learnings')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });

    if (taskSpecificLearnings) {
      // Add task-specific learnings first, then general ones
      relevantLearnings = [
        ...taskSpecificLearnings,
        ...relevantLearnings.filter((l) => l.task_id !== taskId),
      ];
    }
  }

  return {
    templates: relevantTemplates,
    patterns: relevantPatterns,
    learnings: relevantLearnings,
  };
}

// Add feedback (creates a task-specific learning)
export async function addFeedback(params: {
  taskId: string;
  feedback: string;
  type: 'success' | 'failure' | 'improvement';
  pattern: string;
  tags?: string[];
}): Promise<{ success: boolean; learning?: Learning; error?: string }> {
  const { taskId, feedback, type, pattern, tags = [] } = params;

  // Validate inputs
  if (!taskId || taskId.trim().length === 0) {
    return { success: false, error: 'taskId is required' };
  }

  if (!feedback || feedback.trim().length === 0) {
    return { success: false, error: 'feedback is required' };
  }

  if (!pattern || pattern.trim().length === 0) {
    return { success: false, error: 'pattern is required' };
  }

  const supabase = getSupabaseClient();

  return withRetry(async () => {
    const { data, error } = await supabase
      .from('learnings')
      .insert({
        task_id: taskId,
        context: `Task ${taskId} execution`,
        action: `Applied pattern: ${pattern}`,
        result: feedback,
        lesson: feedback,
        type,
        pattern,
        tags: [...tags, type, 'feedback'],
      })
      .select()
      .single();

    if (error) {
      return {
        success: false,
        error: `Failed to add feedback: ${error.message}`,
      };
    }

    // Emit real-time event
    await emitEvent('feedback_received', { taskId, learning: data, type });

    // Invalidate cache
    cache.clearPattern('learnings:*');

    return { success: true, learning: data };
  });
}

// Get similar learnings based on context and pattern matching
export async function getSimilarLearnings(params: {
  context: string;
  taskId?: string;
  type?: 'success' | 'failure' | 'improvement';
  pattern?: string;
}): Promise<Learning[]> {
  const { context, taskId, type, pattern } = params;
  const supabase = getSupabaseClient();

  return withRetry(async () => {
    let query = supabase
      .from('learnings')
      .select('*')
      .or(`context.ilike.%${context}%,action.ilike.%${context}%,lesson.ilike.%${context}%`);

    if (type) {
      query = query.eq('type', type);
    }

    if (taskId) {
      query = query.eq('task_id', taskId);
    }

    if (pattern) {
      query = query.ilike('pattern', `%${pattern}%`);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to get similar learnings: ${error.message}`);

    return data || [];
  });
}
