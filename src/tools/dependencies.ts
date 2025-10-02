import 'dotenv/config';
import { getTask } from './task.js';
import { getSupabaseClient, withRetry } from '../db/supabase.js';
import { cache } from '../db/cache.js';

export type ResourceType = 'file' | 'component' | 'api' | 'model';
export type ActionType = 'uses' | 'modifies' | 'creates';
export type ConflictSeverity = 'high' | 'medium' | 'low';
export type ConflictType = 'concurrent_write' | 'concurrent_modify' | 'potential_collision';

export interface ResourceNode {
  id: string;
  type: ResourceType;
  name: string;
  path?: string;
  createdAt: string;
}

export interface ResourceEdge {
  id: string;
  from: string; // taskId (for backward compatibility)
  to: string;   // resourceId
  type: ActionType;
  taskId: string;
  createdAt: string;
}

export interface AnalyzedResource {
  type: ResourceType;
  name: string;
  path?: string;
  action: ActionType;
  confidence: number;
}

export interface Conflict {
  taskId: string;
  taskTitle?: string;
  resourceId: string;
  resourceName: string;
  conflictType: ConflictType;
  severity: ConflictSeverity;
  description: string;
}

export interface DependencyGraph {
  nodes: ResourceNode[];
  edges: ResourceEdge[];
}

// Cache configuration (resources change infrequently)
const RESOURCE_CACHE_TTL = 15 * 60 * 1000; // 15 minutes
const DEPENDENCY_GRAPH_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// Helper: Convert database row to ResourceNode
function dbRowToResourceNode(row: any): ResourceNode {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    path: row.path,
    createdAt: row.created_at,
  };
}

// Helper: Convert database row to ResourceEdge
function dbRowToResourceEdge(row: any): ResourceEdge {
  return {
    id: row.id,
    from: row.task_id,  // Map task_id to 'from' for backward compatibility
    to: row.resource_id,
    type: row.action_type,  // Map action_type to 'type'
    taskId: row.task_id,
    createdAt: row.created_at,
  };
}

/**
 * NOTE: This module has been simplified. Direct codebase analysis has been moved to taskPreparation.ts
 * analyzeDependencies() is now deprecated - use prepare_task_for_execution instead
 *
 * The new flow:
 * 1. Call prepare_task_for_execution(taskId) - gets structured prompt
 * 2. Claude Code analyzes codebase using its tools (Read, Grep, Glob)
 * 3. Call save_task_analysis(taskId, analysis) - saves results
 * 4. Call get_execution_prompt(taskId) - gets enriched prompt
 */

// Note: detectResourceConflicts() function removed - now using PostgreSQL detect_conflicts() function

