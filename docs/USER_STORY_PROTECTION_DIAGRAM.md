# User Story Protection System - Visual Flow

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    User Story Protection System                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────┐      ┌──────────────────┐      ┌─────────────┐
│   MCP Client    │      │  TypeScript API  │      │  PostgreSQL │
│  (Claude Code)  │◄────►│  (task.ts)       │◄────►│  Database   │
└─────────────────┘      └──────────────────┘      └─────────────┘
        │                         │                        │
        │                         │                        │
        ▼                         ▼                        ▼
  ┌─────────┐            ┌─────────────┐          ┌──────────────┐
  │  Tools  │            │  Functions  │          │   Triggers   │
  └─────────┘            └─────────────┘          └──────────────┘
```

## Data Flow: Auto-Update Trigger

```
┌────────────────────────────────────────────────────────────────┐
│  1. Sub-task Status Update                                     │
└────────────────────────────────────────────────────────────────┘
                            │
                            ▼
        UPDATE tasks SET status = 'done'
        WHERE id = '<sub-task-id>'
                            │
                            ▼
┌────────────────────────────────────────────────────────────────┐
│  2. Trigger Fires                                              │
│     trigger_update_user_story_on_subtask_update                │
└────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────┐
│  3. Function Executes                                          │
│     auto_update_user_story_status()                            │
│                                                                 │
│     - Get user_story_id from sub-task                          │
│     - Count sub-tasks by status:                               │
│       * done_count                                             │
│       * in_progress_count                                      │
│       * todo_count                                             │
│       * backlog_count                                          │
│     - Calculate completion %                                   │
│     - Determine new status                                     │
└────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────┐
│  4. Status Logic Decision Tree                                 │
│                                                                 │
│     IF completion_pct >= 80%  → status = 'done'               │
│     ELSE IF in_progress > 0   → status = 'in_progress'        │
│     ELSE IF todo > 0          → status = 'todo'               │
│     ELSE IF all backlog       → status = 'backlog'            │
└────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────┐
│  5. Update User Story Status                                   │
│     UPDATE tasks SET status = <new_status>                     │
│     WHERE id = <user_story_id>                                 │
└────────────────────────────────────────────────────────────────┘
```

## Safe Delete Flow

```
┌────────────────────────────────────────────────────────────────┐
│  1. MCP Tool Call                                              │
│     safe_delete_tasks_by_status({ status: 'backlog' })        │
└────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────┐
│  2. TypeScript Function                                        │
│     safeDeleteTasksByStatus(params)                            │
│                                                                 │
│     - Calls PostgreSQL RPC function                            │
└────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────┐
│  3. PostgreSQL Function                                        │
│     safe_delete_tasks_by_status(p_status)                     │
│                                                                 │
│     FOR EACH task WHERE status = p_status:                     │
│       │                                                         │
│       ├─► Is User Story?                                       │
│       │   ├─► YES → Check completed sub-tasks                 │
│       │   │   ├─► Has completed work? → PRESERVE              │
│       │   │   └─► No completed work? → SAFE TO DELETE         │
│       │   │                                                    │
│       │   └─► NO → Check dependencies                         │
│       │       ├─► Is dependency? → PRESERVE                   │
│       │       └─► Not dependency? → SAFE TO DELETE            │
│       │                                                         │
│       └─► Add to deleted[] or preserved[]                     │
└────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────┐
│  4. Batch Delete                                               │
│     DELETE FROM tasks WHERE id = ANY(deleted_ids)              │
└────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────┐
│  5. Return Report                                              │
│     {                                                           │
│       deletedCount: 15,                                        │
│       preservedCount: 3,                                       │
│       deletedTaskIds: [...],                                   │
│       preservedTasks: [                                        │
│         {                                                       │
│           id: "...",                                           │
│           title: "User Story X",                              │
│           reason: "Has completed sub-tasks",                  │
│           completionPercentage: 75                            │
│         }                                                       │
│       ]                                                         │
│     }                                                           │
└────────────────────────────────────────────────────────────────┘
```

## Health View Query

```
┌────────────────────────────────────────────────────────────────┐
│  SELECT * FROM user_stories_health                             │
└────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────┐
│  View Logic                                                     │
│                                                                 │
│  SELECT                                                         │
│    us.id, us.title, us.status AS current_status,              │
│    COUNT(t.id) AS total_subtasks,                             │
│    COUNT(CASE WHEN t.status='done' THEN 1) AS done_count,     │
│    ... (other counts) ...                                      │
│    ROUND(done_count / total * 100, 2) AS completion_pct,      │
│                                                                 │
│    -- Calculate suggested status                               │
│    CASE                                                         │
│      WHEN completion_pct >= 80 THEN 'done'                    │
│      WHEN in_progress > 0 THEN 'in_progress'                  │
│      WHEN todo > 0 THEN 'todo'                                │
│      WHEN backlog = total THEN 'backlog'                      │
│    END AS suggested_status,                                    │
│                                                                 │
│    -- Mismatch flag                                            │
│    (current_status != suggested_status) AS status_mismatch,   │
│                                                                 │
│    -- Safety flag                                              │
│    (done_count = 0) AS safe_to_delete                         │
│  FROM tasks us                                                  │
│  LEFT JOIN tasks t ON t.user_story_id = us.id                 │
│  WHERE us.is_user_story = TRUE                                 │
│  GROUP BY us.id                                                 │
└────────────────────────────────────────────────────────────────┘
```

## Status Transition Examples

### Example 1: Progressive Completion

```
Initial State:
┌─────────────────────────────┐
│  User Story: "Payment"      │
│  Status: backlog            │
└─────────────────────────────┘
          │
          ├─ Sub-task 1: backlog
          ├─ Sub-task 2: backlog
          ├─ Sub-task 3: backlog
          └─ Sub-task 4: backlog

