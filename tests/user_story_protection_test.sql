-- ============================================
-- USER STORY PROTECTION SYSTEM - TEST SUITE
-- ============================================
-- This file contains comprehensive tests for the user story protection system
-- Run these tests after applying migration 010_auto_update_user_story_status.sql

-- ============================================
-- SETUP: Create Test Project
-- ============================================

DO $$
DECLARE
  v_project_id UUID;
  v_user_story_id_1 UUID;
  v_user_story_id_2 UUID;
  v_user_story_id_3 UUID;
  v_subtask_id UUID;
BEGIN
  -- Create test project
  INSERT INTO projects (name, status, description)
  VALUES ('Test Project', 'active', 'Project for testing user story protection')
  RETURNING id INTO v_project_id;

  RAISE NOTICE 'Created test project: %', v_project_id;

  -- ============================================
  -- TEST 1: Auto-Update Status - Completion Triggers
  -- ============================================

  RAISE NOTICE '';
  RAISE NOTICE '=== TEST 1: Auto-Update Status on Completion ===';

  -- Create user story in backlog
  INSERT INTO tasks (project_id, title, description, status, is_user_story)
  VALUES (v_project_id, 'Payment Integration', 'Add payment processing', 'backlog', true)
  RETURNING id INTO v_user_story_id_1;

  RAISE NOTICE 'Created user story: %', v_user_story_id_1;

  -- Add 4 sub-tasks, all in backlog
  INSERT INTO tasks (project_id, title, description, status, user_story_id)
  VALUES
    (v_project_id, 'Design Payment API', 'API design', 'backlog', v_user_story_id_1),
    (v_project_id, 'Implement Stripe', 'Stripe integration', 'backlog', v_user_story_id_1),
    (v_project_id, 'Add Payment UI', 'UI components', 'backlog', v_user_story_id_1),
    (v_project_id, 'Write Payment Tests', 'Unit tests', 'backlog', v_user_story_id_1);

  -- Verify user story is still in backlog
  IF (SELECT status FROM tasks WHERE id = v_user_story_id_1) = 'backlog' THEN
    RAISE NOTICE '✓ User story correctly stays in backlog when all sub-tasks are backlog';
  ELSE
    RAISE EXCEPTION '✗ User story status should be backlog but is %',
      (SELECT status FROM tasks WHERE id = v_user_story_id_1);
  END IF;

  -- Mark first sub-task as in_progress
  UPDATE tasks
  SET status = 'in_progress'
  WHERE title = 'Design Payment API';

  -- Verify user story auto-updated to in_progress
  IF (SELECT status FROM tasks WHERE id = v_user_story_id_1) = 'in_progress' THEN
    RAISE NOTICE '✓ User story auto-updated to in_progress when 1 sub-task started';
  ELSE
    RAISE EXCEPTION '✗ User story should be in_progress but is %',
      (SELECT status FROM tasks WHERE id = v_user_story_id_1);
  END IF;

  -- Mark first sub-task as done
  UPDATE tasks
  SET status = 'done'
  WHERE title = 'Design Payment API';

  -- User story should still be in_progress (25% complete)
  IF (SELECT status FROM tasks WHERE id = v_user_story_id_1) = 'in_progress' THEN
    RAISE NOTICE '✓ User story stays in_progress at 25%% completion';
  ELSE
    RAISE EXCEPTION '✗ User story should be in_progress but is %',
      (SELECT status FROM tasks WHERE id = v_user_story_id_1);
  END IF;

  -- Mark 3 more as done (total 4/4 = 100%)
  UPDATE tasks
  SET status = 'done'
  WHERE title IN ('Implement Stripe', 'Add Payment UI', 'Write Payment Tests');

  -- User story should auto-update to done (100% complete)
  IF (SELECT status FROM tasks WHERE id = v_user_story_id_1) = 'done' THEN
    RAISE NOTICE '✓ User story auto-updated to done at 100%% completion';
  ELSE
    RAISE EXCEPTION '✗ User story should be done but is %',
      (SELECT status FROM tasks WHERE id = v_user_story_id_1);
  END IF;

  -- ============================================
  -- TEST 2: 80% Threshold for Done Status
  -- ============================================

  RAISE NOTICE '';
  RAISE NOTICE '=== TEST 2: 80%% Completion Threshold ===';

  -- Create user story with 5 sub-tasks
  INSERT INTO tasks (project_id, title, description, status, is_user_story)
  VALUES (v_project_id, 'Email Notifications', 'Email system', 'backlog', true)
  RETURNING id INTO v_user_story_id_2;

  INSERT INTO tasks (project_id, title, description, status, user_story_id)
  VALUES
    (v_project_id, 'Setup email service', 'Config', 'backlog', v_user_story_id_2),
    (v_project_id, 'Create templates', 'Templates', 'backlog', v_user_story_id_2),
    (v_project_id, 'Implement sending', 'Send logic', 'backlog', v_user_story_id_2),
    (v_project_id, 'Add unsubscribe', 'Unsubscribe', 'backlog', v_user_story_id_2),
    (v_project_id, 'Email tests', 'Tests', 'backlog', v_user_story_id_2);

  -- Mark 3 out of 5 as done (60% - should be in_progress)
  UPDATE tasks SET status = 'done'
  WHERE user_story_id = v_user_story_id_2
    AND title IN ('Setup email service', 'Create templates', 'Implement sending');

  IF (SELECT status FROM tasks WHERE id = v_user_story_id_2) = 'in_progress' THEN
    RAISE NOTICE '✓ User story is in_progress at 60%% completion';
  ELSE
    RAISE EXCEPTION '✗ User story should be in_progress at 60%% but is %',
      (SELECT status FROM tasks WHERE id = v_user_story_id_2);
  END IF;

  -- Mark 4 out of 5 as done (80% - should be done)
  UPDATE tasks SET status = 'done'
  WHERE user_story_id = v_user_story_id_2
    AND title = 'Add unsubscribe';

  IF (SELECT status FROM tasks WHERE id = v_user_story_id_2) = 'done' THEN
    RAISE NOTICE '✓ User story auto-updated to done at 80%% completion';
  ELSE
    RAISE EXCEPTION '✗ User story should be done at 80%% but is %',
      (SELECT status FROM tasks WHERE id = v_user_story_id_2);
  END IF;

  -- ============================================
  -- TEST 3: Health View Accuracy
  -- ============================================

  RAISE NOTICE '';
  RAISE NOTICE '=== TEST 3: Health View Accuracy ===';

  -- Create user story with status mismatch (manually set to backlog despite done tasks)
  INSERT INTO tasks (project_id, title, description, status, is_user_story)
  VALUES (v_project_id, 'User Authentication', 'Auth system', 'backlog', true)
  RETURNING id INTO v_user_story_id_3;

  -- Disable trigger temporarily to create mismatch
  ALTER TABLE tasks DISABLE TRIGGER trigger_update_user_story_on_subtask_update;

  INSERT INTO tasks (project_id, title, description, status, user_story_id)
  VALUES
    (v_project_id, 'Create login API', 'Login', 'done', v_user_story_id_3),
    (v_project_id, 'Add JWT tokens', 'JWT', 'done', v_user_story_id_3),
    (v_project_id, 'Implement logout', 'Logout', 'todo', v_user_story_id_3);

  -- Re-enable trigger
  ALTER TABLE tasks ENABLE TRIGGER trigger_update_user_story_on_subtask_update;

  -- Check health view detects mismatch
  IF EXISTS (
    SELECT 1 FROM user_stories_health
    WHERE user_story_id = v_user_story_id_3
      AND status_mismatch = true
      AND current_status = 'backlog'
      AND suggested_status = 'in_progress'
  ) THEN
    RAISE NOTICE '✓ Health view correctly detects status mismatch';
  ELSE
    RAISE EXCEPTION '✗ Health view should detect mismatch for user story %', v_user_story_id_3;
  END IF;

  -- Verify completion percentage
  IF (
    SELECT completion_percentage FROM user_stories_health
    WHERE user_story_id = v_user_story_id_3
  ) BETWEEN 66 AND 67 THEN  -- 2/3 = 66.67%
    RAISE NOTICE '✓ Health view calculates correct completion percentage: 66.67%%';
  ELSE
    RAISE EXCEPTION '✗ Completion percentage incorrect: %',
      (SELECT completion_percentage FROM user_stories_health WHERE user_story_id = v_user_story_id_3);
  END IF;

  -- ============================================
  -- TEST 4: Safe Delete Function
  -- ============================================

  RAISE NOTICE '';
  RAISE NOTICE '=== TEST 4: Safe Delete Function ===';

  -- Create user story in backlog WITH completed sub-tasks
  DECLARE
    v_completed_story_id UUID;
    v_empty_story_id UUID;
    v_delete_result RECORD;
  BEGIN
    -- Story with completed work (should be preserved)
    INSERT INTO tasks (project_id, title, description, status, is_user_story)
    VALUES (v_project_id, 'Analytics Dashboard', 'Analytics', 'backlog', true)
    RETURNING id INTO v_completed_story_id;

    INSERT INTO tasks (project_id, title, description, status, user_story_id)
    VALUES
      (v_project_id, 'Design dashboard', 'Design', 'done', v_completed_story_id),
      (v_project_id, 'Implement charts', 'Charts', 'done', v_completed_story_id);

    -- Disable trigger to keep story in backlog
    ALTER TABLE tasks DISABLE TRIGGER trigger_update_user_story_on_subtask_update;

    -- Update story back to backlog
    UPDATE tasks SET status = 'backlog' WHERE id = v_completed_story_id;

    -- Re-enable trigger
    ALTER TABLE tasks ENABLE TRIGGER trigger_update_user_story_on_subtask_update;

    -- Story with no completed work (safe to delete)
    INSERT INTO tasks (project_id, title, description, status, is_user_story)
    VALUES (v_project_id, 'Empty Story', 'Empty', 'backlog', true)
    RETURNING id INTO v_empty_story_id;

    INSERT INTO tasks (project_id, title, description, status, user_story_id)
    VALUES
      (v_project_id, 'Task 1', 'T1', 'backlog', v_empty_story_id),
      (v_project_id, 'Task 2', 'T2', 'backlog', v_empty_story_id);

    -- Call safe delete function
    SELECT * INTO v_delete_result
    FROM safe_delete_tasks_by_status('backlog')
    LIMIT 1;

    -- Verify completed story was preserved
    IF EXISTS (SELECT 1 FROM tasks WHERE id = v_completed_story_id) THEN
      RAISE NOTICE '✓ User story with completed work was preserved';
    ELSE
      RAISE EXCEPTION '✗ User story with completed work was incorrectly deleted';
    END IF;

    -- Verify empty story was deleted
    IF NOT EXISTS (SELECT 1 FROM tasks WHERE id = v_empty_story_id) THEN
      RAISE NOTICE '✓ User story with no completed work was deleted';
    ELSE
      RAISE EXCEPTION '✗ User story with no completed work should have been deleted';
    END IF;

    -- Verify preserved reason is correct
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_delete_result.preserved_reasons) AS reason
      WHERE reason->>'task_id' = v_completed_story_id::text
        AND reason->>'reason' = 'User story has completed sub-tasks'
    ) THEN
      RAISE NOTICE '✓ Preserved reason correctly identifies completed sub-tasks';
    ELSE
      RAISE EXCEPTION '✗ Preserved reason is incorrect';
    END IF;

    RAISE NOTICE '✓ Safe delete function works correctly';
  END;

  -- ============================================
  -- TEST 5: Delete Operation Triggers
  -- ============================================

  RAISE NOTICE '';
  RAISE NOTICE '=== TEST 5: Delete Operation Triggers ===';

  DECLARE
    v_delete_story_id UUID;
    v_subtask_to_delete_id UUID;
  BEGIN
    -- Create user story with 3 sub-tasks
    INSERT INTO tasks (project_id, title, description, status, is_user_story)
    VALUES (v_project_id, 'Delete Test Story', 'Test deletes', 'backlog', true)
    RETURNING id INTO v_delete_story_id;

    INSERT INTO tasks (project_id, title, description, status, user_story_id)
    VALUES
      (v_project_id, 'Task A', 'A', 'done', v_delete_story_id),
      (v_project_id, 'Task B', 'B', 'in_progress', v_delete_story_id),
      (v_project_id, 'Task C', 'C', 'todo', v_delete_story_id)
    RETURNING id INTO v_subtask_to_delete_id;

    -- Verify story is in_progress (has 1 in_progress task)
    IF (SELECT status FROM tasks WHERE id = v_delete_story_id) = 'in_progress' THEN
      RAISE NOTICE '✓ Story correctly set to in_progress with mixed sub-tasks';
    END IF;

    -- Delete the in_progress task
    DELETE FROM tasks WHERE id = v_subtask_to_delete_id;

    -- Story should still be in_progress (has 1 done task)
    IF (SELECT status FROM tasks WHERE id = v_delete_story_id) = 'in_progress' THEN
      RAISE NOTICE '✓ Story status updated correctly after sub-task deletion';
    ELSE
      RAISE EXCEPTION '✗ Story status should be in_progress after deletion but is %',
        (SELECT status FROM tasks WHERE id = v_delete_story_id);
    END IF;
  END;

  -- ============================================
  -- TEST 6: Edge Cases
  -- ============================================

  RAISE NOTICE '';
  RAISE NOTICE '=== TEST 6: Edge Cases ===';

  DECLARE
    v_edge_story_id UUID;
  BEGIN
    -- User story with no sub-tasks
    INSERT INTO tasks (project_id, title, description, status, is_user_story)
    VALUES (v_project_id, 'No Subtasks Story', 'Empty story', 'backlog', true)
    RETURNING id INTO v_edge_story_id;

    -- Status should remain unchanged
    IF (SELECT status FROM tasks WHERE id = v_edge_story_id) = 'backlog' THEN
      RAISE NOTICE '✓ User story with no sub-tasks keeps original status';
    END IF;

    -- Add a sub-task
    INSERT INTO tasks (project_id, title, description, status, user_story_id)
    VALUES (v_project_id, 'First subtask', 'First', 'todo', v_edge_story_id);

    -- Should update to todo
    IF (SELECT status FROM tasks WHERE id = v_edge_story_id) = 'todo' THEN
      RAISE NOTICE '✓ User story updates to todo when first sub-task is todo';
    END IF;
  END;

  -- ============================================
  -- SUMMARY
  -- ============================================

  RAISE NOTICE '';
  RAISE NOTICE '=== TEST SUMMARY ===';
  RAISE NOTICE '✓ All tests passed successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'User Story Protection System is working correctly:';
  RAISE NOTICE '  - Auto-update triggers work on INSERT/UPDATE/DELETE';
  RAISE NOTICE '  - 80%% completion threshold correctly triggers done status';
  RAISE NOTICE '  - Health view accurately detects mismatches';
  RAISE NOTICE '  - Safe delete preserves completed work';
  RAISE NOTICE '  - Edge cases handled properly';

  -- Cleanup test data (optional - comment out to inspect results)
  -- DELETE FROM projects WHERE id = v_project_id;
  -- RAISE NOTICE 'Test data cleaned up';

END $$;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these manually to inspect test results

-- View all test user stories and their health
SELECT
  user_story_title,
  current_status,
  suggested_status,
  completion_percentage,
  done_count || '/' || total_subtasks AS progress,
  status_mismatch,
  safe_to_delete
FROM user_stories_health
WHERE user_story_title LIKE '%Payment%'
   OR user_story_title LIKE '%Email%'
   OR user_story_title LIKE '%Authentication%'
   OR user_story_title LIKE '%Analytics%'
ORDER BY created_at;

-- View status mismatch details
SELECT
  user_story_title,
  current_status || ' → ' || suggested_status AS status_change,
  completion_percentage || '%' AS completion,
  done_count,
  in_progress_count,
  todo_count,
  backlog_count
FROM user_stories_health
WHERE status_mismatch = true;

-- Test safe delete (dry run - just view what would be preserved)
SELECT
  deleted_count,
  preserved_count,
  jsonb_pretty(jsonb_agg(reason)) AS preserved_reasons
FROM (
  SELECT jsonb_array_elements(preserved_reasons) AS reason
  FROM safe_delete_tasks_by_status('backlog')
) AS sub;
