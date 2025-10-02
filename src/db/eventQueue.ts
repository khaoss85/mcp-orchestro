import { getSupabaseClient } from './supabase.js';

export interface QueuedEvent {
  id?: string;
  event_type: 'task_created' | 'task_updated' | 'feedback_received' | 'codebase_analyzed' | 'decision_made' | 'guardian_intervention' | 'code_changed' | 'status_transition';
  payload: any;
  processed?: boolean;
  created_at?: string;
  processed_at?: string;
}

export async function emitEvent(eventType: QueuedEvent['event_type'], payload: any): Promise<void> {
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

export async function fetchUnprocessedEvents(limit = 100): Promise<QueuedEvent[]> {
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

export async function markEventProcessed(eventId: string): Promise<void> {
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