Step 1: Start work on sub-task 1
UPDATE sub-task 1 → in_progress
┌─────────────────────────────┐
│  User Story: "Payment"      │
│  Status: in_progress ◄──────┼─── AUTO-UPDATED
└─────────────────────────────┘
          │
          ├─ Sub-task 1: in_progress ✓
          ├─ Sub-task 2: backlog
          ├─ Sub-task 3: backlog
          └─ Sub-task 4: backlog

Step 2: Complete sub-task 1
UPDATE sub-task 1 → done
┌─────────────────────────────┐
│  User Story: "Payment"      │
│  Status: in_progress        │ (25% complete, stays in_progress)
└─────────────────────────────┘
          │
          ├─ Sub-task 1: done ✓
          ├─ Sub-task 2: backlog
          ├─ Sub-task 3: backlog
          └─ Sub-task 4: backlog

Step 3: Complete 3 more (total 4/4)
UPDATE sub-tasks 2,3,4 → done
┌─────────────────────────────┐
│  User Story: "Payment"      │
│  Status: done ◄─────────────┼─── AUTO-UPDATED (100% complete)
└─────────────────────────────┘
          │
          ├─ Sub-task 1: done ✓
          ├─ Sub-task 2: done ✓
          ├─ Sub-task 3: done ✓
          └─ Sub-task 4: done ✓
```

### Example 2: The Problem We Solved

```
Before Protection System:
┌─────────────────────────────────────────────────────────────┐
│  User Story: "Authentication"                               │
│  Status: backlog  ◄─── NEVER UPDATED (Problem!)            │
└─────────────────────────────────────────────────────────────┘
          │
          ├─ Original sub-task 1: backlog  ◄─── Never touched
          ├─ Original sub-task 2: backlog  ◄─── Never touched
          ├─ Alternative task A: done      ◄─── Work done here
          └─ Alternative task B: done      ◄─── Work done here

DELETE FROM tasks WHERE status = 'backlog'
❌ DELETES: User story + original sub-tasks
❌ LOSES: Completed work record!

─────────────────────────────────────────────────────────────

After Protection System:
┌─────────────────────────────────────────────────────────────┐
│  User Story: "Authentication"                               │
│  Status: in_progress ◄─── AUTO-UPDATED (trigger detected)  │
└─────────────────────────────────────────────────────────────┘
          │
          ├─ Original sub-task 1: backlog
          ├─ Original sub-task 2: backlog
          ├─ Alternative task A: done ✓
          └─ Alternative task B: done ✓

