-- Migration: 007_add_user_story_grouping
-- Add user story grouping capability to existing tasks table
-- This enables Trello-like UX where user stories group related tasks

-- Add new columns to tasks table
ALTER TABLE tasks
  ADD COLUMN user_story_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  ADD COLUMN is_user_story BOOLEAN DEFAULT FALSE,
  ADD COLUMN story_metadata JSONB DEFAULT '{}';

-- Create indexes for efficient queries
CREATE INDEX idx_tasks_user_story_id ON tasks(user_story_id) WHERE user_story_id IS NOT NULL;
CREATE INDEX idx_tasks_is_user_story ON tasks(is_user_story) WHERE is_user_story = TRUE;

-- Add constraint: user stories cannot have a parent user story (prevent nesting)
ALTER TABLE tasks
  ADD CONSTRAINT check_user_story_no_parent
  CHECK (NOT (is_user_story = TRUE AND user_story_id IS NOT NULL));

-- Update function to validate user story relationships
CREATE OR REPLACE FUNCTION validate_user_story_relationship()
RETURNS TRIGGER AS $$
BEGIN
  -- If user_story_id is set, verify the parent is actually a user story
  IF NEW.user_story_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM tasks
      WHERE id = NEW.user_story_id
      AND is_user_story = TRUE
    ) THEN
      RAISE EXCEPTION 'Referenced user_story_id % is not a user story', NEW.user_story_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_user_story_relationship
  BEFORE INSERT OR UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION validate_user_story_relationship();

-- View for easy querying of user stories with task counts
CREATE OR REPLACE VIEW user_stories_with_counts AS
SELECT
  us.id,
  us.title,
  us.description,
  us.status,
  us.story_metadata,
  us.created_at,
  us.updated_at,
  COUNT(t.id) AS task_count,
  COUNT(CASE WHEN t.status = 'done' THEN 1 END) AS completed_tasks,
  COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) AS in_progress_tasks,
  COUNT(CASE WHEN t.status = 'todo' THEN 1 END) AS todo_tasks,
  COUNT(CASE WHEN t.status = 'backlog' THEN 1 END) AS backlog_tasks
FROM tasks us
LEFT JOIN tasks t ON t.user_story_id = us.id
WHERE us.is_user_story = TRUE
GROUP BY us.id, us.title, us.description, us.status, us.story_metadata, us.created_at, us.updated_at;

-- Comment for documentation
COMMENT ON COLUMN tasks.user_story_id IS 'References the parent user story task. NULL for top-level tasks and user stories.';
COMMENT ON COLUMN tasks.is_user_story IS 'TRUE if this task represents a user story that groups other tasks.';
COMMENT ON COLUMN tasks.story_metadata IS 'JSONB metadata for user stories: complexity, estimatedHours, tags, originalStory.';
COMMENT ON VIEW user_stories_with_counts IS 'Provides user stories with aggregated task counts by status for dashboard display.';
