import { getSupabaseClient, withRetry } from '../db/supabase.js';
import { cache } from '../db/cache.js';
import { getRelevantKnowledge } from './knowledge.js';
import { getProjectInfo } from './project.js';
import { emitEvent } from '../db/eventQueue.js';
import { buildNextSteps } from '../constants/workflows.js';

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'done';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  dependencies: string[];
  assignee?: string | null;
  priority?: 'low' | 'medium' | 'high' | 'urgent' | null;
  tags?: string[];
  category?: 'design_frontend' | 'backend_database' | 'test_fix' | null;
  userStoryId?: string | null;
  isUserStory: boolean;
  storyMetadata?: {
    complexity?: string;
    estimatedHours?: number;
    tags?: string[];
    originalStory?: string;
    estimatedTotalHours?: number;
    suggestedAgent?: {
      agentName: string;
      agentType: string;
      reason: string;
      confidence: number;
    };
    suggestedTools?: Array<{
      toolName: string;
      category: string;
      reason: string;
      confidence: number;
    }>;
  };
  createdAt: string;
  updatedAt: string;
}

// Database row interface (what comes from Supabase)
interface TaskRow {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  assignee?: string | null;
  priority?: string | null;
  tags?: string[];
  category?: string | null;
  created_at: string;
  updated_at: string;
}

interface TaskDependencyRow {
  task_id: string;
  depends_on_task_id: string;
}

