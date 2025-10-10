# User Story Protection System

## Overview

This system prevents accidental deletion of completed user stories when cleaning up backlog tasks. It includes automatic status updates, health monitoring, and safe deletion tools.

## Problem Solved

**Issue**: A user story can have `status="backlog"` even when all its sub-tasks are completed because:
1. Original sub-tasks remain in backlog
2. Work is done through alternative tasks marked "done"
3. User story status doesn't auto-update
4. Deleting all backlog tasks deletes completed user stories

**Solution**: Automatic status updates + safe deletion with completion awareness

## Components

### 1. Database Trigger: Auto-Update User Story Status

**Location**: `src/db/migrations/010_auto_update_user_story_status.sql`

**How it works**:
- Triggers on sub-task INSERT, UPDATE (status), DELETE
- Calculates completion percentage of sub-tasks
- Updates parent user story status automatically:
  - `done`: ≥80% sub-tasks completed
  - `in_progress`: ≥1 sub-task in progress
  - `todo`: ≥1 sub-task todo
  - `backlog`: ALL sub-tasks in backlog

**Example**:
```sql
-- User story starts in backlog
INSERT INTO tasks (title, description, status, is_user_story)
VALUES ('User Authentication', 'Implement auth system', 'backlog', true);

-- Add sub-tasks
INSERT INTO tasks (title, description, status, user_story_id)
VALUES ('Create login API', '...', 'backlog', '<user-story-id>');

-- Mark sub-task as done
UPDATE tasks SET status = 'done' WHERE id = '<sub-task-id>';
-- Trigger automatically updates user story status to 'in_progress' or 'done'
```

### 2. Health Monitoring View

**View**: `user_stories_health`

**What it shows**:
- Current status vs. suggested status
- Completion percentage
- Task count by status
- Status mismatch flag
- Safe to delete flag

**Query**:
```sql
SELECT
  user_story_title,
  current_status,
  suggested_status,
  completion_percentage,
  done_count,
  total_subtasks,
  status_mismatch,
  safe_to_delete
FROM user_stories_health
WHERE status_mismatch = true  -- Find mismatches
ORDER BY completion_percentage DESC;
```

### 3. Safe Delete Function

**Function**: `safe_delete_tasks_by_status(p_status TEXT)`

**What it does**:
- Deletes tasks by status
- Preserves user stories with ANY completed sub-tasks
- Preserves tasks that are dependencies
- Returns detailed report

**SQL Example**:
```sql
-- Safe delete all backlog tasks
SELECT * FROM safe_delete_tasks_by_status('backlog');

-- Returns:
-- {
--   "deleted_count": 15,
--   "preserved_count": 3,
--   "deleted_task_ids": [...],
--   "preserved_task_ids": [...],
--   "preserved_reasons": [
--     {
--       "task_id": "...",
--       "title": "User Authentication",
--       "reason": "User story has completed sub-tasks",
--       "completion_percentage": 75,
--       "done_tasks": 3,
--       "total_tasks": 4
--     }
--   ]
-- }
```

## MCP Tools

### 1. `safe_delete_tasks_by_status`

**Description**: Safely delete tasks by status with protection for completed work

**Parameters**:
```json
{
  "status": "backlog"  // backlog | todo | in_progress | done
}
```

**Response**:
```json
{
  "success": true,
  "deletedCount": 15,
  "preservedCount": 3,
  "deletedTaskIds": ["uuid1", "uuid2", ...],
  "preservedTasks": [
    {
      "id": "uuid",
      "title": "User Authentication",
      "reason": "User story has completed sub-tasks",
      "completionPercentage": 75,
      "doneTasks": 3,
      "totalTasks": 4
    }
  ]
}
```

**Usage Example**:
```typescript
// Claude Code MCP call
const result = await useMcpTool('orchestro', 'safe_delete_tasks_by_status', {
  status: 'backlog'
});

console.log(`Deleted: ${result.deletedCount} tasks`);
console.log(`Preserved: ${result.preservedCount} tasks`);

result.preservedTasks.forEach(task => {
  console.log(`Preserved: ${task.title} - ${task.reason}`);
  if (task.completionPercentage) {
    console.log(`  Completion: ${task.completionPercentage}%`);
  }
});
```

