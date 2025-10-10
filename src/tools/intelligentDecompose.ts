import 'dotenv/config';
import { getSupabaseClient } from '../db/supabase.js';
import { getProjectConfiguration } from './configuration.js';
import { buildNextSteps } from '../constants/workflows.js';
import { emitEvent } from '../db/eventQueue.js';

export interface IntelligentDecomposeRequest {
  userStory: string;
  projectId?: string;
}

export interface StoryDecompositionTask {
  title: string;
  description: string;
  complexity: 'simple' | 'medium' | 'complex';
  estimatedHours?: number;
  dependencies: string[]; // Task titles
  tags: string[];
  category?: 'design_frontend' | 'backend_database' | 'test_fix';
  filesToModify?: Array<{ path: string; reason: string; risk: 'low' | 'medium' | 'high' }>;
  filesToCreate?: Array<{ path: string; reason: string }>;
  codebaseReferences?: Array<{ file: string; description: string; lines?: string }>;
}

export interface StoryAnalysisResult {
  tasks: StoryDecompositionTask[];
  overallComplexity: 'simple' | 'medium' | 'complex';
  totalEstimatedHours: number;
  architectureNotes?: string[];
  risks?: Array<{ level: 'low' | 'medium' | 'high'; description: string; mitigation: string }>;
  recommendations?: string[];
}

/**
 * Generates an intelligent prompt for Claude Code to analyze the codebase
 * and decompose the user story based on real project context
 */