// Cache configuration
const TASK_CACHE_TTL = 5 * 60 * 1000; // 5 minutes (dynamic data)
const TASK_LIST_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Helper: Convert database row to Task interface
async function rowToTask(row: any): Promise<Task> {
  const supabase = getSupabaseClient();

  // Fetch dependencies for this task
  const { data: deps } = await supabase
    .from('task_dependencies')
    .select('depends_on_task_id')
    .eq('task_id', row.id);

  const dependencies = deps?.map(d => d.depends_on_task_id) || [];

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    dependencies,
    assignee: row.assignee || null,
    priority: row.priority || null,
    tags: row.tags || [],
    userStoryId: row.user_story_id || null,
    isUserStory: row.is_user_story || false,
    storyMetadata: row.story_metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Helper: Convert database rows to Tasks (with dependency batch fetch)
async function rowsToTasks(rows: any[]): Promise<Task[]> {
  if (rows.length === 0) return [];

  const supabase = getSupabaseClient();
  const taskIds = rows.map(r => r.id);

  // Batch fetch all dependencies
  const { data: allDeps } = await supabase
    .from('task_dependencies')
    .select('task_id, depends_on_task_id')
    .in('task_id', taskIds);

  // Group dependencies by task_id
  const depsMap = new Map<string, string[]>();
  for (const dep of allDeps || []) {
    if (!depsMap.has(dep.task_id)) {
      depsMap.set(dep.task_id, []);
    }
    depsMap.get(dep.task_id)!.push(dep.depends_on_task_id);
  }

  // Convert rows to tasks
  return rows.map(row => ({
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    dependencies: depsMap.get(row.id) || [],
    assignee: row.assignee || null,
    priority: row.priority || null,
    tags: row.tags || [],
    userStoryId: row.user_story_id || null,
    isUserStory: row.is_user_story || false,
    storyMetadata: row.story_metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

// Create a new task
export async function createTask(params: {
  title: string;
  description: string;
  status?: TaskStatus;
  dependencies?: string[];
  assignee?: string | null;
  priority?: 'low' | 'medium' | 'high' | 'urgent' | null;
  tags?: string[];
  category?: 'design_frontend' | 'backend_database' | 'test_fix' | null;
  userStoryId?: string | null;
  isUserStory?: boolean;
  storyMetadata?: any;
}): Promise<{ success: boolean; task?: Task; error?: string }> {
  const { title, description, status = 'backlog', dependencies = [], assignee, priority, tags = [], category, userStoryId, isUserStory, storyMetadata } = params;

  const supabase = getSupabaseClient();

  return withRetry(async () => {
    try {
      // Get current project
      const project = await getProjectInfo();

      // Create task
      const { data: taskRow, error: taskError } = await supabase
        .from('tasks')
        .insert({
          project_id: project.id,
          title,
          description,
          status,
          assignee: assignee || null,
          priority: priority || null,
          tags: tags || [],
          category: category || null,
          user_story_id: userStoryId || null,
          is_user_story: isUserStory || false,
          story_metadata: storyMetadata || {},
        })
        .select()
        .single();

      if (taskError) {
        return { success: false, error: `Failed to create task: ${taskError.message}` };
      }

      // Insert dependencies (if any)
      if (dependencies.length > 0) {
        const dependencyRows = dependencies.map(depId => ({
          task_id: taskRow.id,
          depends_on_task_id: depId,
        }));

        const { error: depsError } = await supabase
          .from('task_dependencies')
          .insert(dependencyRows);

        if (depsError) {
          // Rollback: delete the task we just created
          await supabase.from('tasks').delete().eq('id', taskRow.id);

          // Check if error is circular dependency
          if (depsError.message.includes('Circular dependency')) {
            return { success: false, error: 'Circular dependency detected' };
          }

          // Check if error is missing dependency
          if (depsError.message.includes('violates foreign key constraint')) {
            return { success: false, error: 'One or more dependency tasks do not exist' };
          }

          return { success: false, error: `Failed to create dependencies: ${depsError.message}` };
        }
      }

      // Convert to Task interface
      const task = await rowToTask(taskRow);

      // Emit real-time event
      await emitEvent('task_created', task);

      // Invalidate caches
      cache.clearPattern('tasks:*');
      cache.set(`task:${task.id}`, task, TASK_CACHE_TTL);

      // Build workflow instructions to guide Claude Code
      const nextSteps = buildNextSteps('TASK_CREATED', { taskId: task.id });

      return { success: true, task, nextSteps };
    } catch (error) {
      return { success: false, error: `Failed to create task: ${(error as Error).message}` };
    }
  });
}

// List all tasks
export async function listTasks(params?: {
  status?: TaskStatus;
  category?: 'design_frontend' | 'backend_database' | 'test_fix';
}): Promise<Task[]> {
  const cacheKey = `tasks:list:${params?.status || 'all'}:${params?.category || 'all'}`;
  const cached = cache.get<Task[]>(cacheKey);
  if (cached) return cached;

  const supabase = getSupabaseClient();

  return withRetry(async () => {
    let query = supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (params?.status) {
      query = query.eq('status', params.status);
    }

    if (params?.category) {
      query = query.eq('category', params.category);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list tasks: ${error.message}`);
    }

    const tasks = await rowsToTasks(data || []);
    cache.set(cacheKey, tasks, TASK_LIST_CACHE_TTL);

    return tasks;
  });
}

// Update a task
export async function updateTask(params: {
  id: string;
  title?: string;
  description?: string;
  status?: TaskStatus;
  dependencies?: string[];
  assignee?: string | null;
  priority?: 'low' | 'medium' | 'high' | 'urgent' | null;
  tags?: string[];
  category?: 'design_frontend' | 'backend_database' | 'test_fix' | null;
}): Promise<{ success: boolean; task?: Task; error?: string }> {
  const { id, title, description, status, dependencies, assignee, priority, tags, category } = params;

  const supabase = getSupabaseClient();

  return withRetry(async () => {
    try {
      // Check task exists first
      const { data: existingRow, error: fetchError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !existingRow) {
        return { success: false, error: `Task with id ${id} not found` };
      }

      // Build update object
      const updates: Partial<TaskRow> = {};
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (status !== undefined) updates.status = status;
      if (assignee !== undefined) updates.assignee = assignee;
      if (priority !== undefined) updates.priority = priority;
      if (tags !== undefined) updates.tags = tags;
      if (category !== undefined) updates.category = category;

      // Update task (triggers will validate status transitions and dependency completion)
      if (Object.keys(updates).length > 0) {
        const { data: updatedRow, error: updateError } = await supabase
          .from('tasks')
          .update(updates)
          .eq('id', id)
          .select()
          .single();

        if (updateError) {
          // Parse trigger errors
          if (updateError.message.includes('Invalid transition')) {
            return {
              success: false,
              error: updateError.message,
            };
          }

          if (updateError.message.includes('is not done yet')) {
            return {
              success: false,
              error: updateError.message,
            };
          }

          return { success: false, error: `Failed to update task: ${updateError.message}` };
        }

        existingRow.title = updatedRow.title;
        existingRow.description = updatedRow.description;
        existingRow.status = updatedRow.status;
        existingRow.assignee = updatedRow.assignee;
        existingRow.priority = updatedRow.priority;
        existingRow.tags = updatedRow.tags;
        existingRow.updated_at = updatedRow.updated_at;
      }

      // Update dependencies if provided
      if (dependencies !== undefined) {
        // Delete existing dependencies
        const { error: deleteError } = await supabase
          .from('task_dependencies')
          .delete()
          .eq('task_id', id);

        if (deleteError) {
          return { success: false, error: `Failed to delete dependencies: ${deleteError.message}` };
        }

        // Insert new dependencies
        if (dependencies.length > 0) {
          const dependencyRows = dependencies.map(depId => ({
            task_id: id,
            depends_on_task_id: depId,
          }));

          const { error: insertError } = await supabase
            .from('task_dependencies')
            .insert(dependencyRows);

          if (insertError) {
            // Check if error is circular dependency
            if (insertError.message.includes('Circular dependency')) {
              return { success: false, error: 'Circular dependency detected' };
            }

            // Check if error is missing dependency
            if (insertError.message.includes('violates foreign key constraint')) {
              return { success: false, error: 'One or more dependency tasks do not exist' };
            }

            return { success: false, error: `Failed to update dependencies: ${insertError.message}` };
          }
        }
      }

      // Convert to Task interface
      const task = await rowToTask(existingRow);

      // Emit real-time event with changes detection
      const changes: any = {};
      if (title !== undefined) changes.title = title;
      if (description !== undefined) changes.description = description;
      if (status !== undefined) changes.status = status;
      if (assignee !== undefined) changes.assignee = assignee;
      if (priority !== undefined) changes.priority = priority;
      if (tags !== undefined) changes.tags = tags;
      if (dependencies !== undefined) changes.dependencies = dependencies;

      await emitEvent('task_updated', { task, changes });

      // Invalidate caches
      cache.clearPattern('tasks:*');
      cache.set(`task:${task.id}`, task, TASK_CACHE_TTL);

      return { success: true, task };
    } catch (error) {
      return { success: false, error: `Failed to update task: ${(error as Error).message}` };
    }
  });
}

// Get a single task by ID
export async function getTask(id: string): Promise<Task | undefined> {
  const cacheKey = `task:${id}`;
  const cached = cache.get<Task>(cacheKey);
  if (cached) return cached;

  const supabase = getSupabaseClient();

  return withRetry(async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return undefined;

    const task = await rowToTask(data);
    cache.set(cacheKey, task, TASK_CACHE_TTL);

    return task;
  });
}

// Delete a task
export async function deleteTask(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient();

  return withRetry(async () => {
    try {
      // Check if task exists
      const { data: task, error: fetchError } = await supabase
        .from('tasks')
        .select('id')
        .eq('id', id)
        .single();

      if (fetchError || !task) {
        return { success: false, error: `Task with id ${id} not found` };
      }

      // Check if any other tasks depend on this one
      const { data: dependents, error: depsError } = await supabase
        .from('task_dependencies')
        .select('task_id')
        .eq('depends_on_task_id', id);

      if (depsError) {
        return { success: false, error: `Failed to check dependents: ${depsError.message}` };
      }

      if (dependents && dependents.length > 0) {
        // Fetch dependent task details for better error message
        const dependentIds = dependents.map(d => d.task_id);
        const { data: dependentTasks } = await supabase
          .from('tasks')
          .select('id, title')
          .in('id', dependentIds)
          .limit(1)
          .single();

        if (dependentTasks) {
          return {
            success: false,
            error: `Cannot delete task ${id} as task ${dependentTasks.id} (${dependentTasks.title}) depends on it`,
          };
        }

        return {
          success: false,
          error: `Cannot delete task ${id} as ${dependents.length} task(s) depend on it`,
        };
      }

      // Delete task (CASCADE will handle dependencies)
      const { error: deleteError } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id);

      if (deleteError) {
        return { success: false, error: `Failed to delete task: ${deleteError.message}` };
      }

      // Invalidate caches
      cache.clearPattern('tasks:*');

      // Emit task_deleted event for real-time updates
      await emitEvent('task_deleted', { taskId: id });

      return { success: true };
    } catch (error) {
      return { success: false, error: `Failed to delete task: ${(error as Error).message}` };
    }
  });
}

// Delete user story and all its sub-tasks
export async function deleteUserStory(params: {
  userStoryId: string;
  force?: boolean;
}): Promise<{
  success: boolean;
  deletedUserStory?: Task;
  deletedSubTasks?: Task[];
  error?: string;
  warning?: string;
}> {
  const { userStoryId, force = false } = params;
  const supabase = getSupabaseClient();

  return withRetry(async () => {
    try {
      // Check if user story exists and is indeed a user story
      const { data: userStory, error: fetchError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', userStoryId)
        .eq('is_user_story', true)
        .single();

      if (fetchError || !userStory) {
        return {
          success: false,
          error: `User story with id ${userStoryId} not found or is not a user story`
        };
      }

      // Fetch all sub-tasks for this user story
      const { data: subTasks, error: subTasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_story_id', userStoryId)
        .eq('is_user_story', false);

      if (subTasksError) {
        return {
          success: false,
          error: `Failed to fetch sub-tasks: ${subTasksError.message}`
        };
      }

      const subTasksList = subTasks || [];

      // Check if there are completed sub-tasks and force is not true
      if (!force && subTasksList.some(task => task.status === 'done')) {
        const completedCount = subTasksList.filter(task => task.status === 'done').length;
        return {
          success: false,
          error: `Cannot delete user story with ${completedCount} completed sub-task(s). Use force=true to delete anyway.`,
          warning: `This user story has completed work that will be lost if deleted.`
        };
      }

      // Check for external dependencies (other tasks depending on this user story's sub-tasks)
      const subTaskIds = subTasksList.map(t => t.id);
      if (subTaskIds.length > 0) {
        const { data: externalDependents, error: extDepsError } = await supabase
          .from('task_dependencies')
          .select('task_id, depends_on_task_id')
          .in('depends_on_task_id', subTaskIds);

        if (extDepsError) {
          return {
            success: false,
            error: `Failed to check external dependencies: ${extDepsError.message}`
          };
        }

        if (externalDependents && externalDependents.length > 0) {
          // Fetch details of external dependent tasks
          const externalTaskIds = externalDependents
            .map(d => d.task_id)
            .filter(id => !subTaskIds.includes(id)); // Only external tasks

          if (externalTaskIds.length > 0) {
            const { data: externalTasks } = await supabase
              .from('tasks')
              .select('id, title, user_story_id')
              .in('id', externalTaskIds)
              .limit(3);

            if (externalTasks && externalTasks.length > 0) {
              const taskList = externalTasks
                .map(t => `- ${t.title} (${t.id})`)
                .join('\n');

              return {
                success: false,
                error: `Cannot delete user story because external tasks depend on its sub-tasks:\n${taskList}${externalTasks.length > 3 ? `\n... and ${externalTaskIds.length - 3} more` : ''}`
              };
            }
          }
        }
      }

      // Convert rows to Task objects for response
      const deletedUserStoryTask = await rowsToTasks([userStory]);
      const deletedSubTasksList = subTasksList.length > 0 ? await rowsToTasks(subTasksList) : [];

      // Delete user story (CASCADE will delete sub-tasks and dependencies)
      const { error: deleteError } = await supabase
        .from('tasks')
        .delete()
        .eq('id', userStoryId);

      if (deleteError) {
        return {
          success: false,
          error: `Failed to delete user story: ${deleteError.message}`
        };
      }

      // Invalidate caches
      cache.clearPattern('tasks:*');

      // Emit user_story_deleted event for real-time updates
      await emitEvent('user_story_deleted', {
        userStoryId,
        deletedSubTaskCount: subTasksList.length,
        force
      });

      return {
        success: true,
        deletedUserStory: deletedUserStoryTask[0],
        deletedSubTasks: deletedSubTasksList
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete user story: ${(error as Error).message}`
      };
    }
  });
}

// Task Context Interface
export interface TaskContext {
  task: Task;
  dependencies: Task[];
  dependents: Task[];
  relatedTasks: Task[];
  previousWork: string[];
  guidelines: string[];
  feedback: Array<{
    id: string;
    feedback: string;
    type: string;
    pattern: string;
    createdAt: string;
  }>; // Task-specific feedback
  relatedLearnings: Array<{
    id: string;
    lesson: string;
    type?: string;
    pattern?: string;
  }>; // Related learnings from similar tasks
  techStack: {
    frontend?: string;
    backend?: string;
    database?: string;
    [key: string]: string | undefined;
  };
  analysis?: {
    files_to_modify: Array<{
      path: string;
      reason: string;
      risk: 'low' | 'medium' | 'high';
    }>;
    files_to_create: Array<{
      path: string;
      reason: string;
    }>;
    risks: Array<{
      level: 'low' | 'medium' | 'high';
      description: string;
      mitigation: string;
    }>;
    related_code: Array<{
      file: string;
      description: string;
      lines?: string;
    }>;
    recommendations: string[];
    analyzed_at?: string;
  };
}

// Get comprehensive task context for Claude Code
export async function getTaskContext(id: string): Promise<{ success: boolean; context?: TaskContext; error?: string }> {
  const supabase = getSupabaseClient();

  return withRetry(async () => {
    try {
      const task = await getTask(id);
      if (!task) {
        return { success: false, error: `Task with id ${id} not found` };
      }

      // Get dependency tasks (batch fetch)
      const dependencies: Task[] = [];
      if (task.dependencies.length > 0) {
        const { data: depRows } = await supabase
          .from('tasks')
          .select('*')
          .in('id', task.dependencies);

        if (depRows) {
          dependencies.push(...(await rowsToTasks(depRows)));
        }
      }

      // Get dependent tasks (tasks that depend on this one)
      const { data: dependentIds } = await supabase
        .from('task_dependencies')
        .select('task_id')
        .eq('depends_on_task_id', id);

      const dependents: Task[] = [];
      if (dependentIds && dependentIds.length > 0) {
        const ids = dependentIds.map(d => d.task_id);
        const { data: depRows } = await supabase
          .from('tasks')
          .select('*')
          .in('id', ids);

        if (depRows) {
          dependents.push(...(await rowsToTasks(depRows)));
        }
      }

      // Get related tasks (same status or recently completed dependencies)
      const relatedTasksQuery = task.dependencies.length > 0
        ? supabase
            .from('tasks')
            .select('*')
            .or(`status.eq.${task.status},id.in.(${task.dependencies.join(',')})`)
            .neq('id', id)
            .limit(5)
        : supabase
            .from('tasks')
            .select('*')
            .eq('status', task.status)
            .neq('id', id)
            .limit(5);

      const { data: relatedRows } = await relatedTasksQuery;
      const relatedTasks = relatedRows ? await rowsToTasks(relatedRows) : [];

      // Fetch task metadata with analysis
      const { data: taskWithMetadata } = await supabase
        .from('tasks')
        .select('metadata')
        .eq('id', id)
        .single();

      const metadata = taskWithMetadata?.metadata;
      const analysis = metadata?.analysis;

      // Fetch key decisions from event queue
      const { data: decisionEvents } = await supabase
        .from('event_queue')
        .select('*')
        .eq('event_type', 'decision_made')
        .contains('payload', { task_id: id })
        .order('created_at', { ascending: false })
        .limit(5);

      // Get relevant knowledge including task-specific feedback
      const knowledge = await getRelevantKnowledge({
        taskTitle: task.title,
        taskDescription: task.description,
        taskId: id,
      });

      // Extract task-specific feedback
      const taskFeedback = knowledge.learnings
        .filter((l: any) => l.task_id === id)
        .map((l: any) => ({
          id: l.id,
          feedback: l.lesson,
          type: l.type || 'general',
          pattern: l.pattern || '',
          createdAt: l.created_at,
        }));

      // Extract related learnings (non-task-specific)
      const relatedLearnings = knowledge.learnings
        .filter((l: any) => l.task_id !== id)
        .map((l: any) => ({
          id: l.id,
          lesson: l.lesson,
          type: l.type,
          pattern: l.pattern,
        }));

      // Generate enriched previous work from multiple sources
      const previousWork: string[] = [];

      // 1. Add completed dependency work (original behavior - backward compatible)
      const dependencyWork = dependencies
        .filter(dep => dep.status === 'done')
        .map(dep => `${dep.title}: ${dep.description}`);

      if (dependencyWork.length > 0) {
        previousWork.push('## Completed Dependencies');
        previousWork.push(...dependencyWork);
        previousWork.push(''); // Empty line for spacing
      }

      // 2. Add analysis summary if task was analyzed
      if (analysis) {
        previousWork.push('## Analysis Summary');

        if (analysis.analyzed_at) {
          previousWork.push(`Analyzed: ${new Date(analysis.analyzed_at).toLocaleString()}`);
        }

        if (analysis.files_to_modify && analysis.files_to_modify.length > 0) {
          previousWork.push(`Files to modify: ${analysis.files_to_modify.length}`);
          const highRiskFiles = analysis.files_to_modify.filter((f: any) => f.risk === 'high');
          if (highRiskFiles.length > 0) {
            previousWork.push(`  - High risk files: ${highRiskFiles.map((f: any) => f.path).join(', ')}`);
          }
        }

        if (analysis.files_to_create && analysis.files_to_create.length > 0) {
          previousWork.push(`Files to create: ${analysis.files_to_create.length}`);
        }

        if (analysis.risks && analysis.risks.length > 0) {
          const highRisks = analysis.risks.filter((r: any) => r.level === 'high');
          const mediumRisks = analysis.risks.filter((r: any) => r.level === 'medium');
          previousWork.push(`Risks identified: ${highRisks.length} high, ${mediumRisks.length} medium`);
        }

        if (analysis.recommendations && analysis.recommendations.length > 0) {
          previousWork.push('Key recommendations:');
          analysis.recommendations.slice(0, 3).forEach((rec: string) => {
            previousWork.push(`  - ${rec}`);
          });
        }

        previousWork.push(''); // Empty line for spacing
      }

      // 3. Add key decisions from event queue
      if (decisionEvents && decisionEvents.length > 0) {
        previousWork.push('## Key Decisions Made');
        decisionEvents.forEach((event: any) => {
          const payload = event.payload;
          const decision = payload.decision || payload.details?.decision || payload.message;
          if (decision) {
            const date = new Date(event.created_at).toLocaleDateString();
            previousWork.push(`- ${decision} (${date})`);
          }
        });
        previousWork.push(''); // Empty line for spacing
      }

      // 4. Add feedback summary
      if (taskFeedback.length > 0) {
        previousWork.push('## Feedback Received');
        taskFeedback.forEach((fb: any) => {
          const typeEmoji = fb.type === 'success' ? '✓' : fb.type === 'failure' ? '✗' : '→';
          previousWork.push(`${typeEmoji} ${fb.feedback}`);
        });
        previousWork.push(''); // Empty line for spacing
      }

      // Generate guidelines based on task status and dependencies
      const guidelines: string[] = [];

      if (task.status === 'backlog') {
        guidelines.push('This task is in backlog - review dependencies before starting');
      } else if (task.status === 'todo') {
        guidelines.push('Task is ready to start - ensure all dependencies are completed');
      } else if (task.status === 'in_progress') {
        guidelines.push('Task is in progress - focus on completing current work');
      } else if (task.status === 'done') {
        guidelines.push('Task is completed - can be used as reference for dependent tasks');
      }

      if (dependencies.length > 0) {
        guidelines.push('Review completed dependencies for context and patterns');
      }

      if (dependents.length > 0) {
        guidelines.push(`This task blocks ${dependents.length} other task(s)`);
      }

      guidelines.push('Follow existing patterns from the codebase');
      guidelines.push('Test all changes thoroughly');

      // Tech stack from project context
      const techStack = {
        frontend: 'React',
        backend: 'Node.js',
        database: 'PostgreSQL',
        tools: 'TypeScript, MCP SDK'
      };

      return {
        success: true,
        context: {
          task,
          dependencies,
          dependents,
          relatedTasks,
          previousWork,
          guidelines,
          feedback: taskFeedback,
          relatedLearnings,
          techStack,
          analysis
        }
      };
    } catch (error) {
      return { success: false, error: `Failed to get task context: ${(error as Error).message}` };
    }
  });
}

// Get all user stories
export async function getUserStories(): Promise<Task[]> {
  const supabase = getSupabaseClient();

  return withRetry(async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('is_user_story', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get user stories: ${error.message}`);
    }

    return rowsToTasks(data || []);
  });
}

// Get all tasks belonging to a specific user story
export async function getTasksByUserStory(userStoryId: string): Promise<Task[]> {
  const supabase = getSupabaseClient();

  return withRetry(async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_story_id', userStoryId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to get tasks for user story: ${error.message}`);
    }

    return rowsToTasks(data || []);
  });
}

// Safe delete tasks by status - preserves user stories with completed work
export async function safeDeleteTasksByStatus(params: {
  status: TaskStatus;
}): Promise<{
  success: boolean;
  deletedCount: number;
  preservedCount: number;
  deletedTaskIds: string[];
  preservedTasks: Array<{
    id: string;
    title: string;
    reason: string;
    completionPercentage?: number;
    doneTasks?: number;
    totalTasks?: number;
  }>;
  error?: string;
}> {
  const { status } = params;
  const supabase = getSupabaseClient();

  return withRetry(async () => {
    try {
      // Call the safe delete function
      const { data, error } = await supabase.rpc('safe_delete_tasks_by_status', {
        p_status: status,
      });

      if (error) {
        return {
          success: false,
          deletedCount: 0,
          preservedCount: 0,
          deletedTaskIds: [],
          preservedTasks: [],
          error: `Failed to delete tasks: ${error.message}`,
        };
      }

      const result = data[0];

      // Parse preserved reasons
      const preservedTasks = (result.preserved_reasons || []).map((reason: any) => ({
        id: reason.task_id,
        title: reason.title,
        reason: reason.reason,
        completionPercentage: reason.completion_percentage,
        doneTasks: reason.done_tasks,
        totalTasks: reason.total_tasks,
      }));

      // Invalidate caches
      cache.clearPattern('tasks:*');

      return {
        success: true,
        deletedCount: result.deleted_count || 0,
        preservedCount: result.preserved_count || 0,
        deletedTaskIds: result.deleted_task_ids || [],
        preservedTasks,
      };
    } catch (error) {
      return {
        success: false,
        deletedCount: 0,
        preservedCount: 0,
        deletedTaskIds: [],
        preservedTasks: [],
        error: `Failed to delete tasks: ${(error as Error).message}`,
      };
    }
  });
}

// Get user story health metrics
export async function getUserStoryHealth(): Promise<Array<{
  userStoryId: string;
  userStoryTitle: string;
  currentStatus: TaskStatus;
  suggestedStatus: TaskStatus;
  totalSubtasks: number;
  doneCount: number;
  inProgressCount: number;
  todoCount: number;
  backlogCount: number;
  completionPercentage: number;
  statusMismatch: boolean;
  safeToDelete: boolean;
}>> {
  const supabase = getSupabaseClient();

  return withRetry(async () => {
    const { data, error } = await supabase
      .from('user_stories_health')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get user story health: ${error.message}`);
    }

    return (data || []).map((row: any) => ({
      userStoryId: row.user_story_id,
      userStoryTitle: row.user_story_title,
      currentStatus: row.current_status,
      suggestedStatus: row.suggested_status,
      totalSubtasks: row.total_subtasks,
      doneCount: row.done_count,
      inProgressCount: row.in_progress_count,
      todoCount: row.todo_count,
      backlogCount: row.backlog_count,
      completionPercentage: row.completion_percentage || 0,
      statusMismatch: row.status_mismatch,
      safeToDelete: row.safe_to_delete,
    }));
  });
}
