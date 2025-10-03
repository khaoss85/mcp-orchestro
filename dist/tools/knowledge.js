import { getSupabaseClient, withRetry } from '../db/supabase.js';
import { cache } from '../db/cache.js';
import { emitEvent } from '../db/eventQueue.js';
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
export async function getTemplate(id) {
    const cacheKey = `template:${id}`;
    const cached = cache.get(cacheKey);
    if (cached)
        return cached;
    const supabase = getSupabaseClient();
    return withRetry(async () => {
        const { data, error } = await supabase
            .from('templates')
            .select('*')
            .eq('id', id)
            .single();
        if (error || !data)
            return undefined;
        cache.set(cacheKey, data, TEMPLATE_CACHE_TTL);
        return data;
    });
}
export async function listTemplates(params) {
    const cacheKey = `templates:list:${params?.category || 'all'}`;
    const cached = cache.get(cacheKey);
    if (cached)
        return cached;
    const supabase = getSupabaseClient();
    return withRetry(async () => {
        await ensureMockData();
        let query = supabase.from('templates').select('*');
        if (params?.category) {
            query = query.eq('category', params.category);
        }
        const { data, error } = await query;
        if (error)
            throw new Error(`Failed to list templates: ${error.message}`);
        cache.set(cacheKey, data || [], TEMPLATE_CACHE_TTL);
        return data || [];
    });
}
export async function renderTemplate(id, variables) {
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
    }
    catch (error) {
        return {
            success: false,
            error: `Failed to render template: ${error.message}`,
        };
    }
}
// Pattern operations
export async function getPattern(id) {
    const cacheKey = `pattern:${id}`;
    const cached = cache.get(cacheKey);
    if (cached)
        return cached;
    const supabase = getSupabaseClient();
    return withRetry(async () => {
        const { data, error } = await supabase
            .from('patterns')
            .select('*')
            .eq('id', id)
            .single();
        if (error || !data)
            return undefined;
        cache.set(cacheKey, data, PATTERN_CACHE_TTL);
        return data;
    });
}
export async function listPatterns(params) {
    const cacheKey = `patterns:list:${params?.category || 'all'}:${params?.tags?.join(',') || 'all'}`;
    const cached = cache.get(cacheKey);
    if (cached)
        return cached;
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
        if (error)
            throw new Error(`Failed to list patterns: ${error.message}`);
        cache.set(cacheKey, data || [], PATTERN_CACHE_TTL);
        return data || [];
    });
}
export async function searchPatterns(query) {
    const supabase = getSupabaseClient();
    return withRetry(async () => {
        const lowerQuery = query.toLowerCase().replace(/[().,]/g, ' ').trim();
        const { data, error } = await supabase
            .from('patterns')
            .select('*')
            .or(`name.ilike.%${lowerQuery}%,description.ilike.%${lowerQuery}%`);
        if (error)
            throw new Error(`Failed to search patterns: ${error.message}`);
        return data || [];
    });
}
// Learning operations
export async function getLearning(id) {
    const supabase = getSupabaseClient();
    return withRetry(async () => {
        const { data, error } = await supabase
            .from('learnings')
            .select('*')
            .eq('id', id)
            .single();
        if (error || !data)
            return undefined;
        return data;
    });
}
export async function listLearnings(params) {
    const cacheKey = `learnings:list:${params?.tags?.join(',') || 'all'}`;
    const cached = cache.get(cacheKey);
    if (cached)
        return cached;
    const supabase = getSupabaseClient();
    return withRetry(async () => {
        await ensureMockData();
        let query = supabase.from('learnings').select('*').order('created_at', { ascending: false });
        if (params?.tags && params.tags.length > 0) {
            query = query.overlaps('tags', params.tags);
        }
        const { data, error } = await query;
        if (error)
            throw new Error(`Failed to list learnings: ${error.message}`);
        cache.set(cacheKey, data || [], LEARNING_CACHE_TTL);
        return data || [];
    });
}
export async function searchLearnings(query, pattern) {
    const supabase = getSupabaseClient();
    return withRetry(async () => {
        const lowerQuery = query.toLowerCase().replace(/[().,]/g, ' ').trim();
        let dbQuery = supabase
            .from('learnings')
            .select('*')
            .or(`context.ilike.%${lowerQuery}%,action.ilike.%${lowerQuery}%,lesson.ilike.%${lowerQuery}%`);
        if (pattern) {
            const sanitizedPattern = pattern.replace(/[().,]/g, ' ').trim();
            dbQuery = dbQuery.ilike('pattern', `%${sanitizedPattern}%`);
        }
        const { data, error } = await dbQuery.order('created_at', { ascending: false });
        if (error)
            throw new Error(`Failed to search learnings: ${error.message}`);
        return data || [];
    });
}
// Get relevant knowledge for a task context
export async function getRelevantKnowledge(params) {
    const { taskTitle, taskDescription, tags = [], taskId } = params;
    const searchText = `${taskTitle} ${taskDescription}`.toLowerCase();
    // Find relevant templates (prompt templates are usually relevant)
    const relevantTemplates = await listTemplates({ category: 'prompt' });
    // Find relevant patterns by tags or search
    const relevantPatterns = tags.length > 0
        ? await listPatterns({ tags })
        : (await searchPatterns(searchText)).slice(0, 3);
    // Find relevant learnings by tags or search
    let relevantLearnings = tags.length > 0
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
export async function addFeedback(params) {
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
export async function getSimilarLearnings(params) {
    const { context, taskId, type, pattern } = params;
    const supabase = getSupabaseClient();
    return withRetry(async () => {
        // Limit context to 100 chars to avoid PostgREST query length issues
        // Remove all special characters that could break SQL parsing
        const sanitizedContext = context
            .replace(/[().,\[\]{}#\n\r\t%]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 100);
        let query = supabase
            .from('learnings')
            .select('*')
            .or(`context.ilike.%${sanitizedContext}%,action.ilike.%${sanitizedContext}%,lesson.ilike.%${sanitizedContext}%`);
        if (type) {
            query = query.eq('type', type);
        }
        if (taskId) {
            query = query.eq('task_id', taskId);
        }
        if (pattern) {
            const sanitizedPattern = pattern
                .replace(/[().,\[\]{}#\n\r\t%]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .substring(0, 100);
            query = query.ilike('pattern', `%${sanitizedPattern}%`);
        }
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error)
            throw new Error(`Failed to get similar learnings: ${error.message}`);
        return data || [];
    });
}
// Pattern frequency operations
export async function getTopPatterns(limit = 10) {
    const supabase = getSupabaseClient();
    return withRetry(async () => {
        const { data, error } = await supabase
            .from('pattern_frequency')
            .select('*')
            .order('frequency', { ascending: false })
            .order('last_seen', { ascending: false })
            .limit(limit);
        if (error)
            throw new Error(`Failed to get top patterns: ${error.message}`);
        return data || [];
    });
}
export async function getTrendingPatterns(days = 7, limit = 10) {
    const supabase = getSupabaseClient();
    return withRetry(async () => {
        // Get patterns from last N days
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        const { data: recentLearnings, error } = await supabase
            .from('learnings')
            .select('pattern')
            .gte('created_at', cutoffDate.toISOString())
            .not('pattern', 'is', null);
        if (error)
            throw new Error(`Failed to get trending patterns: ${error.message}`);
        // Count pattern occurrences in recent learnings
        const patternCounts = new Map();
        recentLearnings?.forEach((learning) => {
            if (learning.pattern) {
                patternCounts.set(learning.pattern, (patternCounts.get(learning.pattern) || 0) + 1);
            }
        });
        // Get full pattern frequency data for these patterns
        const trendingPatterns = Array.from(patternCounts.keys());
        if (trendingPatterns.length === 0) {
            return [];
        }
        const { data: frequencyData, error: freqError } = await supabase
            .from('pattern_frequency')
            .select('*')
            .in('pattern', trendingPatterns);
        if (freqError)
            throw new Error(`Failed to get pattern frequency data: ${freqError.message}`);
        // Combine and sort
        const results = frequencyData?.map((pf) => ({
            pattern: pf.pattern,
            recent_frequency: patternCounts.get(pf.pattern) || 0,
            total_frequency: pf.frequency,
            success_rate: pf.frequency > 0
                ? Math.round((pf.success_count / pf.frequency) * 100 * 100) / 100
                : 0,
            last_seen: pf.last_seen,
        })) || [];
        return results
            .sort((a, b) => b.recent_frequency - a.recent_frequency || new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime())
            .slice(0, limit);
    });
}
export async function getPatternStats(pattern) {
    const supabase = getSupabaseClient();
    return withRetry(async () => {
        const { data, error } = await supabase
            .from('pattern_frequency')
            .select('*')
            .eq('pattern', pattern)
            .single();
        if (error || !data)
            return null;
        return data;
    });
}
export async function detectFailurePatterns(minOccurrences = 3, failureThreshold = 0.5) {
    const supabase = getSupabaseClient();
    return withRetry(async () => {
        // Get patterns with minimum occurrence threshold
        const { data: patterns, error } = await supabase
            .from('pattern_frequency')
            .select('*')
            .gte('frequency', minOccurrences);
        if (error)
            throw new Error(`Failed to get patterns: ${error.message}`);
        if (!patterns || patterns.length === 0) {
            return [];
        }
        // Filter and analyze patterns with failures
        const failurePatterns = [];
        for (const pattern of patterns) {
            const failureRate = pattern.frequency > 0
                ? pattern.failure_count / pattern.frequency
                : 0;
            // Only include patterns that meet failure threshold
            if (failureRate >= failureThreshold) {
                // Get last failure timestamp
                const { data: lastFailure } = await supabase
                    .from('learnings')
                    .select('created_at')
                    .eq('pattern', pattern.pattern)
                    .eq('type', 'failure')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();
                // Determine risk level
                let riskLevel = 'low';
                let recommendation = '';
                if (failureRate >= 0.75) {
                    riskLevel = 'high';
                    recommendation = `⚠️ HIGH RISK: This pattern fails ${Math.round(failureRate * 100)}% of the time. Consider avoiding or redesigning approach.`;
                }
                else if (failureRate >= 0.5) {
                    riskLevel = 'medium';
                    recommendation = `⚡ MEDIUM RISK: This pattern has a ${Math.round(failureRate * 100)}% failure rate. Review implementation carefully before use.`;
                }
                else {
                    riskLevel = 'low';
                    recommendation = `ℹ️ LOW RISK: This pattern occasionally fails (${Math.round(failureRate * 100)}%). Monitor usage.`;
                }
                failurePatterns.push({
                    pattern: pattern.pattern,
                    failure_rate: Math.round(failureRate * 100 * 100) / 100,
                    failure_count: pattern.failure_count,
                    total_count: pattern.frequency,
                    last_failure: lastFailure?.created_at || pattern.last_seen,
                    risk_level: riskLevel,
                    recommendation,
                });
            }
        }
        // Sort by failure rate (highest first) and then by total occurrences
        return failurePatterns.sort((a, b) => b.failure_rate - a.failure_rate || b.total_count - a.total_count);
    });
}
export async function checkPatternRisk(pattern) {
    const stats = await getPatternStats(pattern);
    if (!stats || stats.frequency === 0) {
        return {
            is_risky: false,
            risk_level: 'none',
            failure_rate: 0,
            recommendation: 'No historical data for this pattern.',
            stats: null,
        };
    }
    const failureRate = stats.failure_count / stats.frequency;
    let isRisky = false;
    let riskLevel = 'none';
    let recommendation = '';
    if (failureRate >= 0.75) {
        isRisky = true;
        riskLevel = 'high';
        recommendation = `⚠️ HIGH RISK: This pattern fails ${Math.round(failureRate * 100)}% of the time (${stats.failure_count}/${stats.frequency}). Strongly recommend avoiding or finding alternative approach.`;
    }
    else if (failureRate >= 0.5) {
        isRisky = true;
        riskLevel = 'medium';
        recommendation = `⚡ MEDIUM RISK: This pattern has a ${Math.round(failureRate * 100)}% failure rate (${stats.failure_count}/${stats.frequency}). Proceed with caution and thorough testing.`;
    }
    else if (failureRate >= 0.25) {
        isRisky = true;
        riskLevel = 'low';
        recommendation = `ℹ️ LOW RISK: This pattern occasionally fails (${Math.round(failureRate * 100)}%, ${stats.failure_count}/${stats.frequency}). Review past failures before use.`;
    }
    else {
        recommendation = `✅ This pattern has a good success rate (${Math.round((1 - failureRate) * 100)}%). ${stats.success_count} successes out of ${stats.frequency} uses.`;
    }
    return {
        is_risky: isRisky,
        risk_level: riskLevel,
        failure_rate: Math.round(failureRate * 100 * 100) / 100,
        recommendation,
        stats,
    };
}