// Save dependencies and detect conflicts
export async function saveDependencies(
  taskId: string,
  resources: AnalyzedResource[]
): Promise<{
  success: boolean;
  conflicts?: Conflict[];
  resourceIds?: string[];
  error?: string;
}> {
  const supabase = getSupabaseClient();

  return withRetry(async () => {
    try {
      // 1. Validate task exists
      const task = await getTask(taskId);
      if (!task) {
        return {
          success: false,
          error: `Task with id ${taskId} not found`,
        };
      }

      // 2. Batch upsert resource nodes (use PostgreSQL UPSERT on conflict)
      const nodesToUpsert = resources.map(r => ({
        type: r.type,
        name: r.name,
        path: r.path || null,
      }));

      const { data: upsertedNodes, error: nodeError } = await supabase
        .from('resource_nodes')
        .upsert(nodesToUpsert, { onConflict: 'type,name', ignoreDuplicates: false })
        .select();

      if (nodeError) {
        return {
          success: false,
          error: `Failed to upsert resource nodes: ${nodeError.message}`,
        };
      }

      // 3. Batch upsert edges (PostgreSQL handles duplicates with UNIQUE constraint)
      const edgesToInsert = resources.map((r, idx) => ({
        task_id: taskId,
        resource_id: upsertedNodes![idx].id,
        action_type: r.action,
      }));

      const { error: edgeError } = await supabase
        .from('resource_edges')
        .upsert(edgesToInsert, { onConflict: 'task_id,resource_id,action_type' });

      if (edgeError) {
        return {
          success: false,
          error: `Failed to upsert resource edges: ${edgeError.message}`,
        };
      }

      // 4. Use PostgreSQL detect_conflicts() function
      const { data: conflictData, error: conflictError } = await supabase
        .rpc('detect_conflicts', { target_task_id: taskId });

      if (conflictError) {
        console.warn('Failed to detect conflicts:', conflictError);
        // Non-fatal: continue without conflicts
      }

      // 5. Transform to Conflict[] format
      const conflicts: Conflict[] = (conflictData || []).map((c: any) => ({
        taskId: c.conflict_task_id,
        taskTitle: c.conflict_task_title,
        resourceId: c.resource_id,
        resourceName: c.resource_name,
        conflictType: c.conflict_type as ConflictType,
        severity: c.severity as ConflictSeverity,
        description: c.description,
      }));

      // 6. Invalidate caches
      cache.delete(`task:${taskId}:dependencies`);
      cache.delete(`task:${taskId}:conflicts`);
      cache.clearPattern('resource:*:usage');

      return {
        success: true,
        resourceIds: upsertedNodes!.map(n => n.id),
        conflicts: conflicts.length > 0 ? conflicts : undefined,
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to save dependencies: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  });
}

// Get dependency graph for a task
export async function getTaskDependencyGraph(taskId: string): Promise<DependencyGraph | null> {
  const cacheKey = `task:${taskId}:dependencies`;
  const cached = cache.get<DependencyGraph>(cacheKey);
  if (cached) return cached;

  const supabase = getSupabaseClient();

  return withRetry(async () => {
    try {
      // Batch query: fetch edges with resource nodes in one query
      const { data, error } = await supabase
        .from('resource_edges')
        .select(`
          id,
          task_id,
          resource_id,
          action_type,
          created_at,
          resource_nodes!inner (
            id,
            type,
            name,
            path,
            created_at
          )
        `)
        .eq('task_id', taskId);

      if (error) throw error;
      if (!data || data.length === 0) return null;

      // Transform joined data - deduplicate nodes
      const uniqueNodes = new Map<string, ResourceNode>();
      const edges: ResourceEdge[] = [];

      for (const row of data) {
        const resourceNode = row.resource_nodes as any;

        // Add node if not already present
        if (!uniqueNodes.has(resourceNode.id)) {
          uniqueNodes.set(resourceNode.id, dbRowToResourceNode(resourceNode));
        }

        // Add edge
        edges.push(dbRowToResourceEdge(row));
      }

      const graph: DependencyGraph = {
        nodes: Array.from(uniqueNodes.values()),
        edges,
      };

      cache.set(cacheKey, graph, DEPENDENCY_GRAPH_CACHE_TTL);
      return graph;

    } catch (error) {
      console.error('Failed to fetch dependency graph:', error);
      return null;
    }
  });
}

// Get all tasks that touch a resource
export async function getResourceUsage(resourceId: string): Promise<{
  resource: ResourceNode | null;
  tasks: Array<{ taskId: string; taskTitle?: string; action: ActionType }>;
}> {
  const cacheKey = `resource:${resourceId}:usage`;
  const cached = cache.get<{ resource: ResourceNode | null; tasks: Array<{ taskId: string; taskTitle?: string; action: ActionType }> }>(cacheKey);
  if (cached) return cached;

  const supabase = getSupabaseClient();

  return withRetry(async () => {
    try {
      // 1. Fetch resource node
      const { data: resourceData, error: resourceError } = await supabase
        .from('resource_nodes')
        .select('*')
        .eq('id', resourceId)
        .single();

      if (resourceError && resourceError.code !== 'PGRST116') {
        throw resourceError;
      }

      // 2. Fetch edges with task details in one query
      const { data: edgeData, error: edgeError } = await supabase
        .from('resource_edges')
        .select(`
          task_id,
          action_type,
          tasks!inner (
            title
          )
        `)
        .eq('resource_id', resourceId);

      if (edgeError) throw edgeError;

      const tasks = (edgeData || []).map(row => {
        const task = row.tasks as any;
        return {
          taskId: row.task_id,
          taskTitle: task.title,
          action: row.action_type as ActionType,
        };
      });

      const result = {
        resource: resourceData ? dbRowToResourceNode(resourceData) : null,
        tasks,
      };

      cache.set(cacheKey, result, RESOURCE_CACHE_TTL);
      return result;

    } catch (error) {
      console.error('Failed to fetch resource usage:', error);
      return { resource: null, tasks: [] };
    }
  });
}

// Get conflicts for a specific task
export async function getTaskConflicts(taskId: string): Promise<Conflict[]> {
  const cacheKey = `task:${taskId}:conflicts`;
  const cached = cache.get<Conflict[]>(cacheKey);
  if (cached) return cached;

  const supabase = getSupabaseClient();

  return withRetry(async () => {
    try {
      // Use PostgreSQL detect_conflicts() function
      const { data, error } = await supabase
        .rpc('detect_conflicts', { target_task_id: taskId });

      if (error) throw error;

      const conflicts: Conflict[] = (data || []).map((c: any) => ({
        taskId: c.conflict_task_id,
        taskTitle: c.conflict_task_title,
        resourceId: c.resource_id,
        resourceName: c.resource_name,
        conflictType: c.conflict_type as ConflictType,
        severity: c.severity as ConflictSeverity,
        description: c.description,
      }));

      cache.set(cacheKey, conflicts, DEPENDENCY_GRAPH_CACHE_TTL);
      return conflicts;

    } catch (error) {
      console.error('Failed to fetch conflicts:', error);
      return [];
    }
  });
}
