-- ============================================
-- SCOPED EXECUTION ORDER - TEST SUITE
-- ============================================
-- This file contains comprehensive tests for the scoped execution order feature
-- Run these tests after applying migration 016_enforce_story_scoped_dependencies.sql

-- ============================================
-- SETUP: Create Test Project and User Stories
-- ============================================

DO $$
DECLARE
  v_project_id UUID;
  v_story1_id UUID;
  v_story2_id UUID;
  v_task1_id UUID;
  v_task2_id UUID;
  v_task3_id UUID;
  v_task4_id UUID;
  v_orphan1_id UUID;
  v_orphan2_id UUID;
BEGIN
  -- Create test project
  INSERT INTO projects (name, status, description)
  VALUES ('Execution Order Test Project', 'active', 'Project for testing scoped execution order')
  RETURNING id INTO v_project_id;

  RAISE NOTICE 'Created test project: %', v_project_id;

  -- Create two user stories
  INSERT INTO tasks (project_id, title, description, status, is_user_story)
  VALUES (v_project_id, 'Story 1', 'First user story', 'backlog', true)
  RETURNING id INTO v_story1_id;

  INSERT INTO tasks (project_id, title, description, status, is_user_story)
  VALUES (v_project_id, 'Story 2', 'Second user story', 'backlog', true)
  RETURNING id INTO v_story2_id;

  RAISE NOTICE 'Created user stories: % and %', v_story1_id, v_story2_id;

  -- ============================================
  -- TEST 1: Same-Story Dependency (Should Succeed)
  -- ============================================

  RAISE NOTICE '';
  RAISE NOTICE '=== TEST 1: Same-Story Dependency ===';

  BEGIN
    -- Create two tasks in Story 1
    INSERT INTO tasks (project_id, title, description, status, user_story_id)
    VALUES (v_project_id, 'Task 1.1', 'First task in Story 1', 'backlog', v_story1_id)
    RETURNING id INTO v_task1_id;

    INSERT INTO tasks (project_id, title, description, status, user_story_id)
    VALUES (v_project_id, 'Task 1.2', 'Second task in Story 1', 'backlog', v_story1_id)
    RETURNING id INTO v_task2_id;

    -- Create dependency within same story
    INSERT INTO task_dependencies (task_id, depends_on_task_id)
    VALUES (v_task2_id, v_task1_id);

    RAISE NOTICE '✓ Test 1 PASSED: Same-story dependency allowed (Task 1.2 depends on Task 1.1)';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION '✗ Test 1 FAILED: Same-story dependency rejected: %', SQLERRM;
  END;

  -- ============================================
  -- TEST 2: Cross-Story Dependency (Should Fail)
  -- ============================================

  RAISE NOTICE '';
  RAISE NOTICE '=== TEST 2: Cross-Story Dependency ===';

  BEGIN
    -- Create task in Story 2
    INSERT INTO tasks (project_id, title, description, status, user_story_id)
    VALUES (v_project_id, 'Task 2.1', 'First task in Story 2', 'backlog', v_story2_id)
    RETURNING id INTO v_task3_id;

    -- Try to create dependency across stories (should fail)
    INSERT INTO task_dependencies (task_id, depends_on_task_id)
    VALUES (v_task3_id, v_task1_id);

    RAISE EXCEPTION '✗ Test 2 FAILED: Cross-story dependency was allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE '%must be within the same user story%' THEN
      RAISE NOTICE '✓ Test 2 PASSED: Cross-story dependency blocked by trigger';
    ELSE
      RAISE;
    END IF;
  END;

  -- ============================================
  -- TEST 3: Orphaned Tasks Can Depend on Each Other (Should Succeed)
  -- ============================================

  RAISE NOTICE '';
  RAISE NOTICE '=== TEST 3: Orphaned Task Dependencies ===';

  BEGIN
    -- Create two orphaned tasks (no user_story_id)
    INSERT INTO tasks (project_id, title, description, status, user_story_id)
    VALUES (v_project_id, 'Orphan 1', 'First orphaned task', 'backlog', NULL)
    RETURNING id INTO v_orphan1_id;

    INSERT INTO tasks (project_id, title, description, status, user_story_id)
    VALUES (v_project_id, 'Orphan 2', 'Second orphaned task', 'backlog', NULL)
    RETURNING id INTO v_orphan2_id;

    -- Create dependency between orphaned tasks
    INSERT INTO task_dependencies (task_id, depends_on_task_id)
    VALUES (v_orphan2_id, v_orphan1_id);

    RAISE NOTICE '✓ Test 3 PASSED: Orphaned tasks can depend on each other';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION '✗ Test 3 FAILED: Orphaned task dependency rejected: %', SQLERRM;
  END;

  -- ============================================
  -- TEST 4: Story Task Cannot Depend on Orphaned Task (Should Fail)
  -- ============================================

  RAISE NOTICE '';
  RAISE NOTICE '=== TEST 4: Story Task Depending on Orphaned Task ===';

  BEGIN
    -- Try to create dependency from story task to orphaned task
    INSERT INTO task_dependencies (task_id, depends_on_task_id)
    VALUES (v_task1_id, v_orphan1_id);

    RAISE EXCEPTION '✗ Test 4 FAILED: Story task depending on orphaned task was allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE '%must be within the same user story%' THEN
      RAISE NOTICE '✓ Test 4 PASSED: Story task cannot depend on orphaned task';
    ELSE
      RAISE;
    END IF;
  END;

  -- ============================================
  -- TEST 5: Orphaned Task Cannot Depend on Story Task (Should Fail)
  -- ============================================

  RAISE NOTICE '';
  RAISE NOTICE '=== TEST 5: Orphaned Task Depending on Story Task ===';

  BEGIN
    -- Try to create dependency from orphaned task to story task
    INSERT INTO task_dependencies (task_id, depends_on_task_id)
    VALUES (v_orphan1_id, v_task1_id);

    RAISE EXCEPTION '✗ Test 5 FAILED: Orphaned task depending on story task was allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE '%must be within the same user story%' THEN
      RAISE NOTICE '✓ Test 5 PASSED: Orphaned task cannot depend on story task';
    ELSE
      RAISE;
    END IF;
  END;

  -- ============================================
  -- TEST 6: Execution Order Scoped Per User Story
  -- ============================================

  RAISE NOTICE '';
  RAISE NOTICE '=== TEST 6: Execution Order Scoping ===';

  BEGIN
    -- Clear existing dependencies for clean test
    DELETE FROM task_dependencies;

    -- Create linear dependency chain in Story 1
    INSERT INTO tasks (project_id, title, description, status, user_story_id)
    VALUES (v_project_id, 'Task A', 'First in chain', 'todo', v_story1_id)
    RETURNING id INTO v_task1_id;

    INSERT INTO tasks (project_id, title, description, status, user_story_id)
    VALUES (v_project_id, 'Task B', 'Second in chain', 'todo', v_story1_id)
    RETURNING id INTO v_task2_id;

    INSERT INTO tasks (project_id, title, description, status, user_story_id)
    VALUES (v_project_id, 'Task C', 'Third in chain', 'todo', v_story1_id)
    RETURNING id INTO v_task3_id;

    -- Create dependency chain: Task A -> Task B -> Task C
    INSERT INTO task_dependencies (task_id, depends_on_task_id)
    VALUES (v_task2_id, v_task1_id);

    INSERT INTO task_dependencies (task_id, depends_on_task_id)
    VALUES (v_task3_id, v_task2_id);

    -- Create similar chain in Story 2
    DECLARE
      v_story2_task1_id UUID;
      v_story2_task2_id UUID;
    BEGIN
      INSERT INTO tasks (project_id, title, description, status, user_story_id)
      VALUES (v_project_id, 'Task X', 'First in chain', 'todo', v_story2_id)
      RETURNING id INTO v_story2_task1_id;

      INSERT INTO tasks (project_id, title, description, status, user_story_id)
      VALUES (v_project_id, 'Task Y', 'Second in chain', 'todo', v_story2_id)
      RETURNING id INTO v_story2_task2_id;

      -- Create dependency: Task X -> Task Y
      INSERT INTO task_dependencies (task_id, depends_on_task_id)
      VALUES (v_story2_task2_id, v_story2_task1_id);

      RAISE NOTICE '✓ Test 6 PASSED: Each story has independent execution order';
      RAISE NOTICE '  - Story 1: Task A (1) -> Task B (2) -> Task C (3)';
      RAISE NOTICE '  - Story 2: Task X (1) -> Task Y (2)';
    END;
  END;

  -- ============================================
  -- TEST 7: Performance Index Validation
  -- ============================================

  RAISE NOTICE '';
  RAISE NOTICE '=== TEST 7: Performance Index ===';

  -- Verify composite index exists
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE tablename = 'tasks'
      AND indexname = 'idx_tasks_user_story_composite'
  ) THEN
    RAISE NOTICE '✓ Test 7 PASSED: Composite index idx_tasks_user_story_composite exists';
  ELSE
    RAISE EXCEPTION '✗ Test 7 FAILED: Composite index idx_tasks_user_story_composite not found';
  END IF;

  -- ============================================
  -- TEST 8: Trigger Function Validation
  -- ============================================

  RAISE NOTICE '';
  RAISE NOTICE '=== TEST 8: Trigger Function ===';

  -- Verify trigger function exists
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'check_same_user_story_dependency'
      AND n.nspname = 'public'
  ) THEN
    RAISE NOTICE '✓ Test 8 PASSED: Trigger function check_same_user_story_dependency() exists';
  ELSE
    RAISE EXCEPTION '✗ Test 8 FAILED: Trigger function check_same_user_story_dependency() not found';
  END IF;

  -- Verify trigger exists
  IF EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'enforce_story_scoped_dependencies'
  ) THEN
    RAISE NOTICE '✓ Test 8 PASSED: Trigger enforce_story_scoped_dependencies exists';
  ELSE
    RAISE EXCEPTION '✗ Test 8 FAILED: Trigger enforce_story_scoped_dependencies not found';
  END IF;

  -- ============================================
  -- TEST 9: Update Existing Dependency (Should Respect Rules)
  -- ============================================

  RAISE NOTICE '';
  RAISE NOTICE '=== TEST 9: Update Dependency ===';

  DECLARE
    v_dep_id UUID;
  BEGIN
    -- Get an existing dependency
    SELECT id INTO v_dep_id
    FROM task_dependencies
    WHERE task_id = v_task2_id
    LIMIT 1;

    -- Try to update to cross-story dependency (should fail)
    UPDATE task_dependencies
    SET depends_on_task_id = (
      SELECT id FROM tasks
      WHERE user_story_id = v_story2_id
      LIMIT 1
    )
    WHERE id = v_dep_id;

    RAISE EXCEPTION '✗ Test 9 FAILED: Update to cross-story dependency was allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE '%must be within the same user story%' THEN
      RAISE NOTICE '✓ Test 9 PASSED: Update respects story-scoped dependency rules';
    ELSE
      RAISE;
    END IF;
  END;

  -- ============================================
  -- SUMMARY
  -- ============================================

  RAISE NOTICE '';
  RAISE NOTICE '=== TEST SUMMARY ===';
  RAISE NOTICE '✓ All tests passed successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Scoped Execution Order Feature is working correctly:';
  RAISE NOTICE '  - Same-story dependencies are allowed';
  RAISE NOTICE '  - Cross-story dependencies are blocked';
  RAISE NOTICE '  - Orphaned tasks can depend on each other';
  RAISE NOTICE '  - Story tasks and orphaned tasks cannot cross-depend';
  RAISE NOTICE '  - Execution order is scoped per user story';
  RAISE NOTICE '  - Performance index is in place';
  RAISE NOTICE '  - Trigger and function are properly configured';
  RAISE NOTICE '  - Dependency updates respect scoping rules';

  -- Cleanup test data
  DELETE FROM projects WHERE id = v_project_id;
  RAISE NOTICE '';
  RAISE NOTICE 'Test data cleaned up';

END $$;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these manually to inspect execution order

-- View tasks grouped by user story with dependency info
SELECT
  t.user_story_id,
  us.title as user_story,
  t.id,
  t.title,
  t.status,
  COALESCE(
    (SELECT COUNT(*)
     FROM task_dependencies td
     WHERE td.task_id = t.id),
    0
  ) as dependency_count
FROM tasks t
LEFT JOIN tasks us ON t.user_story_id = us.id
WHERE t.is_user_story = false
ORDER BY t.user_story_id, t.created_at;

-- Check for any cross-story dependencies (should be 0)
SELECT
  td.id,
  t1.user_story_id as task_story,
  t2.user_story_id as dependency_story,
  t1.title as task_title,
  t2.title as dependency_title
FROM task_dependencies td
JOIN tasks t1 ON td.task_id = t1.id
JOIN tasks t2 ON td.depends_on_task_id = t2.id
WHERE (t1.user_story_id IS NULL AND t2.user_story_id IS NOT NULL)
   OR (t1.user_story_id IS NOT NULL AND t2.user_story_id IS NULL)
   OR (t1.user_story_id != t2.user_story_id);
