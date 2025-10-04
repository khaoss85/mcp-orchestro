-- Migration: Update event_queue constraints and add performance indexes
-- Date: 2025-10-04
-- Purpose: Add missing event types and optimize JSONB queries

-- Step 1: Update CHECK constraint to include all event types
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

-- Step 2: Add performance indexes for JSONB payload queries
-- These optimize the frequent taskId lookups in taskHistory.ts

-- Index for payload->taskId queries
CREATE INDEX IF NOT EXISTS idx_event_queue_payload_taskId
  ON event_queue USING GIN ((payload->'taskId'));

-- Index for payload->task->id queries (legacy format)
CREATE INDEX IF NOT EXISTS idx_event_queue_payload_task_id
  ON event_queue USING GIN ((payload->'task'->'id'));

-- Composite index for filtered queries by event type
CREATE INDEX IF NOT EXISTS idx_event_queue_type_processed_created
  ON event_queue(event_type, processed, created_at);

-- Step 3: Add table comment explaining design decisions
COMMENT ON TABLE event_queue IS
  'Event sourcing table for audit trail and task history. No FK to tasks table to preserve events after task deletion (audit requirement).';

COMMENT ON COLUMN event_queue.payload IS
  'JSONB payload. Standard structure: { taskId: "uuid", ... }. Legacy events may use { task: { id: "uuid" } }.';
