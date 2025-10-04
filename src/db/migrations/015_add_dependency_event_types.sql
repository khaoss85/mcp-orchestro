-- Add new event types for dependency tracking and real-time updates
-- Migration: 015_add_dependency_event_types

-- Update the event_type CHECK constraint to include new dependency event types
ALTER TABLE event_queue DROP CONSTRAINT IF EXISTS event_queue_event_type_check;

ALTER TABLE event_queue ADD CONSTRAINT event_queue_event_type_check
CHECK (event_type IN (
  'task_created',
  'task_updated',
  'task_deleted',
  'feedback_received',
  'codebase_analyzed',
  'decision_made',
  'guardian_intervention',
  'code_changed',
  'status_transition',
  'user_story_created',
  'dependency_added',
  'dependency_removed',
  'execution_order_changed'
));

-- Add comment explaining new event types
COMMENT ON TABLE event_queue IS 'Queue for real-time events including task updates, dependency changes, and execution order updates';
COMMENT ON COLUMN event_queue.event_type IS 'Type of event: task lifecycle, dependency changes, or execution order updates';
