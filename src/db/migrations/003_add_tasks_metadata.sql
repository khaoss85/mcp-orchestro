-- Migration 003: Add metadata column to tasks table
-- This enables storing task analysis results from the new workflow

-- Add metadata column for storing analysis results
ALTER TABLE tasks ADD COLUMN metadata JSONB DEFAULT '{}';

-- Add GIN index for efficient JSONB queries
CREATE INDEX idx_tasks_metadata ON tasks USING GIN(metadata);

-- Add partial index for checking if task has been analyzed
CREATE INDEX idx_tasks_analyzed ON tasks
  ((metadata->'analysis' IS NOT NULL))
  WHERE metadata->'analysis' IS NOT NULL;

-- Comment explaining the metadata structure
COMMENT ON COLUMN tasks.metadata IS 'Stores task analysis results in structure: { analysis: { files_to_modify, files_to_create, risks, related_code, recommendations, analyzed_at } }';
