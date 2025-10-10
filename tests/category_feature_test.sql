-- ============================================
-- CATEGORY FEATURE - TEST SUITE
-- ============================================
-- This file contains comprehensive tests for the task category feature
-- Run these tests after applying migration 013_add_task_category.sql

-- ============================================
-- SETUP: Create Test Project
-- ============================================

DO $$
DECLARE
  v_project_id UUID;
  v_task_id UUID;
  v_task_id_2 UUID;
  v_task_id_3 UUID;
BEGIN
  -- Create test project
  INSERT INTO projects (name, status, description)
  VALUES ('Category Test Project', 'active', 'Project for testing category feature')
  RETURNING id INTO v_project_id;

  RAISE NOTICE 'Created test project: %', v_project_id;

  -- ============================================
  -- TEST 1: Category ENUM Constraint
  -- ============================================

  RAISE NOTICE '';
  RAISE NOTICE '=== TEST 1: Category ENUM Constraint ===';

  -- Test valid category values
  BEGIN
    INSERT INTO tasks (project_id, title, description, status, category)
    VALUES
      (v_project_id, 'Frontend Task', 'Design work', 'todo', 'design_frontend')
    RETURNING id INTO v_task_id;

    RAISE NOTICE '✓ Valid category "design_frontend" accepted';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION '✗ Valid category "design_frontend" rejected: %', SQLERRM;
  END;

  BEGIN
    INSERT INTO tasks (project_id, title, description, status, category)
    VALUES
      (v_project_id, 'Backend Task', 'API work', 'todo', 'backend_database');

    RAISE NOTICE '✓ Valid category "backend_database" accepted';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION '✗ Valid category "backend_database" rejected: %', SQLERRM;
  END;

  BEGIN
    INSERT INTO tasks (project_id, title, description, status, category)
    VALUES
      (v_project_id, 'Test Task', 'Unit tests', 'todo', 'test_fix');

    RAISE NOTICE '✓ Valid category "test_fix" accepted';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION '✗ Valid category "test_fix" rejected: %', SQLERRM;
  END;

  -- Test invalid category value
  BEGIN
    INSERT INTO tasks (project_id, title, description, status, category)
    VALUES
      (v_project_id, 'Invalid Task', 'Invalid category', 'todo', 'invalid_category');

    RAISE EXCEPTION '✗ Invalid category "invalid_category" was accepted (should be rejected)';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE '✓ Invalid category "invalid_category" correctly rejected';
  END;

  -- Test NULL category (should be allowed for backward compatibility)
  BEGIN
    INSERT INTO tasks (project_id, title, description, status, category)
    VALUES
      (v_project_id, 'No Category Task', 'No category', 'todo', NULL)
    RETURNING id INTO v_task_id_2;

    RAISE NOTICE '✓ NULL category accepted for backward compatibility';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION '✗ NULL category rejected: %', SQLERRM;
  END;

  -- ============================================
  -- TEST 2: Category Updates
  -- ============================================

  RAISE NOTICE '';
  RAISE NOTICE '=== TEST 2: Category Updates ===';

  -- Update task to different category
  BEGIN
    UPDATE tasks
    SET category = 'backend_database'
    WHERE id = v_task_id;

    IF (SELECT category FROM tasks WHERE id = v_task_id) = 'backend_database' THEN
      RAISE NOTICE '✓ Category successfully updated from design_frontend to backend_database';
    ELSE
      RAISE EXCEPTION '✗ Category update failed';
    END IF;
  END;

  -- Update category to NULL
  BEGIN
    UPDATE tasks
    SET category = NULL
    WHERE id = v_task_id;

    IF (SELECT category FROM tasks WHERE id = v_task_id) IS NULL THEN
      RAISE NOTICE '✓ Category successfully updated to NULL';
    ELSE
      RAISE EXCEPTION '✗ Category update to NULL failed';
    END IF;
  END;

  -- Update NULL category to valid value
  BEGIN
    UPDATE tasks
    SET category = 'test_fix'
    WHERE id = v_task_id_2;

    IF (SELECT category FROM tasks WHERE id = v_task_id_2) = 'test_fix' THEN
      RAISE NOTICE '✓ NULL category successfully updated to test_fix';
    ELSE
      RAISE EXCEPTION '✗ NULL category update failed';
    END IF;
  END;

  -- ============================================
  -- TEST 3: Category Filtering
  -- ============================================

  RAISE NOTICE '';
  RAISE NOTICE '=== TEST 3: Category Filtering ===';

  -- Create tasks with different categories
  INSERT INTO tasks (project_id, title, description, status, category)
  VALUES
    (v_project_id, 'Design 1', 'UI design', 'todo', 'design_frontend'),
    (v_project_id, 'Design 2', 'UX design', 'todo', 'design_frontend'),
    (v_project_id, 'API 1', 'REST API', 'todo', 'backend_database'),
    (v_project_id, 'API 2', 'GraphQL API', 'todo', 'backend_database'),
    (v_project_id, 'Test 1', 'Unit tests', 'todo', 'test_fix'),
    (v_project_id, 'No Cat', 'Uncategorized', 'todo', NULL);

  -- Test single category filter
  DECLARE
    v_design_count INT;
    v_backend_count INT;
    v_test_count INT;
    v_null_count INT;
  BEGIN
    SELECT COUNT(*) INTO v_design_count
    FROM tasks
    WHERE project_id = v_project_id
      AND category = 'design_frontend';

    IF v_design_count = 3 THEN -- 1 from earlier test + 2 new
      RAISE NOTICE '✓ Category filter "design_frontend" returns correct count: %', v_design_count;
    ELSE
      RAISE EXCEPTION '✗ Category filter "design_frontend" incorrect count: % (expected 3)', v_design_count;
    END IF;

    SELECT COUNT(*) INTO v_backend_count
    FROM tasks
    WHERE project_id = v_project_id
      AND category = 'backend_database';

    IF v_backend_count = 3 THEN -- 1 from earlier test + 2 new
      RAISE NOTICE '✓ Category filter "backend_database" returns correct count: %', v_backend_count;
    ELSE
      RAISE EXCEPTION '✗ Category filter "backend_database" incorrect count: % (expected 3)', v_backend_count;
    END IF;

    SELECT COUNT(*) INTO v_test_count
    FROM tasks
    WHERE project_id = v_project_id
      AND category = 'test_fix';

    IF v_test_count = 2 THEN -- 1 from earlier test + 1 new
      RAISE NOTICE '✓ Category filter "test_fix" returns correct count: %', v_test_count;
    ELSE
      RAISE EXCEPTION '✗ Category filter "test_fix" incorrect count: % (expected 2)', v_test_count;
    END IF;

    -- Test NULL category filter
    SELECT COUNT(*) INTO v_null_count
    FROM tasks
    WHERE project_id = v_project_id
      AND category IS NULL;

    IF v_null_count = 2 THEN -- 1 from earlier test + 1 new
      RAISE NOTICE '✓ NULL category filter returns correct count: %', v_null_count;
    ELSE
      RAISE EXCEPTION '✗ NULL category filter incorrect count: % (expected 2)', v_null_count;
    END IF;
  END;

  -- ============================================
  -- TEST 4: Backward Compatibility with Test Filter
  -- ============================================

  RAISE NOTICE '';
  RAISE NOTICE '=== TEST 4: Backward Compatibility ===';

  -- Create task with test_fix category
  INSERT INTO tasks (project_id, title, description, status, category, tags)
  VALUES
    (v_project_id, 'Categorized Test', 'Has category', 'todo', 'test_fix', ARRAY['backend'])
  RETURNING id INTO v_task_id_3;

  -- Create task without category but with test tag
  INSERT INTO tasks (project_id, title, description, status, category, tags)
  VALUES
    (v_project_id, 'Tagged Test', 'Has tag', 'todo', NULL, ARRAY['test']);

  -- Create task without category but with "test" in title
  INSERT INTO tasks (project_id, title, description, status, category, tags)
  VALUES
    (v_project_id, 'Test in title', 'Title test', 'todo', NULL, ARRAY['backend']);

  DECLARE
    v_category_test_count INT;
    v_tag_test_count INT;
    v_title_test_count INT;
  BEGIN
    -- Tasks with test_fix category
    SELECT COUNT(*) INTO v_category_test_count
    FROM tasks
    WHERE project_id = v_project_id
      AND category = 'test_fix';

    -- Tasks with 'test' tag (backward compatibility)
    SELECT COUNT(*) INTO v_tag_test_count
    FROM tasks
    WHERE project_id = v_project_id
      AND 'test' = ANY(tags);

    -- Tasks with 'test' in title (backward compatibility)
    SELECT COUNT(*) INTO v_title_test_count
    FROM tasks
    WHERE project_id = v_project_id
      AND LOWER(title) LIKE '%test%';

    RAISE NOTICE '✓ Category-based test filter: % tasks', v_category_test_count;
    RAISE NOTICE '✓ Tag-based test filter (legacy): % tasks', v_tag_test_count;
    RAISE NOTICE '✓ Title-based test filter (legacy): % tasks', v_title_test_count;

    -- Combined filter should catch all test-related tasks
    DECLARE
      v_combined_count INT;
    BEGIN
      SELECT COUNT(*) INTO v_combined_count
      FROM tasks
      WHERE project_id = v_project_id
        AND (
          category = 'test_fix'
          OR 'test' = ANY(tags)
          OR LOWER(title) LIKE '%test%'
        );

      IF v_combined_count >= 3 THEN
        RAISE NOTICE '✓ Combined test filter (category + tag + title) finds % tasks', v_combined_count;
      ELSE
        RAISE EXCEPTION '✗ Combined test filter found only % tasks (expected at least 3)', v_combined_count;
      END IF;
    END;
  END;

  -- ============================================
  -- TEST 5: Index Performance
  -- ============================================

  RAISE NOTICE '';
  RAISE NOTICE '=== TEST 5: Index Performance ===';

  -- Verify index exists
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE tablename = 'tasks'
      AND indexname = 'idx_tasks_category'
  ) THEN
    RAISE NOTICE '✓ Index idx_tasks_category exists on tasks.category';
  ELSE
    RAISE EXCEPTION '✗ Index idx_tasks_category not found';
  END IF;

  -- Check index is being used (explain plan would show index scan)
  -- Note: This is a simple check. In production, use EXPLAIN ANALYZE
  DECLARE
    v_index_usage TEXT;
  BEGIN
    SELECT indexname INTO v_index_usage
    FROM pg_indexes
    WHERE tablename = 'tasks'
      AND indexname = 'idx_tasks_category';

    IF v_index_usage = 'idx_tasks_category' THEN
      RAISE NOTICE '✓ Index idx_tasks_category is available for queries';
    END IF;
  END;

  -- ============================================
  -- TEST 6: Category Migration Logic
  -- ============================================

  RAISE NOTICE '';
  RAISE NOTICE '=== TEST 6: Category Migration ===';

  -- Verify existing tasks without category can coexist with categorized tasks
  DECLARE
    v_total_tasks INT;
    v_categorized_tasks INT;
    v_uncategorized_tasks INT;
  BEGIN
    SELECT COUNT(*) INTO v_total_tasks
    FROM tasks
    WHERE project_id = v_project_id;

    SELECT COUNT(*) INTO v_categorized_tasks
    FROM tasks
    WHERE project_id = v_project_id
      AND category IS NOT NULL;

    SELECT COUNT(*) INTO v_uncategorized_tasks
    FROM tasks
    WHERE project_id = v_project_id
      AND category IS NULL;

    IF v_total_tasks = v_categorized_tasks + v_uncategorized_tasks THEN
      RAISE NOTICE '✓ Total tasks (%) = categorized (%) + uncategorized (%)',
        v_total_tasks, v_categorized_tasks, v_uncategorized_tasks;
    ELSE
      RAISE EXCEPTION '✗ Task count mismatch';
    END IF;

    RAISE NOTICE '✓ Migration allows gradual adoption: % categorized, % uncategorized',
      v_categorized_tasks, v_uncategorized_tasks;
  END;

  -- ============================================
  -- TEST 7: Multi-Category Filtering (OR logic)
  -- ============================================

  RAISE NOTICE '';
  RAISE NOTICE '=== TEST 7: Multi-Category Filtering ===';

  DECLARE
    v_multi_count INT;
  BEGIN
    -- Filter for design OR backend categories
    SELECT COUNT(*) INTO v_multi_count
    FROM tasks
    WHERE project_id = v_project_id
      AND category IN ('design_frontend', 'backend_database');

    IF v_multi_count = 6 THEN -- 3 design + 3 backend
      RAISE NOTICE '✓ Multi-category filter (design OR backend) returns % tasks', v_multi_count;
    ELSE
      RAISE EXCEPTION '✗ Multi-category filter incorrect count: % (expected 6)', v_multi_count;
    END IF;

    -- Filter for all categories
    SELECT COUNT(*) INTO v_multi_count
    FROM tasks
    WHERE project_id = v_project_id
      AND category IN ('design_frontend', 'backend_database', 'test_fix');

    RAISE NOTICE '✓ All categories filter returns % tasks', v_multi_count;
  END;

  -- ============================================
  -- SUMMARY
  -- ============================================

  RAISE NOTICE '';
  RAISE NOTICE '=== TEST SUMMARY ===';
  RAISE NOTICE '✓ All tests passed successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Category Feature is working correctly:';
  RAISE NOTICE '  - ENUM constraint enforces valid values';
  RAISE NOTICE '  - Category updates work correctly';
  RAISE NOTICE '  - Category filtering returns accurate results';
  RAISE NOTICE '  - Backward compatibility with test filter maintained';
  RAISE NOTICE '  - Index on category column exists';
  RAISE NOTICE '  - Migration allows gradual adoption';
  RAISE NOTICE '  - Multi-category filtering works correctly';

  -- Cleanup test data
  DELETE FROM projects WHERE id = v_project_id;
  RAISE NOTICE '';
  RAISE NOTICE 'Test data cleaned up';

END $$;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these manually to inspect category distribution

-- View category distribution
SELECT
  category,
  COUNT(*) as task_count
FROM tasks
GROUP BY category
ORDER BY task_count DESC;

-- View tasks by category with details
SELECT
  title,
  category,
  status,
  tags,
  created_at
FROM tasks
WHERE category IS NOT NULL
ORDER BY category, created_at DESC
LIMIT 20;

-- Find uncategorized tasks that might be test-related
SELECT
  id,
  title,
  tags,
  CASE
    WHEN 'test' = ANY(tags) THEN 'Has test tag'
    WHEN LOWER(title) LIKE '%test%' THEN 'Has test in title'
    ELSE 'Not test-related'
  END as test_indicator
FROM tasks
WHERE category IS NULL
ORDER BY test_indicator;
