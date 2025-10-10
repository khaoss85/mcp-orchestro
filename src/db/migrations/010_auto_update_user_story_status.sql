-- Migration: 010_auto_update_user_story_status
-- Purpose: Prevent accidental deletion of completed user stories
-- Features:
--   1. Auto-update user story status based on sub-task completion
--   2. Health monitoring view for user stories
--   3. Safe deletion logic to preserve completed work

-- ============================================
-- TRIGGER: Auto-update User Story Status
-- ============================================
-- This trigger automatically updates a user story's status when any of its sub-tasks change status
-- Status logic:
--   - done: ≥80% of sub-tasks are done
--   - in_progress: ≥1 sub-task is in_progress
--   - todo: all sub-tasks are todo/backlog but at least one is todo
--   - backlog: ALL sub-tasks are in backlog

CREATE OR REPLACE FUNCTION auto_update_user_story_status()
RETURNS TRIGGER AS $$
DECLARE
  v_user_story_id UUID;
  v_total_tasks INTEGER;
  v_done_tasks INTEGER;
  v_in_progress_tasks INTEGER;
  v_todo_tasks INTEGER;
  v_backlog_tasks INTEGER;
  v_completion_percentage NUMERIC;
  v_new_status TEXT;
BEGIN
  -- Only proceed if this task belongs to a user story
  v_user_story_id := COALESCE(NEW.user_story_id, OLD.user_story_id);

  IF v_user_story_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Count sub-tasks by status
  SELECT
    COUNT(*) AS total,
    COUNT(CASE WHEN status = 'done' THEN 1 END) AS done,
    COUNT(CASE WHEN status = 'in_progress' THEN 1 END) AS in_progress,
    COUNT(CASE WHEN status = 'todo' THEN 1 END) AS todo,
    COUNT(CASE WHEN status = 'backlog' THEN 1 END) AS backlog
  INTO v_total_tasks, v_done_tasks, v_in_progress_tasks, v_todo_tasks, v_backlog_tasks
  FROM tasks
  WHERE user_story_id = v_user_story_id;

  -- Handle edge case: no sub-tasks
  IF v_total_tasks = 0 THEN
    RETURN NEW;
  END IF;

  -- Calculate completion percentage
  v_completion_percentage := (v_done_tasks::NUMERIC / v_total_tasks::NUMERIC) * 100;

  -- Determine new status based on sub-task states
  IF v_completion_percentage >= 80 THEN
    v_new_status := 'done';
  ELSIF v_in_progress_tasks > 0 THEN
    v_new_status := 'in_progress';
  ELSIF v_todo_tasks > 0 THEN
    v_new_status := 'todo';
  ELSIF v_backlog_tasks = v_total_tasks THEN
    v_new_status := 'backlog';
  ELSE
    -- Default fallback
    v_new_status := 'todo';
  END IF;

  -- Update user story status if it changed
  UPDATE tasks
  SET
    status = v_new_status,
    updated_at = NOW()
  WHERE id = v_user_story_id
    AND status != v_new_status;  -- Only update if status actually changed

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for INSERT operations
CREATE TRIGGER trigger_update_user_story_on_subtask_insert
  AFTER INSERT ON tasks
  FOR EACH ROW
  WHEN (NEW.user_story_id IS NOT NULL)
  EXECUTE FUNCTION auto_update_user_story_status();

-- Create trigger for UPDATE operations
CREATE TRIGGER trigger_update_user_story_on_subtask_update
  AFTER UPDATE OF status ON tasks
  FOR EACH ROW
  WHEN (NEW.user_story_id IS NOT NULL OR OLD.user_story_id IS NOT NULL)
  EXECUTE FUNCTION auto_update_user_story_status();

-- Create trigger for DELETE operations
CREATE TRIGGER trigger_update_user_story_on_subtask_delete
  AFTER DELETE ON tasks
  FOR EACH ROW
  WHEN (OLD.user_story_id IS NOT NULL)
  EXECUTE FUNCTION auto_update_user_story_status();

