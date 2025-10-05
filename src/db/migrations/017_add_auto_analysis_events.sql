-- Migration 017: Add auto-analysis event types to event_queue constraint
-- This allows the system to emit events for automatic task analysis workflow

-- Drop existing check constraint
ALTER TABLE event_queue DROP CONSTRAINT IF EXISTS event_queue_event_type_check;

-- Recreate with new event types
ALTER TABLE event_queue ADD CONSTRAINT event_queue_event_type_check CHECK (
  event_type IN (
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
    'user_story_deleted',
    'dependency_added',
    'dependency_removed',
    'execution_order_changed',
    'auto_analysis_started',
    'task_analysis_prepared',
    'auto_analysis_completed'
  )
);
