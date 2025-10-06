-- Migration 017: Change user story "Done" status threshold from 80% to 100%
-- This ensures a user story is only marked as "Done" when ALL tasks are completed

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
  -- Get the user story ID from the task
  v_user_story_id := COALESCE(NEW.user_story_id, OLD.user_story_id);

  -- If no user story, exit
  IF v_user_story_id IS NULL THEN
    RETURN NEW;
  END IF;

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
  -- CHANGED: Now requires 100% completion for 'done' (was >= 80)
  IF v_completion_percentage = 100 THEN
    v_new_status := 'done';
  ELSIF v_in_progress_tasks > 0 OR v_done_tasks > 0 THEN
    v_new_status := 'in_progress';
  ELSIF v_todo_tasks > 0 THEN
    v_new_status := 'todo';
  ELSIF v_backlog_tasks = v_total_tasks THEN
    v_new_status := 'backlog';
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

-- Force recalculation of all existing user story statuses with new 100% threshold
UPDATE tasks us
SET status = (
  CASE
    -- No subtasks: keep current status
    WHEN (SELECT COUNT(*) FROM tasks t WHERE t.user_story_id = us.id) = 0 THEN us.status
    -- 100% completion: mark as done
    WHEN (
      SELECT (COUNT(CASE WHEN t.status = 'done' THEN 1 END)::NUMERIC /
              NULLIF(COUNT(*)::NUMERIC, 0)) * 100
      FROM tasks t
      WHERE t.user_story_id = us.id
    ) = 100 THEN 'done'
    -- At least 1 task in progress or done: mark in_progress
    WHEN (
      SELECT COUNT(*) FROM tasks t
      WHERE t.user_story_id = us.id AND (t.status = 'in_progress' OR t.status = 'done')
    ) > 0 THEN 'in_progress'
    -- At least 1 task in todo: mark todo
    WHEN (
      SELECT COUNT(*) FROM tasks t
      WHERE t.user_story_id = us.id AND t.status = 'todo'
    ) > 0 THEN 'todo'
    -- All tasks in backlog: mark backlog
    WHEN (
      SELECT COUNT(*) FROM tasks t
      WHERE t.user_story_id = us.id AND t.status = 'backlog'
    ) = (
      SELECT COUNT(*) FROM tasks t WHERE t.user_story_id = us.id
    ) THEN 'backlog'
    ELSE 'todo'
  END
),
updated_at = NOW()
WHERE us.is_user_story = TRUE;

-- Verify the changes
DO $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_updated_count
  FROM tasks
  WHERE is_user_story = TRUE
    AND updated_at >= NOW() - INTERVAL '1 minute';

  RAISE NOTICE 'Migration 017 complete: Updated % user stories to use 100%% completion threshold', v_updated_count;
END $$;