-- ============================================
-- VIEW: User Stories Health Monitoring
-- ============================================
-- Shows user stories with their actual vs. expected status
-- Helps identify mismatches and completed work in "backlog" status

CREATE OR REPLACE VIEW user_stories_health AS
SELECT
  us.id AS user_story_id,
  us.title AS user_story_title,
  us.status AS current_status,
  us.description,
  us.story_metadata,
  us.created_at,
  us.updated_at,

  -- Task counts by status
  COUNT(t.id) AS total_subtasks,
  COUNT(CASE WHEN t.status = 'done' THEN 1 END) AS done_count,
  COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) AS in_progress_count,
  COUNT(CASE WHEN t.status = 'todo' THEN 1 END) AS todo_count,
  COUNT(CASE WHEN t.status = 'backlog' THEN 1 END) AS backlog_count,

  -- Completion metrics
  ROUND(
    (COUNT(CASE WHEN t.status = 'done' THEN 1 END)::NUMERIC /
     NULLIF(COUNT(t.id), 0)::NUMERIC) * 100,
    2
  ) AS completion_percentage,

  -- Suggested status based on sub-tasks
  CASE
    WHEN COUNT(t.id) = 0 THEN us.status  -- No sub-tasks, keep current
    WHEN (COUNT(CASE WHEN t.status = 'done' THEN 1 END)::NUMERIC / COUNT(t.id)::NUMERIC) >= 0.8
      THEN 'done'
    WHEN COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) > 0
      THEN 'in_progress'
    WHEN COUNT(CASE WHEN t.status = 'todo' THEN 1 END) > 0
      THEN 'todo'
    WHEN COUNT(CASE WHEN t.status = 'backlog' THEN 1 END) = COUNT(t.id)
      THEN 'backlog'
    ELSE 'todo'
  END AS suggested_status,

  -- Status mismatch flag
  CASE
    WHEN COUNT(t.id) = 0 THEN FALSE
    WHEN us.status != (
      CASE
        WHEN (COUNT(CASE WHEN t.status = 'done' THEN 1 END)::NUMERIC / COUNT(t.id)::NUMERIC) >= 0.8
          THEN 'done'
        WHEN COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) > 0
          THEN 'in_progress'
        WHEN COUNT(CASE WHEN t.status = 'todo' THEN 1 END) > 0
          THEN 'todo'
        WHEN COUNT(CASE WHEN t.status = 'backlog' THEN 1 END) = COUNT(t.id)
          THEN 'backlog'
        ELSE 'todo'
      END
    ) THEN TRUE
    ELSE FALSE
  END AS status_mismatch,

  -- Safety flag for deletion
  CASE
    WHEN COUNT(CASE WHEN t.status = 'done' THEN 1 END) > 0 THEN FALSE
    ELSE TRUE
  END AS safe_to_delete

FROM tasks us
LEFT JOIN tasks t ON t.user_story_id = us.id
WHERE us.is_user_story = TRUE
GROUP BY
  us.id,
  us.title,
  us.status,
  us.description,
  us.story_metadata,
  us.created_at,
  us.updated_at;

-- ============================================
-- FUNCTION: Safe Delete Tasks by Status
-- ============================================
-- Safely deletes tasks by status, excluding user stories with completed work
-- Returns a report of what was deleted and what was preserved

CREATE OR REPLACE FUNCTION safe_delete_tasks_by_status(p_status TEXT)
RETURNS TABLE (
  deleted_count INTEGER,
  preserved_count INTEGER,
  deleted_task_ids UUID[],
  preserved_task_ids UUID[],
  preserved_reasons JSONB[]
) AS $$
DECLARE
  v_deleted_ids UUID[] := '{}';
  v_preserved_ids UUID[] := '{}';
  v_preserved_reasons JSONB[] := '{}';
  v_task_record RECORD;
  v_completion_pct NUMERIC;
  v_done_count INTEGER;
  v_total_count INTEGER;