export async function intelligent_decompose_story(
  request: IntelligentDecomposeRequest
): Promise<any> {
  try {
    const { userStory, projectId } = request;

    // Validate input
    if (!userStory || userStory.trim().length === 0) {
      return {
        success: false,
        error: 'User story cannot be empty',
      };
    }

    // Get project configuration
    let projectConfig;
    if (projectId) {
      try {
        projectConfig = await getProjectConfiguration({ projectId });
      } catch (error) {
        console.error('Failed to get project configuration:', error);
        // Continue without config if not available
      }
    }

    // If no projectId provided, try to get default project
    if (!projectConfig) {
      const supabase = getSupabaseClient();
      const { data: defaultProject } = await supabase
        .from('projects')
        .select('*')
        .limit(1)
        .single();

      if (defaultProject) {
        try {
          projectConfig = await getProjectConfiguration({ projectId: defaultProject.id });
        } catch (error) {
          console.error('Failed to get default project configuration:', error);
        }
      }
    }

    // Build structured prompt for Claude Code analysis
    const prompt = buildAnalysisPrompt(userStory, projectConfig);

    // Build workflow instructions using existing STORY_DECOMPOSED workflow
    const workflowInstructions = buildNextSteps('STORY_DECOMPOSED', {
      message: 'Claude Code: Please analyze the codebase and decompose this user story using your tools (Grep, Glob, Read)',
    });

    // Emit event for tracking (using existing event type)
    if (projectConfig?.projectId) {
      await emitEvent('user_story_created', {
        user_story_id: projectConfig.projectId,
        task_count: 0,
        title: userStory.substring(0, 100),
      });
    }

    return {
      success: true,
      prompt,
      workflowInstructions,
      projectId: projectConfig?.projectId,
      nextSteps: `
🎯 INTELLIGENT STORY DECOMPOSITION WORKFLOW

Claude Code, please follow these steps to analyze and decompose this user story:

1. **Analyze the Codebase**
   Use your tools (Grep, Glob, Read) to understand:
   - Existing components, modules, and architecture
   - Similar features already implemented
   - Dependencies and integration points
   - Testing patterns and conventions
   - Code patterns and style guidelines

2. **Decompose the Story**
   Based on your codebase analysis, break down the user story into specific technical tasks.
   Consider:
   - Existing code structure and patterns
   - Files that need to be modified vs created
   - Dependencies between tasks based on actual code
   - Realistic complexity and time estimates
   - Test requirements based on existing test patterns

3. **Save the Decomposition**
   Call the tool: save_story_decomposition with your analysis results.
   Include all the details you discovered during codebase exploration.

📋 The prompt below contains the full instructions with project context.
      `.trim(),
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to prepare intelligent decomposition: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Build the analysis prompt with full project context
 */
function buildAnalysisPrompt(userStory: string, projectConfig: any): string {
  const techStackInfo = projectConfig?.techStack
    ?.map((t: any) => `- ${t.category}: ${t.framework} ${t.version || ''}`)
    .join('\n') || 'Not configured';

  // Guidelines is an object with always/never/patterns structure
  const guidelinesInfo = (() => {
    if (!projectConfig?.guidelines) return 'No specific guidelines';

    const parts = [];
    if (projectConfig.guidelines.always?.length > 0) {
      parts.push('ALWAYS:\n' + projectConfig.guidelines.always.map((g: string) => `  - ${g}`).join('\n'));
    }
    if (projectConfig.guidelines.never?.length > 0) {
      parts.push('NEVER:\n' + projectConfig.guidelines.never.map((g: string) => `  - ${g}`).join('\n'));
    }
    if (projectConfig.guidelines.patterns?.length > 0) {
      parts.push('PATTERNS:\n' + projectConfig.guidelines.patterns
        .slice(0, 3)
        .map((p: any) => `  - ${p.name}: ${p.description}`)
        .join('\n'));
    }

    return parts.length > 0 ? parts.join('\n\n') : 'No specific guidelines';
  })();

  const patternsInfo = projectConfig?.codePatterns
    ?.slice(0, 5)
    .map((p: any) => `- ${p.name} (${p.language}): ${p.description}`)
    .join('\n') || 'No patterns documented';

  return `
# INTELLIGENT USER STORY DECOMPOSITION

You are Claude Code, an expert AI software engineer. You have access to powerful tools (Grep, Glob, Read) to explore and understand codebases.

## User Story to Decompose
"${userStory}"

## Project Context

### Tech Stack
${techStackInfo}

### Project Guidelines
${guidelinesInfo}

### Documented Code Patterns
${patternsInfo}

## Your Task

**IMPORTANT**: Before decomposing this user story, you MUST analyze the actual codebase using your tools:

1. **Explore the Codebase** (Use Grep, Glob, Read tools)
   - Search for similar features or components
   - Identify existing patterns and conventions
   - Find related files and modules
   - Understand the current architecture
   - Check test patterns and conventions

2. **Analyze Architecture**
   - How does the codebase structure features?
   - What files/folders would be affected?
   - What are the integration points?
   - Are there existing utilities you can reuse?

3. **Decompose Based on Real Context**
   Break the user story into 3-7 technical tasks, but base your decomposition on:
   - **Actual file paths** you discovered
   - **Real dependencies** from the codebase
   - **Existing patterns** to follow
   - **Realistic estimates** based on code complexity
   - **Test requirements** matching existing test structure

## Output Format

After your analysis, provide a JSON structure with this format:

\`\`\`json
{
  "tasks": [
    {
      "title": "Specific task title",
      "description": "Detailed description with concrete file paths and references",
      "complexity": "simple|medium|complex",
      "estimatedHours": 2,
      "dependencies": ["Exact title of prerequisite task"],
      "tags": ["backend", "database", "api"],
      "category": "backend_database",
      "filesToModify": [
        {
          "path": "src/components/UserProfile.tsx",
          "reason": "Add new user preferences section",
          "risk": "low"
        }
      ],
      "filesToCreate": [
        {
          "path": "src/hooks/useUserPreferences.ts",
          "reason": "New hook for managing user preferences state"
        }
      ],
      "codebaseReferences": [
        {
          "file": "src/components/Settings.tsx",
          "description": "Similar pattern for managing settings",
          "lines": "45-78"
        }
      ]
    }
  ],
  "overallComplexity": "medium",
  "totalEstimatedHours": 12,
  "architectureNotes": [
    "Following existing React hooks pattern in src/hooks/",
    "Will integrate with existing Redux store structure"
  ],
  "risks": [
    {
      "level": "medium",
      "description": "UserProfile component is used in 15 places",
      "mitigation": "Add comprehensive tests and backward compatibility"
    }
  ],
  "recommendations": [
    "Consider creating a shared PreferencesContext for consistency",
    "Update existing Settings component to use same pattern"
  ]
}
\`\`\`

## Rules

1. **Always analyze first**: Use Grep/Glob/Read before proposing tasks
2. **Be specific**: Include actual file paths, not generic placeholders
3. **Base on reality**: Your estimates and dependencies should reflect actual code
4. **Follow patterns**: Respect existing architecture and conventions
5. **Test awareness**: Include test tasks based on existing test structure
6. **Risk assessment**: Identify files with many dependencies or high complexity

## Next Step

After completing your analysis and creating the JSON structure above, call:
**save_story_decomposition** with your complete analysis.
  `.trim();
}

/**
 * Saves the decomposition analysis performed by Claude Code
 */
export async function save_story_decomposition(args: {
  projectId?: string;
  userStory: string;
  analysis: StoryAnalysisResult;
}): Promise<any> {
  try {
    const { projectId, userStory, analysis } = args;

    // Validate analysis structure
    if (!analysis.tasks || !Array.isArray(analysis.tasks) || analysis.tasks.length === 0) {
      return {
        success: false,
        error: 'Analysis must contain at least one task',
      };
    }

    // Get or create project
    const supabase = getSupabaseClient();
    let finalProjectId = projectId;

    if (!finalProjectId) {
      const { data: defaultProject } = await supabase
        .from('projects')
        .select('id')
        .limit(1)
        .single();

      if (defaultProject) {
        finalProjectId = defaultProject.id;
      } else {
        return {
          success: false,
          error: 'No project found. Please create a project first.',
        };
      }
    }

    // Create user story task
    const userStoryTitle = `User Story: ${userStory.substring(0, 100)}${userStory.length > 100 ? '...' : ''}`;

    const { data: userStoryTask, error: userStoryError } = await supabase
      .from('tasks')
      .insert({
        project_id: finalProjectId,
        title: userStoryTitle,
        description: userStory,
        status: 'backlog',
        is_user_story: true,
        story_metadata: {
          originalStory: userStory,
          tags: ['user-story', 'intelligent-decomposition'],
          estimatedTotalHours: analysis.totalEstimatedHours,
          overallComplexity: analysis.overallComplexity,
          architectureNotes: analysis.architectureNotes,
          risks: analysis.risks,
          recommendations: analysis.recommendations,
        },
      })
      .select()
      .single();

    if (userStoryError || !userStoryTask) {
      return {
        success: false,
        error: `Failed to create user story: ${userStoryError?.message}`,
      };
    }

    // Create sub-tasks with enriched metadata
    const createdTasks = [];
    const titleToIdMap = new Map<string, string>();

    for (const taskData of analysis.tasks) {
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert({
          project_id: finalProjectId,
          title: taskData.title,
          description: taskData.description,
          status: 'backlog',
          user_story_id: userStoryTask.id,
          is_user_story: false,
          category: taskData.category,
          tags: taskData.tags,
          story_metadata: {
            complexity: taskData.complexity,
            estimatedHours: taskData.estimatedHours,
            filesToModify: taskData.filesToModify,
            filesToCreate: taskData.filesToCreate,
            codebaseReferences: taskData.codebaseReferences,
            tags: taskData.tags,
          },
        })
        .select()
        .single();

      if (taskError || !task) {
        return {
          success: false,
          error: `Failed to create task "${taskData.title}": ${taskError?.message}`,
        };
      }

      titleToIdMap.set(taskData.title, task.id);
      createdTasks.push(task);
    }

    // Create dependencies (second pass)
    for (let i = 0; i < analysis.tasks.length; i++) {
      const taskData = analysis.tasks[i];
      const taskId = titleToIdMap.get(taskData.title);

      if (taskData.dependencies && taskData.dependencies.length > 0 && taskId) {
        const dependencyIds = taskData.dependencies
          .map(depTitle => titleToIdMap.get(depTitle))
          .filter((id): id is string => id !== undefined);

        if (dependencyIds.length > 0) {
          const dependencyRows = dependencyIds.map(depId => ({
            task_id: taskId,
            depends_on_task_id: depId,
          }));

          const { error: depError } = await supabase
            .from('task_dependencies')
            .insert(dependencyRows);

          if (depError) {
            console.error(`Warning: Failed to create dependencies for task ${taskId}:`, depError);
          }
        }
      }
    }

    // Emit success event (using existing event type)
    await emitEvent('user_story_created', {
      user_story_id: userStoryTask.id,
      task_count: createdTasks.length,
      title: userStoryTask.title || userStoryTitle,
    });

    // Build next steps using existing workflow
    const nextSteps = buildNextSteps('STORY_DECOMPOSED', {
      taskIds: createdTasks.map(t => t.id),
    });

    return {
      success: true,
      userStory: userStoryTask,
      tasks: createdTasks,
      totalTasks: createdTasks.length,
      totalEstimatedHours: analysis.totalEstimatedHours,
      nextSteps,
      message: `✅ User story decomposed into ${createdTasks.length} tasks with real codebase context!`,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to save story decomposition: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
