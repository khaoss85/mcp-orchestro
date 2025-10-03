-- Migration 008: Add task metadata fields (assignee, priority, tags)
-- Created: 2025-10-03
-- Purpose: Add user-facing metadata to support task assignment, prioritization, and categorization

BEGIN;

-- Add assignee column (nullable TEXT for user/team name)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee TEXT;

-- Add priority column with CHECK constraint
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority TEXT
  CHECK (priority IN ('low', 'medium', 'high', 'urgent'));

-- Add tags column as TEXT array (default empty array)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Add indexes for efficient filtering and searching
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee)
  WHERE assignee IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority)
  WHERE priority IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_tags ON tasks USING GIN(tags);

-- Add column comments for documentation
COMMENT ON COLUMN tasks.assignee IS 'User or team assigned to this task (nullable)';
COMMENT ON COLUMN tasks.priority IS 'Task priority level: low, medium, high, urgent (nullable)';
COMMENT ON COLUMN tasks.tags IS 'Array of tags for categorization and filtering';

COMMIT;