BEGIN
  -- Validate status parameter
  IF p_status NOT IN ('backlog', 'todo', 'in_progress', 'done') THEN
    RAISE EXCEPTION 'Invalid status: %. Must be one of: backlog, todo, in_progress, done', p_status;
  END IF;

  -- Process each task with the specified status
  FOR v_task_record IN
    SELECT
      t.id,
      t.title,
      t.is_user_story,
      t.status
    FROM tasks t
    WHERE t.status = p_status
    ORDER BY t.created_at
  LOOP
    -- Check if this is a user story
    IF v_task_record.is_user_story THEN
      -- Count completed sub-tasks
      SELECT
        COUNT(CASE WHEN status = 'done' THEN 1 END),
        COUNT(*)
      INTO v_done_count, v_total_count
      FROM tasks
      WHERE user_story_id = v_task_record.id;

      -- Calculate completion percentage
      IF v_total_count > 0 THEN
        v_completion_pct := (v_done_count::NUMERIC / v_total_count::NUMERIC) * 100;
      ELSE
        v_completion_pct := 0;
      END IF;

      -- Preserve user stories with any completed work
      IF v_done_count > 0 THEN
        v_preserved_ids := array_append(v_preserved_ids, v_task_record.id);
        v_preserved_reasons := array_append(
          v_preserved_reasons,
          jsonb_build_object(
            'task_id', v_task_record.id,
            'title', v_task_record.title,
            'reason', 'User story has completed sub-tasks',
            'completion_percentage', v_completion_pct,
            'done_tasks', v_done_count,
            'total_tasks', v_total_count
          )
        );
        CONTINUE;
      END IF;
    END IF;

    -- Check if this task is referenced by other tasks as a dependency
    IF EXISTS (
      SELECT 1 FROM task_dependencies
      WHERE depends_on_task_id = v_task_record.id
    ) THEN
      v_preserved_ids := array_append(v_preserved_ids, v_task_record.id);
      v_preserved_reasons := array_append(
        v_preserved_reasons,
        jsonb_build_object(
          'task_id', v_task_record.id,
          'title', v_task_record.title,
          'reason', 'Other tasks depend on this task'
        )
      );
      CONTINUE;
    END IF;

    -- Safe to delete
    v_deleted_ids := array_append(v_deleted_ids, v_task_record.id);
  END LOOP;

  -- Perform actual deletion
  DELETE FROM tasks WHERE id = ANY(v_deleted_ids);

  -- Return report
  RETURN QUERY SELECT
    array_length(v_deleted_ids, 1)::INTEGER AS deleted_count,
    array_length(v_preserved_ids, 1)::INTEGER AS preserved_count,
    v_deleted_ids AS deleted_task_ids,
    v_preserved_ids AS preserved_task_ids,
    v_preserved_reasons AS preserved_reasons;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS AND DOCUMENTATION
-- ============================================

COMMENT ON FUNCTION auto_update_user_story_status() IS
'Automatically updates user story status based on sub-task completion. Triggered on sub-task INSERT, UPDATE, DELETE.';

COMMENT ON VIEW user_stories_health IS
'Health monitoring view showing user story status vs. suggested status based on sub-task completion. Includes safety flags for deletion.';

COMMENT ON FUNCTION safe_delete_tasks_by_status(TEXT) IS
'Safely deletes tasks by status while preserving user stories with completed work and tasks with dependencies. Returns detailed report.';

-- ============================================
-- CREATE INDEX for performance
-- ============================================

-- Index for faster user story sub-task queries
CREATE INDEX IF NOT EXISTS idx_tasks_user_story_status
  ON tasks(user_story_id, status)
  WHERE user_story_id IS NOT NULL;
