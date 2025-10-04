import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { createTask } from './task.js';
import { getRelevantKnowledge } from './knowledge.js';
import { getAnthropicClient } from '../db/anthropic.js';
import { emitEvent } from '../db/eventQueue.js';
import { buildNextSteps } from '../constants/workflows.js';
import { suggestAgentsForTask, suggestToolsForTask } from './claudeCodeSync.js';
import { getSupabaseClient } from '../db/supabase.js';
// Parse and validate LLM response
function parseAndValidateLLMResponse(content) {
    try {
        // Extract JSON from markdown code blocks if present
        const jsonMatch = content.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/) || content.match(/(\[[\s\S]*\])/);
        const jsonStr = jsonMatch ? jsonMatch[1] : content;
        const tasks = JSON.parse(jsonStr);
        if (!Array.isArray(tasks)) {
            throw new Error('Response must be a JSON array');
        }
        // Validate each task
        return tasks.map((task, index) => {
            if (!task.title || typeof task.title !== 'string') {
                throw new Error(`Task ${index}: title is required and must be a string`);
            }
            if (!task.description || typeof task.description !== 'string') {
                throw new Error(`Task ${index}: description is required and must be a string`);
            }
            const complexity = task.complexity || 'medium';
            if (!['simple', 'medium', 'complex'].includes(complexity)) {
                throw new Error(`Task ${index}: complexity must be simple, medium, or complex`);
            }
            return {
                title: task.title,
                description: task.description,
                complexity: complexity,
                estimatedHours: task.estimatedHours ? Number(task.estimatedHours) : undefined,
                dependencies: Array.isArray(task.dependencies) ? task.dependencies : [],
                tags: Array.isArray(task.tags) ? task.tags : [],
            };
        });
    }
    catch (error) {
        if (error instanceof SyntaxError) {
            throw new Error('Invalid JSON in LLM response');
        }
        throw error;
    }
}
// Resolve task title dependencies to task IDs
function resolveDependencyIds(dependencyTitles, titleToIdMap) {
    return dependencyTitles
        .map(title => titleToIdMap.get(title))
        .filter((id) => id !== undefined);
}
// Build the LLM prompt
async function buildDecompositionPrompt(userStory) {
    // Get relevant knowledge
    const knowledge = await getRelevantKnowledge({
        taskTitle: userStory,
        taskDescription: userStory,
        tags: ['architecture', 'task-management'],
    });
    const patterns = knowledge.patterns
        .map((p) => `- ${p.name}: ${p.description}`)
        .join('\n');
    const techStack = {
        frontend: 'React',
        backend: 'Node.js',
        database: 'PostgreSQL',
        tools: 'TypeScript, MCP SDK',
    };
    return `Analyze this user story and decompose it into specific technical tasks:

User Story: "${userStory}"

Tech Stack:
${JSON.stringify(techStack, null, 2)}

Relevant Patterns from the codebase:
${patterns || 'No specific patterns available'}

Requirements:
- Break into 3-7 actionable technical tasks
- Each task should be specific and implementable
- Identify dependencies between tasks (use exact task titles)
- Estimate complexity: simple (1-2 hours), medium (3-6 hours), complex (7+ hours)
- Add relevant tags for categorization
- Order tasks by logical implementation sequence

Return ONLY a JSON array with this exact structure:
[
  {
    "title": "Specific task title",
    "description": "Detailed technical description of what needs to be done",
    "complexity": "simple|medium|complex",
    "estimatedHours": 2,
    "dependencies": ["Exact title of prerequisite task"],
    "tags": ["backend", "database", "api"]
  }
]

Rules:
- First task should have no dependencies
- Dependencies must reference exact task titles from the same decomposition
- Be specific and actionable
- Include implementation details in descriptions
- Use existing patterns when applicable`;
}
// Main decomposition function
export async function decomposeStory(userStory) {
    try {
        // Validate input
        if (!userStory || userStory.trim().length === 0) {
            return {
                success: false,
                originalStory: userStory,
                error: 'User story cannot be empty',
            };
        }
        // Check API key
        const client = getAnthropicClient();
        if (!client) {
            return {
                success: false,
                originalStory: userStory,
                error: 'ANTHROPIC_API_KEY not configured. Please set it in .env file',
            };
        }
        // Build prompt
        const prompt = await buildDecompositionPrompt(userStory);
        // Call Anthropic API with timeout
        const responsePromise = client.messages.create({
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 2000,
            messages: [
                {
                    role: 'user',
                    content: prompt,
                },
            ],
        });
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('LLM request timeout after 30 seconds')), 30000));
        const response = await Promise.race([responsePromise, timeoutPromise]);
        // Extract text content
        const textContent = response.content.find(c => c.type === 'text');
        if (!textContent || textContent.type !== 'text') {
            return {
                success: false,
                originalStory: userStory,
                error: 'No text content in LLM response',
            };
        }
        // Parse and validate response
        const decomposedTasks = parseAndValidateLLMResponse(textContent.text);
        if (decomposedTasks.length === 0) {
            return {
                success: false,
                originalStory: userStory,
                error: 'LLM returned no tasks',
            };
        }
        // Create tasks using existing task management system
        const createdTasks = [];
        const titleToIdMap = new Map();
        const dependencyMap = {};
        // Calculate total estimated hours upfront
        const totalEstimatedHours = decomposedTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
        // Step 1: Create the user story task first
        const userStoryTitle = `User Story: ${userStory.substring(0, 100)}${userStory.length > 100 ? '...' : ''}`;
        const userStoryResult = await createTask({
            title: userStoryTitle,
            description: userStory,
            status: 'backlog',
            isUserStory: true,
            storyMetadata: {
                originalStory: userStory,
                tags: ['user-story'],
                estimatedTotalHours: totalEstimatedHours,
            },
        });
        if (!userStoryResult.success || !userStoryResult.task) {
            return {
                success: false,
                originalStory: userStory,
                error: `Failed to create user story task: ${userStoryResult.error}`,
            };
        }
        const userStoryTask = userStoryResult.task;
        // Get project ID for suggestions
        const supabase = getSupabaseClient();
        const { data: taskWithProject } = await supabase
            .from('tasks')
            .select('project_id')
            .eq('id', userStoryTask.id)
            .single();
        const projectId = taskWithProject?.project_id;
        // Step 2: Create sub-tasks linked to user story
        for (const taskData of decomposedTasks) {
            // Get AI-powered suggestions for agent and tools
            let suggestedAgent;
            let suggestedTools;
            if (projectId) {
                // Get agent suggestion
                const agentSuggestions = await suggestAgentsForTask({
                    projectId,
                    taskDescription: `${taskData.title}. ${taskData.description}`,
                    taskCategory: undefined, // Could map from tags if needed
                });
                if (agentSuggestions.success && agentSuggestions.suggestions.length > 0) {
                    suggestedAgent = agentSuggestions.suggestions[0]; // Top suggestion
                }
                // Get tool suggestions
                const toolSuggestions = await suggestToolsForTask({
                    projectId,
                    taskDescription: `${taskData.title}. ${taskData.description}`,
                    taskCategory: undefined,
                });
                if (toolSuggestions.success && toolSuggestions.suggestions.length > 0) {
                    suggestedTools = toolSuggestions.suggestions; // Top 3
                }
            }
            const result = await createTask({
                title: taskData.title,
                description: taskData.description,
                status: 'backlog',
                dependencies: [], // Will be set in second pass
                userStoryId: userStoryTask.id, // Link to parent story
                isUserStory: false,
                storyMetadata: {
                    complexity: taskData.complexity,
                    estimatedHours: taskData.estimatedHours,
                    tags: taskData.tags || [],
                    suggestedAgent,
                    suggestedTools,
                },
            });
            if (!result.success || !result.task) {
                return {
                    success: false,
                    originalStory: userStory,
                    error: `Failed to create task "${taskData.title}": ${result.error}`,
                };
            }
            titleToIdMap.set(taskData.title, result.task.id);
            createdTasks.push({
                task: result.task,
                complexity: taskData.complexity,
                estimatedHours: taskData.estimatedHours,
            });
        }
        // Step 3: Emit user story created event
        await emitEvent('user_story_created', {
            user_story_id: userStoryTask.id,
            task_count: createdTasks.length,
            title: userStoryTask.title,
        });
        // Second pass: update dependencies
        for (let i = 0; i < decomposedTasks.length; i++) {
            const taskData = decomposedTasks[i];
            const createdTaskInfo = createdTasks[i];
            if (taskData.dependencies.length > 0) {
                const dependencyIds = resolveDependencyIds(taskData.dependencies, titleToIdMap);
                // Update the task's dependencies field directly (in-memory mutation)
                createdTaskInfo.task.dependencies = dependencyIds;
                // Build reverse dependency map (who depends on this task)
                for (const depId of dependencyIds) {
                    if (!dependencyMap[depId]) {
                        dependencyMap[depId] = [];
                    }
                    dependencyMap[depId].push(createdTaskInfo.task.id);
                }
            }
        }
        // Build workflow instructions for analyzing all created tasks
        const taskIds = createdTasks.map(t => t.task.id);
        const tasksWithoutDeps = createdTasks
            .filter(t => t.task.dependencies.length === 0)
            .map(t => ({ taskId: t.task.id, title: t.task.title }));
        const nextSteps = buildNextSteps('STORY_DECOMPOSED', {
            taskIds,
            toolsToCall: tasksWithoutDeps.map(t => ({
                tool: 'prepare_task_for_execution',
                params: { taskId: t.taskId }
            }))
        });
        return {
            success: true,
            originalStory: userStory,
            tasks: createdTasks,
            dependencyMap,
            totalEstimatedHours: totalEstimatedHours > 0 ? totalEstimatedHours : undefined,
            nextSteps,
            recommendedAnalysisOrder: tasksWithoutDeps,
        };
    }
    catch (error) {
        // Handle different error types
        if (error instanceof Anthropic.APIError) {
            return {
                success: false,
                originalStory: userStory,
                error: `Anthropic API error: ${error.message} (status: ${error.status})`,
            };
        }
        if (error instanceof Error && error.message.includes('timeout')) {
            return {
                success: false,
                originalStory: userStory,
                error: 'Request timeout: LLM took too long to respond',
            };
        }
        if (error instanceof Error && error.message.includes('JSON')) {
            return {
                success: false,
                originalStory: userStory,
                error: `Failed to parse LLM response: ${error.message}`,
            };
        }
        return {
            success: false,
            originalStory: userStory,
            error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
    }
}
