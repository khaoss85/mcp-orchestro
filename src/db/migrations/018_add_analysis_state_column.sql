-- Migration 018: Add analysis_state column to tasks table
-- This tracks the completeness of task analysis through 4 states

-- Add analysis_state column with CHECK constraint
ALTER TABLE tasks ADD COLUMN analysis_state TEXT NOT NULL DEFAULT 'not_analyzed'
  CHECK (analysis_state IN ('not_analyzed', 'prepared', 'saved', 'ready'));

-- Add index for efficient filtering by analysis state
CREATE INDEX idx_tasks_analysis_state ON tasks(analysis_state);

-- Add partial index for tasks ready for implementation
CREATE INDEX idx_tasks_ready_for_implementation ON tasks(analysis_state)
  WHERE analysis_state = 'ready';

-- Comment explaining the analysis states
COMMENT ON COLUMN tasks.analysis_state IS 'Analysis completeness: not_analyzed (no analysis), prepared (prompt generated), saved (analysis completed), ready (execution prompt with full context)';

-- Optional: Create trigger to auto-update analysis_state when metadata.analysis changes
CREATE OR REPLACE FUNCTION update_analysis_state_from_metadata()
RETURNS TRIGGER AS $$
BEGIN
  -- If metadata.analysis exists and has analyzed_at, set state to 'saved'
  IF NEW.metadata ? 'analysis' AND NEW.metadata->'analysis' ? 'analyzed_at' THEN
    NEW.analysis_state := 'saved';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_analysis_state
  BEFORE UPDATE OF metadata ON tasks
  FOR EACH ROW
  WHEN (NEW.metadata IS DISTINCT FROM OLD.metadata)
  EXECUTE FUNCTION update_analysis_state_from_metadata();
