-- Migration: Add test tagging guideline to project
-- This ensures Claude Code always tags test tasks properly for filtering

-- Step 1: Add guidelines column if it doesn't exist
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS guidelines jsonb DEFAULT '[]'::jsonb;

-- Step 2: Add guideline about test tagging
UPDATE projects
SET guidelines = COALESCE(guidelines, '[]'::jsonb) ||
  jsonb_build_array(
    'IMPORTANT: When creating test-related tasks (unit tests, integration tests, E2E tests, test data, etc.), ALWAYS include "test" in the tags array for proper filtering and visual distinction, regardless of the language used in the title or description.'
  )
WHERE id = (SELECT id FROM projects LIMIT 1)
AND NOT (guidelines @> jsonb_build_array('IMPORTANT: When creating test-related tasks (unit tests, integration tests, E2E tests, test data, etc.), ALWAYS include "test" in the tags array for proper filtering and visual distinction, regardless of the language used in the title or description.'));

-- Verify the guideline was added
SELECT
  id,
  name,
  jsonb_array_length(guidelines) as guideline_count,
  guidelines
FROM projects;
