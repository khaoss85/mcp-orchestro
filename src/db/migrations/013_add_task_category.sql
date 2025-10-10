-- Migration 013: Add task category column
-- Created: 2025-10-04
-- Purpose: Add category column to support task classification (design/frontend, backend/database, test/fix)

BEGIN;

-- Add category column with CHECK constraint for allowed values
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category TEXT
  CHECK (category IN ('design_frontend', 'backend_database', 'test_fix'));

-- Update existing test tasks to 'test_fix' category
-- Based on current test filter logic: tags containing 'test' OR title containing 'test'
UPDATE tasks
SET category = 'test_fix'
WHERE category IS NULL
  AND (
    'test' = ANY(tags)
    OR LOWER(title) LIKE '%test%'
  );

-- Add index for efficient category filtering
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category)
  WHERE category IS NOT NULL;

-- Add column comment for documentation
COMMENT ON COLUMN tasks.category IS 'Task category for visual filtering: design_frontend, backend_database, test_fix (nullable)';

COMMIT;