safe_delete_tasks_by_status('backlog')
✅ PRESERVES: User story (has completed sub-tasks)
✅ DELETES: Only original backlog sub-tasks 1 & 2
✅ KEEPS: Alternative tasks A & B (done status)
✅ REPORTS: Why user story was preserved
```

## Decision Tree: Should Task Be Deleted?

```
                    ┌─────────────────┐
                    │  Task to Delete │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Is User Story? │
                    └────┬──────────┬─┘
                         │          │
                      YES│          │NO
                         │          │
          ┌──────────────▼──┐    ┌──▼────────────────┐
          │ Has completed   │    │ Is dependency for │
          │ sub-tasks?      │    │ other tasks?      │
          └─┬────────────┬──┘    └──┬─────────────┬──┘
            │            │           │             │
         YES│            │NO      YES│             │NO
            │            │           │             │
     ┌──────▼──────┐ ┌──▼──────┐ ┌──▼──────┐ ┌───▼──────┐
     │  PRESERVE   │ │  DELETE │ │ PRESERVE│ │  DELETE  │
     │             │ │         │ │         │ │          │
     │ Reason:     │ │         │ │ Reason: │ │          │
     │ "Has done   │ │         │ │ "Used by│ │          │
     │  sub-tasks" │ │         │ │  others"│ │          │
     └─────────────┘ └─────────┘ └─────────┘ └──────────┘
```

## Integration Points

```
┌──────────────────────────────────────────────────────────────┐
│                     MCP Server (server.ts)                   │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Tool: safe_delete_tasks_by_status                          │
│  ├─► Calls: safeDeleteTasksByStatus(params)                 │
│  └─► Returns: Deletion report                               │
│                                                               │
│  Tool: get_user_story_health                                │
│  ├─► Calls: getUserStoryHealth()                            │
│  └─► Returns: Health metrics array                          │
│                                                               │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│                   Task Functions (task.ts)                   │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  safeDeleteTasksByStatus(params)                            │
│  ├─► supabase.rpc('safe_delete_tasks_by_status')           │
│  ├─► Parse preserved_reasons                                │
│  ├─► Invalidate cache                                       │
│  └─► Return formatted result                                │
│                                                               │
│  getUserStoryHealth()                                        │
│  ├─► supabase.from('user_stories_health').select()         │
│  ├─► Map rows to typed response                             │
│  └─► Return health array                                    │
│                                                               │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│                PostgreSQL Database                           │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Tables:                                                      │
│  ├─ tasks (with user_story_id, is_user_story)              │
│  └─ task_dependencies                                       │
│                                                               │
│  Triggers:                                                    │
│  ├─ trigger_update_user_story_on_subtask_insert            │
│  ├─ trigger_update_user_story_on_subtask_update            │
│  └─ trigger_update_user_story_on_subtask_delete            │
│                                                               │
│  Functions:                                                   │
│  ├─ auto_update_user_story_status()                        │
│  └─ safe_delete_tasks_by_status(TEXT)                      │
│                                                               │
│  Views:                                                       │
│  └─ user_stories_health                                     │
│                                                               │
│  Indexes:                                                     │
│  ├─ idx_tasks_user_story_status                            │
│  ├─ idx_tasks_is_user_story                                │
│  └─ idx_tasks_user_story_id                                │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

## Performance Optimization

```
Query Performance Path:

1. Trigger Execution (on UPDATE)
   ├─► Single aggregation query
   ├─► Uses index: idx_tasks_user_story_status
   └─► O(n) where n = sub-tasks per story

2. Health View Query
   ├─► LEFT JOIN with GROUP BY
   ├─► Uses indexes: idx_tasks_is_user_story
   └─► O(m) where m = total tasks

3. Safe Delete Function
   ├─► Single scan of tasks table
   ├─► Batch delete operation
   └─► O(k) where k = tasks with target status

All operations indexed and optimized!
```

## Summary Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                  USER STORY PROTECTION SYSTEM               │
│                                                              │
│  Problem: Completed user stories in backlog get deleted    │
│  Solution: Auto-update + Safe deletion + Health monitoring │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────────┐       │
│  │  Triggers  │  │   Views    │  │   Functions    │       │
│  │            │  │            │  │                │       │
│  │ Auto-      │  │ Health     │  │ Safe Delete   │       │
│  │ update     │  │ Monitor    │  │ with          │       │
│  │ status     │  │            │  │ Preservation  │       │
│  └────────────┘  └────────────┘  └────────────────┘       │
│                                                              │
│  Result: ✅ Completed work is protected                    │
│          ✅ Status stays synchronized                       │
│          ✅ Safe cleanup operations                         │
└─────────────────────────────────────────────────────────────┘
```
