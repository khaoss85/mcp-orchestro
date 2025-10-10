import { getSupabaseClient } from '../db/supabase.js';
import { emitEvent } from '../db/eventQueue.js';

export interface HistoryEvent {
  id: string;
  event_type: 'task_created' | 'task_updated' | 'feedback_received' | 'decision_made' | 'guardian_intervention' | 'code_changed' | 'status_transition';
  timestamp: string;
  payload: any;
  actor: 'claude' | 'human' | 'guardian' | 'system';
}

export interface DecisionEntry {
  taskId: string;
  decision: string;
  rationale: string;
  timestamp: Date;
  actor: 'claude' | 'human';
  context?: string;
}

export interface CodeChangeEntry {
  taskId: string;
  files: string[];
  diff?: string;
  commitHash?: string;
  description: string;
  timestamp: Date;
}

export interface GuardianIntervention {
  taskId: string;
  guardianType: 'database' | 'architecture' | 'api' | 'production-ready' | 'test-maintainer';
  issue: string;
  action: string;
  timestamp: Date;
}

/**
 * Get complete history for a task
 */
export async function getTaskHistory(taskId: string): Promise<HistoryEvent[]> {
  const supabase = getSupabaseClient();

  // Query all events related to this task
  const { data, error } = await supabase
    .from('event_queue')
    .select('*')
    .or(`payload->task->id.eq."${taskId}",payload->taskId.eq."${taskId}"`)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch task history:', error);
    return [];
  }

  return (data || []).map((event) => ({
    id: event.id,
    event_type: event.event_type,
    timestamp: event.created_at,
    payload: event.payload,
    actor: determineActor(event),
  }));
}

/**
 * Get status transition history
 */
export async function getStatusHistory(taskId: string) {
  const supabase = getSupabaseClient();

  const { data } = await supabase
    .from('event_queue')
    .select('*')
    .eq('event_type', 'status_transition')
    .eq('payload->taskId', taskId)
    .order('created_at', { ascending: true });

  return data || [];
}

/**
 * Get decisions made for a task
 */
export async function getDecisions(taskId: string) {
  const supabase = getSupabaseClient();

  const { data } = await supabase
    .from('event_queue')
    .select('*')
    .eq('event_type', 'decision_made')
    .eq('payload->taskId', taskId)
    .order('created_at', { ascending: true });

  return data || [];
}

/**
 * Get guardian interventions for a task
 */
export async function getGuardianInterventions(taskId: string) {
  const supabase = getSupabaseClient();

  const { data } = await supabase
    .from('event_queue')
    .select('*')
    .eq('event_type', 'guardian_intervention')
    .eq('payload->taskId', taskId)
    .order('created_at', { ascending: true });

  return data || [];
}

/**
 * Get code changes for a task
 */
export async function getCodeChanges(taskId: string) {
  const supabase = getSupabaseClient();

  const { data } = await supabase
    .from('event_queue')
    .select('*')
    .eq('event_type', 'code_changed')
    .eq('payload->taskId', taskId)
    .order('created_at', { ascending: true });

  return data || [];
}

/**
 * Record a decision
 */
export async function recordDecision(entry: DecisionEntry): Promise<void> {
  await emitEvent('decision_made', {
    taskId: entry.taskId,
    decision: entry.decision,
    rationale: entry.rationale,
    actor: entry.actor,
    context: entry.context,
    timestamp: entry.timestamp.toISOString(),
  });
}

/**
 * Record a code change
 */
export async function recordCodeChange(entry: CodeChangeEntry): Promise<void> {
  await emitEvent('code_changed', {
    taskId: entry.taskId,
    files: entry.files,
    diff: entry.diff,
    commitHash: entry.commitHash,
    description: entry.description,
    timestamp: entry.timestamp.toISOString(),
  });
}

/**
 * Record a guardian intervention
 */
export async function recordGuardianIntervention(entry: GuardianIntervention): Promise<void> {
  await emitEvent('guardian_intervention', {
    taskId: entry.taskId,
    guardianType: entry.guardianType,
    issue: entry.issue,
    action: entry.action,
    timestamp: entry.timestamp.toISOString(),
  });
}

/**
 * Record a status transition with context
 */
export async function recordStatusTransition(
  taskId: string,
  fromStatus: string,
  toStatus: string,
  reason?: string
): Promise<void> {
  await emitEvent('status_transition', {
    taskId,
    fromStatus,
    toStatus,
    reason,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get task iteration count
 */
export async function getIterationCount(taskId: string): Promise<number> {
  const supabase = getSupabaseClient();

  const { count } = await supabase
    .from('event_queue')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'task_updated')
    .eq('payload->task->id', taskId);

  return count || 0;
}

/**
 * Get snapshot of task at specific time
 */
export async function getTaskSnapshot(taskId: string, timestamp: Date) {
  const supabase = getSupabaseClient();

  // Get all events up to the timestamp
  const { data } = await supabase
    .from('event_queue')
    .select('*')
    .or(`payload->task->id.eq."${taskId}",payload->taskId.eq."${taskId}"`)
    .lte('created_at', timestamp.toISOString())
    .order('created_at', { ascending: true });

  if (!data || data.length === 0) {
    return null;
  }

  // Reconstruct task state by replaying events
  let taskState: any = null;

  for (const event of data) {
    if (event.event_type === 'task_created') {
      taskState = event.payload.task;
    } else if (event.event_type === 'task_updated') {
      taskState = { ...taskState, ...event.payload.changes };
    } else if (event.event_type === 'status_transition') {
      taskState = { ...taskState, status: event.payload.toStatus };
    }
  }

  return taskState;
}

/**
 * Rollback task to previous state
 */
export async function rollbackTask(taskId: string, targetTimestamp: Date) {
  const snapshot = await getTaskSnapshot(taskId, targetTimestamp);

  if (!snapshot) {
    throw new Error('No snapshot found at specified timestamp');
  }

  const supabase = getSupabaseClient();

  // Update task to snapshot state
  const { error } = await supabase
    .from('tasks')
    .update({
      title: snapshot.title,
      description: snapshot.description,
      status: snapshot.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId);

  if (error) {
    throw new Error(`Rollback failed: ${error.message}`);
  }

  // Record the rollback as a special event
  await emitEvent('task_updated', {
    task: snapshot,
    changes: { rollback: true, rolledBackTo: targetTimestamp },
    reason: 'Rollback to previous state',
  });

  return snapshot;
}

/**
 * Determine actor from event
 */
function determineActor(event: any): 'claude' | 'human' | 'guardian' | 'system' {
  if (event.payload.actor) {
    return event.payload.actor;
  }

  // Infer from event type
  if (event.event_type === 'guardian_intervention') {
    return 'guardian';
  }

  if (event.event_type === 'codebase_analyzed') {
    return 'system';
  }

  // Default to claude for task operations
  return 'claude';
}

/**
 * Get aggregated stats for task
 */
export async function getTaskStats(taskId: string) {
  const history = await getTaskHistory(taskId);
  const iterations = await getIterationCount(taskId);

  const stats = {
    totalEvents: history.length,
    iterations,
    decisions: history.filter((e) => e.event_type === 'decision_made').length,
    guardianInterventions: history.filter((e) => e.event_type === 'guardian_intervention').length,
    codeChanges: history.filter((e) => e.event_type === 'code_changed').length,
    statusTransitions: history.filter((e) => e.event_type === 'status_transition').length,
    firstEvent: history[0]?.timestamp,
    lastEvent: history[history.length - 1]?.timestamp,
  };

  return stats;
}