### 2. `get_user_story_health`

**Description**: Get health monitoring data for all user stories

**Parameters**: None

**Response**:
```json
[
  {
    "userStoryId": "uuid",
    "userStoryTitle": "User Authentication",
    "currentStatus": "backlog",
    "suggestedStatus": "done",
    "totalSubtasks": 4,
    "doneCount": 4,
    "inProgressCount": 0,
    "todoCount": 0,
    "backlogCount": 0,
    "completionPercentage": 100,
    "statusMismatch": true,
    "safeToDelete": false
  }
]
```

**Usage Example**:
```typescript
const health = await useMcpTool('orchestro', 'get_user_story_health', {});

// Find mismatches
const mismatches = health.filter(us => us.statusMismatch);
console.log(`Found ${mismatches.length} user stories with status mismatches`);

// Find completed stories in backlog
const completedInBacklog = health.filter(us =>
  us.currentStatus === 'backlog' && us.completionPercentage >= 80
);
console.log(`Found ${completedInBacklog.length} completed stories in backlog`);
```

## Workflow

### Before Cleanup (Old Way - DANGEROUS)
```sql
-- ❌ This deletes completed user stories!
DELETE FROM tasks WHERE status = 'backlog';
```

### After Cleanup (New Way - SAFE)

**Step 1: Check Health**
```typescript
const health = await useMcpTool('orchestro', 'get_user_story_health', {});
const atRisk = health.filter(us =>
  us.currentStatus === 'backlog' && us.completionPercentage > 0
);

if (atRisk.length > 0) {
  console.log('⚠️ Found user stories with completed work in backlog:');
  atRisk.forEach(us => {
    console.log(`  - ${us.userStoryTitle}: ${us.completionPercentage}% complete`);
  });
}
```

**Step 2: Safe Delete**
```typescript
const result = await useMcpTool('orchestro', 'safe_delete_tasks_by_status', {
  status: 'backlog'
});

console.log(`✅ Deleted ${result.deletedCount} backlog tasks`);
console.log(`✅ Preserved ${result.preservedCount} important tasks`);

result.preservedTasks.forEach(task => {
  console.log(`🛡️ Preserved: ${task.title}`);
  console.log(`   Reason: ${task.reason}`);
});
```

## Testing

### Test Scenario 1: User Story with Completed Sub-Tasks

```sql
-- Create user story in backlog
INSERT INTO tasks (title, description, status, is_user_story, project_id)
VALUES ('Payment System', 'Implement payment processing', 'backlog', true, '<project-id>')
RETURNING id;  -- Save as user_story_id

-- Add sub-tasks
INSERT INTO tasks (title, description, status, user_story_id, project_id) VALUES
  ('Design payment API', 'API design', 'done', '<user-story-id>', '<project-id>'),
  ('Implement Stripe integration', 'Stripe', 'done', '<user-story-id>', '<project-id>'),
  ('Add payment UI', 'UI components', 'in_progress', '<user-story-id>', '<project-id>'),
  ('Write tests', 'Unit tests', 'todo', '<user-story-id>', '<project-id>');

-- Check health
SELECT * FROM user_stories_health WHERE user_story_id = '<user-story-id>';
-- Shows: 50% complete, suggested_status='in_progress', status_mismatch=true

-- Try to delete backlog tasks
SELECT * FROM safe_delete_tasks_by_status('backlog');
-- Result: User story is PRESERVED because it has completed sub-tasks
```

### Test Scenario 2: Trigger Auto-Update

```sql
-- Start with user story in backlog
INSERT INTO tasks (title, description, status, is_user_story, project_id)
VALUES ('Email Notifications', 'Email system', 'backlog', true, '<project-id>')
RETURNING id;

-- Add sub-tasks in backlog
INSERT INTO tasks (title, description, status, user_story_id, project_id) VALUES
  ('Setup email service', '...', 'backlog', '<user-story-id>', '<project-id>'),
  ('Create templates', '...', 'backlog', '<user-story-id>', '<project-id>');

-- User story should still be 'backlog'
SELECT status FROM tasks WHERE id = '<user-story-id>';  -- backlog

-- Mark one sub-task as done
UPDATE tasks SET status = 'done'
WHERE title = 'Setup email service';

-- Check user story status (should auto-update)
SELECT status FROM tasks WHERE id = '<user-story-id>';  -- in_progress!

-- Mark all as done
UPDATE tasks SET status = 'done'
WHERE user_story_id = '<user-story-id>';

-- Check user story status again
SELECT status FROM tasks WHERE id = '<user-story-id>';  -- done!
```

