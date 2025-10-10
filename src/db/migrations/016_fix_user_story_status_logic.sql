-- Migration: 016_fix_user_story_status_logic
-- Purpose: Fix auto_update_user_story_status logic for in_progress detection
-- Bug: User stories with done tasks but no in_progress tasks stay in 'todo' status
-- Fix: Add v_done_tasks > 0 condition to trigger in_progress status

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
  -- FIXED: Added v_done_tasks > 0 condition for in_progress
  IF v_completion_percentage >= 80 THEN
    v_new_status := 'done';
  ELSIF v_in_progress_tasks > 0 OR v_done_tasks > 0 THEN
    -- in_progress: at least one in_progress OR at least one done
    v_new_status := 'in_progress';
  ELSIF v_todo_tasks > 0 THEN
    -- todo: at least one todo (but no in_progress and no done)
    v_new_status := 'todo';
  ELSIF v_backlog_tasks = v_total_tasks THEN
    -- backlog: ALL tasks in backlog
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
    AND status != v_new_status;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Force update of existing user stories with incorrect status
UPDATE tasks us
SET status = (
  CASE
    -- Skip user stories with no subtasks
    WHEN (SELECT COUNT(*) FROM tasks t WHERE t.user_story_id = us.id) = 0 THEN us.status
    -- >= 80% completion -> done
    WHEN (
      SELECT (COUNT(CASE WHEN t.status = 'done' THEN 1 END)::NUMERIC / NULLIF(COUNT(*)::NUMERIC, 0)) * 100
      FROM tasks t
      WHERE t.user_story_id = us.id
    ) >= 80 THEN 'done'
    -- At least one in_progress or done -> in_progress
    WHEN (
      SELECT COUNT(*) FROM tasks t
      WHERE t.user_story_id = us.id AND (t.status = 'in_progress' OR t.status = 'done')
    ) > 0 THEN 'in_progress'
    -- At least one todo -> todo
    WHEN (
      SELECT COUNT(*) FROM tasks t
      WHERE t.user_story_id = us.id AND t.status = 'todo'
    ) > 0 THEN 'todo'
    -- All tasks in backlog -> backlog
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
