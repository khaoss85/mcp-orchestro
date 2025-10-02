import { getSupabaseClient, withRetry } from '../db/supabase.js';
import { cache } from '../db/cache.js';
import { getRelevantKnowledge } from './knowledge.js';
import { getProjectInfo } from './project.js';
import { emitEvent } from '../db/eventQueue.js';
// Cache configuration
const TASK_CACHE_TTL = 5 * 60 * 1000; // 5 minutes (dynamic data)
const TASK_LIST_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
// Helper: Convert database row to Task interface
async function rowToTask(row) {
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
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
// Helper: Convert database rows to Tasks (with dependency batch fetch)
async function rowsToTasks(rows) {
    if (rows.length === 0)
        return [];
    const supabase = getSupabaseClient();
    const taskIds = rows.map(r => r.id);
    // Batch fetch all dependencies
    const { data: allDeps } = await supabase
        .from('task_dependencies')
        .select('task_id, depends_on_task_id')
        .in('task_id', taskIds);
    // Group dependencies by task_id
    const depsMap = new Map();
    for (const dep of allDeps || []) {
        if (!depsMap.has(dep.task_id)) {
            depsMap.set(dep.task_id, []);
        }
        depsMap.get(dep.task_id).push(dep.depends_on_task_id);
    }
    // Convert rows to tasks
    return rows.map(row => ({
        id: row.id,
        title: row.title,
        description: row.description,
        status: row.status,
        dependencies: depsMap.get(row.id) || [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }));
}
// Create a new task
export async function createTask(params) {
    const { title, description, status = 'backlog', dependencies = [] } = params;
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
            return { success: true, task };
        }
        catch (error) {
            return { success: false, error: `Failed to create task: ${error.message}` };
        }
    });
}
// List all tasks
export async function listTasks(params) {
    const cacheKey = `tasks:list:${params?.status || 'all'}`;
    const cached = cache.get(cacheKey);
    if (cached)
        return cached;
    const supabase = getSupabaseClient();
    return withRetry(async () => {
        let query = supabase
            .from('tasks')
            .select('*')
            .order('created_at', { ascending: false });
        if (params?.status) {
            query = query.eq('status', params.status);
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
export async function updateTask(params) {
    const { id, title, description, status, dependencies } = params;
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
            const updates = {};
            if (title !== undefined)
                updates.title = title;
            if (description !== undefined)
                updates.description = description;
            if (status !== undefined)
                updates.status = status;
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
            const changes = {};
            if (title !== undefined)
                changes.title = title;
            if (description !== undefined)
                changes.description = description;
            if (status !== undefined)
                changes.status = status;
            if (dependencies !== undefined)
                changes.dependencies = dependencies;
            await emitEvent('task_updated', { task, changes });
            // Invalidate caches
            cache.clearPattern('tasks:*');
            cache.set(`task:${task.id}`, task, TASK_CACHE_TTL);
            return { success: true, task };
        }
        catch (error) {
            return { success: false, error: `Failed to update task: ${error.message}` };
        }
    });
}
// Get a single task by ID
export async function getTask(id) {
    const cacheKey = `task:${id}`;
    const cached = cache.get(cacheKey);
    if (cached)
        return cached;
    const supabase = getSupabaseClient();
    return withRetry(async () => {
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('id', id)
            .single();
        if (error || !data)
            return undefined;
        const task = await rowToTask(data);
        cache.set(cacheKey, task, TASK_CACHE_TTL);
        return task;
    });
}
// Delete a task
export async function deleteTask(id) {
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
            return { success: true };
        }
        catch (error) {
            return { success: false, error: `Failed to delete task: ${error.message}` };
        }
    });
}
// Get comprehensive task context for Claude Code
export async function getTaskContext(id) {
    const supabase = getSupabaseClient();
    return withRetry(async () => {
        try {
            const task = await getTask(id);
            if (!task) {
                return { success: false, error: `Task with id ${id} not found` };
            }
            // Get dependency tasks (batch fetch)
            const dependencies = [];
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
            const dependents = [];
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
            // Generate previous work from completed dependencies
            const previousWork = dependencies
                .filter(dep => dep.status === 'done')
                .map(dep => `${dep.title}: ${dep.description}`);
            // Generate guidelines based on task status and dependencies
            const guidelines = [];
            if (task.status === 'backlog') {
                guidelines.push('This task is in backlog - review dependencies before starting');
            }
            else if (task.status === 'todo') {
                guidelines.push('Task is ready to start - ensure all dependencies are completed');
            }
            else if (task.status === 'in_progress') {
                guidelines.push('Task is in progress - focus on completing current work');
            }
            else if (task.status === 'done') {
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
            // Get relevant knowledge including task-specific feedback
            const knowledge = await getRelevantKnowledge({
                taskTitle: task.title,
                taskDescription: task.description,
                taskId: id,
            });
            // Extract task-specific feedback
            const taskFeedback = knowledge.learnings
                .filter((l) => l.task_id === id)
                .map((l) => ({
                id: l.id,
                feedback: l.lesson,
                type: l.type || 'general',
                pattern: l.pattern || '',
                createdAt: l.created_at,
            }));
            // Extract related learnings (non-task-specific)
            const relatedLearnings = knowledge.learnings
                .filter((l) => l.task_id !== id)
                .map((l) => ({
                id: l.id,
                lesson: l.lesson,
                type: l.type,
                pattern: l.pattern,
            }));
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
                    techStack
                }
            };
        }
        catch (error) {
            return { success: false, error: `Failed to get task context: ${error.message}` };
        }
    });
}