### Test Scenario 3: Query Health Insights

```sql
-- Find all user stories with mismatched status
SELECT
  user_story_title,
  current_status,
  suggested_status,
  completion_percentage,
  done_count || '/' || total_subtasks AS progress
FROM user_stories_health
WHERE status_mismatch = true;

-- Find completed work in backlog (the problem we're solving!)
SELECT
  user_story_title,
  completion_percentage,
  done_count,
  total_subtasks
FROM user_stories_health
WHERE current_status = 'backlog'
  AND completion_percentage > 0
ORDER BY completion_percentage DESC;

-- Find user stories safe to delete
SELECT user_story_title
FROM user_stories_health
WHERE safe_to_delete = true;
```

## Performance

### Indexes Created
```sql
-- Fast user story sub-task queries
CREATE INDEX idx_tasks_user_story_status
  ON tasks(user_story_id, status)
  WHERE user_story_id IS NOT NULL;

-- Fast user story lookups
CREATE INDEX idx_tasks_is_user_story
  ON tasks(is_user_story)
  WHERE is_user_story = TRUE;

-- Fast user story relationship queries
CREATE INDEX idx_tasks_user_story_id
  ON tasks(user_story_id)
  WHERE user_story_id IS NOT NULL;
```

### Query Optimization
- Trigger uses single aggregation query (no N+1)
- View uses LEFT JOIN for efficient counting
- Deletion function batches operations

## Migration

### Apply Migration
```bash
# Using Supabase CLI
supabase db reset  # Apply all migrations

# Or apply specific migration
psql -h <host> -U <user> -d <database> \
  -f src/db/migrations/010_auto_update_user_story_status.sql
```

### Verify Installation
```sql
-- Check trigger exists
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgname LIKE '%user_story%';

-- Check view exists
SELECT viewname
FROM pg_views
WHERE viewname = 'user_stories_health';

-- Check function exists
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'safe_delete_tasks_by_status';
```

## Rollback Plan

If needed, you can rollback the migration:

```sql
-- Drop triggers
DROP TRIGGER IF EXISTS trigger_update_user_story_on_subtask_insert ON tasks;
DROP TRIGGER IF EXISTS trigger_update_user_story_on_subtask_update ON tasks;
DROP TRIGGER IF EXISTS trigger_update_user_story_on_subtask_delete ON tasks;

-- Drop function
DROP FUNCTION IF EXISTS auto_update_user_story_status();
DROP FUNCTION IF EXISTS safe_delete_tasks_by_status(TEXT);

-- Drop view
DROP VIEW IF EXISTS user_stories_health;

-- Drop index
DROP INDEX IF EXISTS idx_tasks_user_story_status;
```

## Best Practices

1. **Always use `safe_delete_tasks_by_status`** instead of direct DELETE
2. **Check health before cleanup** using `get_user_story_health`
3. **Review preserved tasks** to understand why they were kept
4. **Monitor status mismatches** to identify data quality issues
5. **Let triggers handle status** - don't manually update user story status

## FAQ

**Q: What if I want to delete a user story with completed work?**
A: Delete it directly by ID using `delete_task(id)`. The safe delete function only protects against bulk deletion.

**Q: What if the trigger updates status incorrectly?**
A: Check the `user_stories_health` view to see the suggested status. You can manually override if needed.

**Q: How do I fix status mismatches?**
A: The trigger should fix them automatically. If not, manually update the status to match `suggested_status` from the health view.

**Q: Can I disable auto-update temporarily?**
A: Yes, disable the triggers:
```sql
ALTER TABLE tasks DISABLE TRIGGER trigger_update_user_story_on_subtask_update;
-- Re-enable later
ALTER TABLE tasks ENABLE TRIGGER trigger_update_user_story_on_subtask_update;
```

**Q: What's the performance impact?**
A: Minimal. The trigger runs one aggregation query per user story update. Indexes ensure fast lookups.
