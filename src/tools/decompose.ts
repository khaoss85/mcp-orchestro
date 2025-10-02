import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { createTask, Task } from './task.js';
import { getRelevantKnowledge } from './knowledge.js';
import { getAnthropicClient } from '../db/anthropic.js';

export type Complexity = 'simple' | 'medium' | 'complex';

export interface DecomposedTaskData {
  title: string;
  description: string;
  complexity: Complexity;
  estimatedHours?: number;
  dependencies: string[]; // Task titles, not IDs
  tags: string[];
}

export interface CreatedTaskInfo {
  task: Task;
  complexity: Complexity;
  estimatedHours?: number;
}

export interface DecompositionResult {
  success: boolean;
  originalStory: string;
  tasks?: CreatedTaskInfo[];
  dependencyMap?: Record<string, string[]>; // taskId -> dependent taskIds
  totalEstimatedHours?: number;
  error?: string;
}

// Parse and validate LLM response
function parseAndValidateLLMResponse(content: string): DecomposedTaskData[] {
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
        complexity: complexity as Complexity,
        estimatedHours: task.estimatedHours ? Number(task.estimatedHours) : undefined,
        dependencies: Array.isArray(task.dependencies) ? task.dependencies : [],
        tags: Array.isArray(task.tags) ? task.tags : [],
      };
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Invalid JSON in LLM response');
    }
    throw error;
  }
}

// Resolve task title dependencies to task IDs
function resolveDependencyIds(
  dependencyTitles: string[],
  titleToIdMap: Map<string, string>
): string[] {
  return dependencyTitles
    .map(title => titleToIdMap.get(title))
    .filter((id): id is string => id !== undefined);
}

// Build the LLM prompt
async function buildDecompositionPrompt(userStory: string): Promise<string> {
  // Get relevant knowledge
  const knowledge = await getRelevantKnowledge({
    taskTitle: userStory,
    taskDescription: userStory,
    tags: ['architecture', 'task-management'],
  });

  const patterns = knowledge.patterns
    .map((p: any) => `- ${p.name}: ${p.description}`)
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
export async function decomposeStory(userStory: string): Promise<DecompositionResult> {
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
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('LLM request timeout after 30 seconds')), 30000)
    );

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
    const createdTasks: CreatedTaskInfo[] = [];
    const titleToIdMap = new Map<string, string>();
    const dependencyMap: Record<string, string[]> = {};

    // First pass: create all tasks without dependencies
    for (const taskData of decomposedTasks) {
      const result = await createTask({
        title: taskData.title,
        description: taskData.description,
        status: 'backlog',
        dependencies: [], // Will be set in second pass
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

    // Calculate total estimated hours
    const totalEstimatedHours = createdTasks.reduce(
      (sum, t) => sum + (t.estimatedHours || 0),
      0
    );

    return {
      success: true,
      originalStory: userStory,
      tasks: createdTasks,
      dependencyMap,
      totalEstimatedHours: totalEstimatedHours > 0 ? totalEstimatedHours : undefined,
    };

  } catch (error) {
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
