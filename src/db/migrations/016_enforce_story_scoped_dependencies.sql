-- Migration: 016_enforce_story_scoped_dependencies
-- Purpose: Prevent cross-story task dependencies to maintain story isolation
-- Features:
--   1. Trigger-based validation to ensure dependencies are within the same user story
--   2. Composite index for performance optimization
--   3. Clear error messages for debugging

-- ============================================
-- FUNCTION: Check Same User Story Dependency
-- ============================================
-- This function validates that task dependencies are within the same user story
-- Validation logic:
--   - If both tasks have NULL user_story_id (orphaned tasks): ALLOW
--   - If both tasks have the same user_story_id: ALLOW
--   - If tasks have different user_story_id values: RAISE EXCEPTION
--   - If one task has user_story_id and the other is NULL: RAISE EXCEPTION

CREATE OR REPLACE FUNCTION check_same_user_story_dependency()
RETURNS TRIGGER AS $$
DECLARE
  v_task_user_story_id UUID;
  v_dependency_user_story_id UUID;
BEGIN
  -- Get user_story_id for the task
  SELECT user_story_id INTO v_task_user_story_id
  FROM tasks
  WHERE id = NEW.task_id;

  -- Get user_story_id for the dependency
  SELECT user_story_id INTO v_dependency_user_story_id
  FROM tasks
  WHERE id = NEW.depends_on_task_id;

  -- Allow if both are NULL (orphaned tasks can depend on each other)
  IF v_task_user_story_id IS NULL AND v_dependency_user_story_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Allow if both have the same user_story_id
  IF v_task_user_story_id IS NOT NULL
     AND v_dependency_user_story_id IS NOT NULL
     AND v_task_user_story_id = v_dependency_user_story_id THEN
    RETURN NEW;
  END IF;

  -- Reject if one is NULL and the other is not
  IF (v_task_user_story_id IS NULL AND v_dependency_user_story_id IS NOT NULL)
     OR (v_task_user_story_id IS NOT NULL AND v_dependency_user_story_id IS NULL) THEN
    RAISE EXCEPTION 'Task dependencies must be within the same user story. Task % belongs to story %, dependency % belongs to story %',
      NEW.task_id,
      COALESCE(v_task_user_story_id::TEXT, 'NULL'),
      NEW.depends_on_task_id,
      COALESCE(v_dependency_user_story_id::TEXT, 'NULL');
  END IF;

  -- Reject if they have different user_story_id values
  IF v_task_user_story_id != v_dependency_user_story_id THEN
    RAISE EXCEPTION 'Task dependencies must be within the same user story. Task % belongs to story %, dependency % belongs to story %',
      NEW.task_id,
      v_task_user_story_id,
      NEW.depends_on_task_id,
      v_dependency_user_story_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: Enforce Story-Scoped Dependencies
-- ============================================
-- This trigger runs before INSERT or UPDATE on task_dependencies
-- to validate that dependencies are within the same user story

CREATE TRIGGER enforce_story_scoped_dependencies
  BEFORE INSERT OR UPDATE ON task_dependencies
  FOR EACH ROW
  EXECUTE FUNCTION check_same_user_story_dependency();

-- ============================================
-- PERFORMANCE INDEX
-- ============================================
-- Composite index to optimize the user_story_id lookups in the trigger
-- This index allows the database to quickly fetch both id and user_story_id together

CREATE INDEX IF NOT EXISTS idx_tasks_user_story_composite
  ON tasks(id, user_story_id);

-- ============================================
-- COMMENTS AND DOCUMENTATION
-- ============================================

COMMENT ON FUNCTION check_same_user_story_dependency() IS
'Validates that task dependencies are within the same user story. Triggered on task_dependencies INSERT or UPDATE. Allows NULL user_story_id pairs (orphaned tasks).';

COMMENT ON TRIGGER enforce_story_scoped_dependencies ON task_dependencies IS
'Prevents cross-story task dependencies by validating that both task_id and depends_on_task_id belong to the same user story.';

-- ============================================
-- ROLLBACK INSTRUCTIONS
-- ============================================
-- To rollback this migration, run:
-- DROP TRIGGER IF EXISTS enforce_story_scoped_dependencies ON task_dependencies;
-- DROP FUNCTION IF EXISTS check_same_user_story_dependency();
-- DROP INDEX IF EXISTS idx_tasks_user_story_composite;
