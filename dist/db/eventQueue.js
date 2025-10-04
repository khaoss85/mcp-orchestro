import { getSupabaseClient } from './supabase.js';
export async function emitEvent(eventType, payload) {
    const supabase = getSupabaseClient();
    const { error } = await supabase
        .from('event_queue')
        .insert({
        event_type: eventType,
        payload,
        processed: false
    });
    if (error) {
        console.error('Failed to emit event:', error);
    }
}
export async function fetchUnprocessedEvents(limit = 100) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
        .from('event_queue')
        .select('*')
        .eq('processed', false)
        .order('created_at', { ascending: true })
        .limit(limit);
    if (error) {
        console.error('Failed to fetch events:', error);
        return [];
    }
    return data || [];
}
export async function markEventProcessed(eventId) {
    const supabase = getSupabaseClient();
    const { error } = await supabase
        .from('event_queue')
        .update({
        processed: true,
        processed_at: new Date().toISOString()
    })
        .eq('id', eventId);
    if (error) {
        console.error('Failed to mark event as processed:', error);
    }
}
/**
 * Emit a dependency_added event
 */
export async function emitDependencyAdded(taskId, resourceId, resourceName, action) {
    await emitEvent('dependency_added', {
        taskId,
        resourceId,
        resourceName,
        action
    });
}
/**
 * Emit a dependency_removed event
 */
export async function emitDependencyRemoved(taskId, resourceId, resourceName) {
    await emitEvent('dependency_removed', {
        taskId,
        resourceId,
        resourceName
    });
}
/**
 * Emit an execution_order_changed event
 */
export async function emitExecutionOrderChanged(affectedTasks) {
    await emitEvent('execution_order_changed', {
        affectedTasks
    });
}
