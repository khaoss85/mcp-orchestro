-- Migration: 002_add_dependency_completion_check
-- Add trigger to enforce that all dependencies are 'done' before moving to 'in_progress'

CREATE OR REPLACE FUNCTION check_dependency_completion()
RETURNS TRIGGER AS $$
DECLARE
  incomplete_dep_title TEXT;
  incomplete_dep_id UUID;
BEGIN
  -- Only check when transitioning TO 'in_progress'
  IF NEW.status = 'in_progress' AND (TG_OP = 'INSERT' OR OLD.status != 'in_progress') THEN
    -- Check if any dependencies are not 'done'
    IF EXISTS (
      SELECT 1
      FROM task_dependencies td
      INNER JOIN tasks dep_task ON dep_task.id = td.depends_on_task_id
      WHERE td.task_id = NEW.id
        AND dep_task.status != 'done'
    ) THEN
      -- Get the first incomplete dependency for error message
      SELECT dep_task.id, dep_task.title
      INTO incomplete_dep_id, incomplete_dep_title
      FROM task_dependencies td
      INNER JOIN tasks dep_task ON dep_task.id = td.depends_on_task_id
      WHERE td.task_id = NEW.id
        AND dep_task.status != 'done'
      LIMIT 1;

      RAISE EXCEPTION 'Dependency task % (%) is not done yet', incomplete_dep_id, incomplete_dep_title;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_dependency_completion
  BEFORE INSERT OR UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION check_dependency_completion();
