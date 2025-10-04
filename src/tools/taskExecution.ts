import { getSupabaseClient, withRetry } from '../db/supabase.js';
import { cache } from '../db/cache.js';

// Cache configuration
const EXECUTION_ORDER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export interface TaskExecutionNode {
  id: string;
  title: string;
  executionOrder: number;
  dependencies: string[];
}

export interface ExecutionOrderResult {
  success: boolean;
  executionOrder?: TaskExecutionNode[];
  error?: string;
  cycleDetected?: boolean;
  cyclePath?: string[];
}

/**
 * Implements topological sort using Kahn's algorithm
 *
 * Kahn's Algorithm:
 * 1. Find all nodes with no incoming edges (in-degree = 0)
 * 2. Add them to queue and remove from graph
 * 3. For each node, reduce in-degree of its neighbors
 * 4. Repeat until queue is empty
 * 5. If all nodes processed -> valid order; else -> cycle detected
 *
 * @param tasks - Array of tasks with their dependencies
 * @returns Execution order or cycle detection error
 */
function topologicalSort(tasks: Array<{ id: string; title: string; dependencies: string[] }>): ExecutionOrderResult {
  // Build adjacency list and in-degree map
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();
  const taskMap = new Map<string, { id: string; title: string }>();

  // Initialize all tasks
  for (const task of tasks) {
    taskMap.set(task.id, { id: task.id, title: task.title });
    inDegree.set(task.id, 0);
    adjList.set(task.id, []);
  }

  // Build graph: for each dependency, create edge from dependency to task
  for (const task of tasks) {
    for (const depId of task.dependencies) {
      // Only process if dependency exists in our task set
      if (taskMap.has(depId)) {
        // Add edge: depId -> task.id
        adjList.get(depId)!.push(task.id);
        inDegree.set(task.id, (inDegree.get(task.id) || 0) + 1);
      }
    }
  }

  // Find all nodes with in-degree 0 (no dependencies)
  const queue: string[] = [];
  for (const [taskId, degree] of inDegree) {
    if (degree === 0) {
      queue.push(taskId);
    }
  }

  const executionOrder: TaskExecutionNode[] = [];
  let position = 1;

  // Process queue (Kahn's algorithm)
  while (queue.length > 0) {
    const taskId = queue.shift()!;
    const task = taskMap.get(taskId)!;

    executionOrder.push({
      id: task.id,
      title: task.title,
      executionOrder: position++,
      dependencies: tasks.find(t => t.id === taskId)?.dependencies || [],
    });

    // Reduce in-degree for all neighbors
    for (const neighbor of adjList.get(taskId) || []) {
      const newDegree = inDegree.get(neighbor)! - 1;
      inDegree.set(neighbor, newDegree);

      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  // Check if all nodes were processed
  if (executionOrder.length !== tasks.length) {
    // Cycle detected - find the cycle path
    const cyclePath = findCycle(tasks, executionOrder.map(t => t.id));

    return {
      success: false,
      error: 'Circular dependency detected in task dependencies',
      cycleDetected: true,
      cyclePath,
    };
  }

  return {
    success: true,
    executionOrder,
  };
}

/**
 * Finds a cycle in the dependency graph using DFS
 *
 * @param tasks - All tasks
 * @param processedIds - IDs that were successfully processed (not in cycle)
 * @returns Array of task IDs forming the cycle
 */
function findCycle(
  tasks: Array<{ id: string; title: string; dependencies: string[] }>,
  processedIds: string[]
): string[] {
  const unprocessed = tasks.filter(t => !processedIds.includes(t.id));

  if (unprocessed.length === 0) return [];

  const visited = new Set<string>();
  const recStack = new Set<string>();
  const path: string[] = [];

  function dfs(taskId: string): boolean {
    visited.add(taskId);
    recStack.add(taskId);
    path.push(taskId);

    const task = tasks.find(t => t.id === taskId);
    if (!task) return false;

    for (const depId of task.dependencies) {
      if (!visited.has(depId)) {
        if (dfs(depId)) return true;
      } else if (recStack.has(depId)) {
        // Found cycle - trim path to cycle only
        const cycleStart = path.indexOf(depId);
        return true;
      }
    }

    recStack.delete(taskId);
    path.pop();
    return false;
  }

  // Start DFS from first unprocessed node
  for (const task of unprocessed) {
    if (!visited.has(task.id)) {
      if (dfs(task.id)) {
        return path;
      }
    }
  }

  return [];
}

/**
 * Get execution order for tasks in a project or user story
 *
 * @param params - Filter parameters
 * @returns Topologically sorted tasks with execution order numbers
 */
export async function getExecutionOrder(params?: {
  userStoryId?: string;
  status?: 'backlog' | 'todo' | 'in_progress' | 'done';
}): Promise<ExecutionOrderResult> {
  const cacheKey = `execution_order:${params?.userStoryId || 'all'}:${params?.status || 'all'}`;
  const cached = cache.get<ExecutionOrderResult>(cacheKey);
  if (cached) return cached;

  const supabase = getSupabaseClient();

  return withRetry(async () => {
    try {
      // Build query
      let query = supabase
        .from('tasks')
        .select('id, title');

      if (params?.userStoryId) {
        query = query.eq('user_story_id', params.userStoryId);
      }

      if (params?.status) {
        query = query.eq('status', params.status);
      }

      const { data: taskRows, error: taskError } = await query;

      if (taskError) {
        return {
          success: false,
          error: `Failed to fetch tasks: ${taskError.message}`,
        };
      }

      if (!taskRows || taskRows.length === 0) {
        return {
          success: true,
          executionOrder: [],
        };
      }

      const taskIds = taskRows.map(t => t.id);

      // Batch fetch all dependencies for these tasks
      const { data: depRows, error: depError } = await supabase
        .from('task_dependencies')
        .select('task_id, depends_on_task_id')
        .in('task_id', taskIds);

      if (depError) {
        return {
          success: false,
          error: `Failed to fetch dependencies: ${depError.message}`,
        };
      }

      // Build tasks with dependencies
      const depsMap = new Map<string, string[]>();
      for (const dep of depRows || []) {
        if (!depsMap.has(dep.task_id)) {
          depsMap.set(dep.task_id, []);
        }
        depsMap.get(dep.task_id)!.push(dep.depends_on_task_id);
      }

      const tasks = taskRows.map(row => ({
        id: row.id,
        title: row.title,
        dependencies: depsMap.get(row.id) || [],
      }));

      // Perform topological sort
      const result = topologicalSort(tasks);

      // Cache successful results
      if (result.success) {
        cache.set(cacheKey, result, EXECUTION_ORDER_CACHE_TTL);
      }

      return result;

    } catch (error) {
      return {
        success: false,
        error: `Failed to calculate execution order: ${(error as Error).message}`,
      };
    }
  });
}
