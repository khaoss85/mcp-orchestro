# Quick Start: User Story Protection

## TL;DR

Instead of:
```sql
❌ DELETE FROM tasks WHERE status = 'backlog';  -- DANGEROUS!
```

Use:
```typescript
✅ await useMcpTool('orchestro', 'safe_delete_tasks_by_status', { status: 'backlog' });
```

## Installation

1. **Apply migration**:
   ```bash
   cd /Users/pelleri/Documents/mcp-coder-expert
   npm run db:migrate
   # Or manually apply:
   # psql -h <host> -U <user> -d <db> -f src/db/migrations/010_auto_update_user_story_status.sql
   ```

2. **Rebuild server**:
   ```bash
   npm run build
   ```

3. **Restart MCP server** (restart Claude Desktop or your MCP client)

## Basic Usage

### 1. Check User Story Health

```typescript
const health = await useMcpTool('orchestro', 'get_user_story_health', {});

console.log('User Stories:', health.length);

// Find issues
const issues = health.filter(us => us.statusMismatch || !us.safeToDelete);
console.log('Stories with issues:', issues.length);

issues.forEach(us => {
  console.log(`- ${us.userStoryTitle}:`);
  console.log(`  Current: ${us.currentStatus}, Should be: ${us.suggestedStatus}`);
  console.log(`  Completion: ${us.completionPercentage}%`);
  console.log(`  Safe to delete: ${us.safeToDelete}`);
});
```

### 2. Safe Delete Tasks

```typescript
const result = await useMcpTool('orchestro', 'safe_delete_tasks_by_status', {
  status: 'backlog'  // or 'todo', 'in_progress', 'done'
});

console.log(`Deleted: ${result.deletedCount} tasks`);
console.log(`Preserved: ${result.preservedCount} tasks`);

// See what was preserved and why
result.preservedTasks.forEach(task => {
  console.log(`\nPreserved: ${task.title}`);
  console.log(`Reason: ${task.reason}`);
  if (task.completionPercentage) {
    console.log(`Progress: ${task.doneTasks}/${task.totalTasks} (${task.completionPercentage}%)`);
  }
});
```

## Common Scenarios

### Scenario 1: Clean Up Old Backlog

```typescript
// Step 1: Check what will be preserved
const health = await useMcpTool('orchestro', 'get_user_story_health', {});
const atRisk = health.filter(us =>
  us.currentStatus === 'backlog' && us.completionPercentage > 0
);

console.log(`Found ${atRisk.length} user stories with completed work in backlog`);

// Step 2: Safe delete
const result = await useMcpTool('orchestro', 'safe_delete_tasks_by_status', {
  status: 'backlog'
});

console.log(`✓ Deleted ${result.deletedCount} old backlog items`);
console.log(`✓ Preserved ${result.preservedCount} items with completed work`);
```

### Scenario 2: Find Mismatched Statuses

```typescript
const health = await useMcpTool('orchestro', 'get_user_story_health', {});

const mismatches = health.filter(us => us.statusMismatch);

console.log(`Found ${mismatches.length} user stories with status mismatches:`);

mismatches.forEach(us => {
  console.log(`\n${us.userStoryTitle}:`);
  console.log(`  Current status: ${us.currentStatus}`);
  console.log(`  Should be: ${us.suggestedStatus}`);
  console.log(`  Completion: ${us.completionPercentage}%`);
  console.log(`  Breakdown: ${us.doneCount} done, ${us.inProgressCount} in progress, ${us.todoCount} todo, ${us.backlogCount} backlog`);

  // Fix manually if needed
  if (us.suggestedStatus !== us.currentStatus) {
    await useMcpTool('orchestro', 'update_task', {
      id: us.userStoryId,
      status: us.suggestedStatus
    });
    console.log(`  ✓ Updated to ${us.suggestedStatus}`);
  }
});
```

### Scenario 3: Verify Protection Works

```typescript
// Create test user story
const story = await useMcpTool('orchestro', 'create_task', {
  title: 'Test User Story',
  description: 'Testing protection',
  status: 'backlog',
  isUserStory: true
});

// Add sub-tasks
await useMcpTool('orchestro', 'create_task', {
  title: 'Subtask 1',
  description: 'Done work',
  status: 'done',
  userStoryId: story.task.id
});

await useMcpTool('orchestro', 'create_task', {
  title: 'Subtask 2',
  description: 'Incomplete work',
  status: 'backlog',
  userStoryId: story.task.id
});

// Try to delete backlog tasks
const result = await useMcpTool('orchestro', 'safe_delete_tasks_by_status', {
  status: 'backlog'
});

// Should preserve the user story
const preserved = result.preservedTasks.find(t => t.id === story.task.id);
console.log('Story preserved?', preserved ? 'YES ✓' : 'NO ✗');
console.log('Reason:', preserved?.reason);
```

## SQL Direct Access

If you prefer SQL:

```sql
-- Check health
SELECT * FROM user_stories_health WHERE status_mismatch = true;

-- Safe delete
SELECT * FROM safe_delete_tasks_by_status('backlog');

-- Manual trigger (updates status automatically)
UPDATE tasks SET status = 'done' WHERE id = '<subtask-id>';
-- Parent user story status updates automatically!
```

## What Gets Preserved?

The system preserves:

1. **User stories with ANY completed sub-tasks**
   - Even if user story status is 'backlog'
   - Completion can be 1% or 100%

2. **Tasks that are dependencies**
   - If other tasks depend on it
   - Prevents breaking dependency chains

3. **Regular tasks get deleted**
   - Only if not a user story
   - Only if nothing depends on them

## Troubleshooting

### Status Not Auto-Updating?

Check triggers are enabled:
```sql
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgname LIKE '%user_story%';
```

Re-enable if needed:
```sql
ALTER TABLE tasks ENABLE TRIGGER trigger_update_user_story_on_subtask_update;
```

### Health View Not Showing Data?

Verify view exists:
```sql
SELECT * FROM user_stories_health LIMIT 1;
```

Recreate if needed:
```bash
psql -h <host> -U <user> -d <db> -f src/db/migrations/010_auto_update_user_story_status.sql
```

### Safe Delete Not Working?

Check function exists:
```sql
SELECT proname FROM pg_proc WHERE proname = 'safe_delete_tasks_by_status';
```

Test manually:
```sql
SELECT * FROM safe_delete_tasks_by_status('backlog');
```

## Next Steps

1. **Read full documentation**: `docs/USER_STORY_PROTECTION.md`
2. **Run test suite**: `tests/user_story_protection_test.sql`
3. **Check migration**: `src/db/migrations/010_auto_update_user_story_status.sql`

## Support

- Check health view: `SELECT * FROM user_stories_health;`
- Review logs: `SELECT * FROM event_queue WHERE event_type = 'task_updated';`
- Manual override: Use `update_task` tool to set status manually if needed
