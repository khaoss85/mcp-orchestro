-- Migration 018: Allow manual user story status control
-- This permits user stories to be manually set to "todo" even when all tasks are in backlog
-- The trigger will only AUTO-UPDATE when task status changes justify it

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
  v_current_status TEXT;
BEGIN
  -- Get the user story ID from the task
  v_user_story_id := COALESCE(NEW.user_story_id, OLD.user_story_id);

  -- If no user story, exit
  IF v_user_story_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get current user story status
  SELECT status INTO v_current_status
  FROM tasks
  WHERE id = v_user_story_id;

  -- Count tasks by status
  SELECT
    COUNT(*) AS total,
    COUNT(CASE WHEN status = 'done' THEN 1 END) AS done,
    COUNT(CASE WHEN status = 'in_progress' THEN 1 END) AS in_progress,
    COUNT(CASE WHEN status = 'todo' THEN 1 END) AS todo,
    COUNT(CASE WHEN status = 'backlog' THEN 1 END) AS backlog
  INTO v_total_tasks, v_done_tasks, v_in_progress_tasks, v_todo_tasks, v_backlog_tasks
  FROM tasks
  WHERE user_story_id = v_user_story_id;

  -- If no tasks, don't update status
  IF v_total_tasks = 0 THEN
    RETURN NEW;
  END IF;

  -- Calculate completion percentage
  v_completion_percentage := (v_done_tasks::NUMERIC / v_total_tasks::NUMERIC) * 100;

  -- Determine new status based on task states
  -- CHANGED: Allow manual "todo" status even when all tasks are in backlog
  IF v_completion_percentage = 100 THEN
    -- Force to "done" when 100% complete
    v_new_status := 'done';
  ELSIF v_in_progress_tasks > 0 OR v_done_tasks > 0 THEN
    -- Force to "in_progress" when work has started
    v_new_status := 'in_progress';
  ELSIF v_todo_tasks > 0 THEN
    -- Force to "todo" when at least 1 task is todo
    v_new_status := 'todo';
  ELSIF v_backlog_tasks = v_total_tasks THEN
    -- CHANGED: Only auto-update to "backlog" if current status is also "backlog"
    -- This allows manual setting to "todo" to persist
    IF v_current_status = 'backlog' THEN
      v_new_status := 'backlog';
    ELSE
      -- Keep current status (allows manual "todo")
      v_new_status := v_current_status;
    END IF;
  ELSE
    v_new_status := 'todo';
  END IF;

  -- Update user story status if changed
  UPDATE tasks
  SET
    status = v_new_status,
    updated_at = NOW()
  WHERE id = v_user_story_id
    AND status != v_new_status;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Verify the function was updated
DO $$
BEGIN
  RAISE NOTICE 'Migration 018 complete: User stories can now be manually set to "todo" even with all tasks in backlog';
END $$;
