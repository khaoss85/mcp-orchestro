# Frontend Implementation Spec: Delete User Story Feature

**Task ID**: d198632a-63e6-45ff-b1fb-ec2045302bd6
**Backend Ready**: ✅ MCP tool `delete_user_story` implemented and tested
**Target Repository**: web-dashboard (frontend submodule)

---

## 🎯 Obiettivo

Integrare la funzionalità di eliminazione user story nel frontend React, utilizzando il MCP tool backend già implementato.

---

## 🔌 Backend API (MCP Tool)

### Tool Name
`delete_user_story`

### Request Parameters

```typescript
{
  userStoryId: string;  // UUID della user story (REQUIRED)
  force?: boolean;      // Force deletion with completed sub-tasks (OPTIONAL, default: false)
}
```

### Response Format

**Success:**
```typescript
{
  success: true;
  deletedUserStory: Task;      // User story eliminata
  deletedSubTasks: Task[];     // Array di sub-tasks eliminati
}
```

**Error (Completed Work):**
```typescript
{
  success: false;
  error: "Cannot delete user story with 3 completed sub-task(s). Use force=true to delete anyway.";
  warning: "This user story has completed work that will be lost if deleted.";
}
```

**Error (External Dependencies):**
```typescript
{
  success: false;
  error: "Cannot delete user story because external tasks depend on its sub-tasks:\n- Task Title (task-id)\n...";
}
```

**Error (Not Found):**
```typescript
{
  success: false;
  error: "User story with id {userStoryId} not found or is not a user story";
}
```

---

## 🎨 UI/UX Flow

### 1. Normal Delete Flow

```
User clicks Delete Button
    ↓
Show ConfirmDialog (variant: danger)
    ↓
User confirms
    ↓
Call delete_user_story(id, force=false)
    ↓
Success → Remove from UI + Show toast
```

### 2. Force Delete Flow (Completed Work)

```
Call delete_user_story(id, force=false)
    ↓
Error: "completed sub-task(s)"
    ↓
Show second ConfirmDialog with warning
    ↓
User confirms force delete
    ↓
Call delete_user_story(id, force=true)
    ↓
Success → Remove from UI + Show toast
```

### 3. Blocked by Dependencies Flow

```
Call delete_user_story(id, force=false)
    ↓
Error: "external tasks depend"
    ↓
Show error dialog (no retry option)
    ↓
User acknowledges → Close dialog
```

---

## 📝 Implementation Example

### Service Layer (MCP Client)

```typescript
// services/userStoryService.ts
import { mcpClient } from '@/lib/mcp';

export async function deleteUserStory(
  userStoryId: string,
  force: boolean = false
): Promise<DeleteUserStoryResult> {
  const response = await mcpClient.callTool({
    name: "delete_user_story",
    arguments: {
      userStoryId,
      force
    }
  });

  return response;
}

interface DeleteUserStoryResult {
  success: boolean;
  deletedUserStory?: Task;
  deletedSubTasks?: Task[];
  error?: string;
  warning?: string;
}
```

### Component Integration

```typescript
// components/UserStoryCard.tsx
'use client';

import { useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { deleteUserStory } from '@/services/userStoryService';
import { toast } from 'sonner';

export function UserStoryCard({ userStory, onDelete }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showForceDialog, setShowForceDialog] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      // First attempt: force=false
      const result = await deleteUserStory(userStory.id, false);

      if (result.success) {
        handleSuccess(result);
      }
    } catch (error) {
      handleError(error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleForceDelete = async () => {
    setIsDeleting(true);

    try {
      // Second attempt: force=true
      const result = await deleteUserStory(userStory.id, true);

      if (result.success) {
        handleSuccess(result);
      }
    } catch (error) {
      handleError(error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSuccess = (result) => {
    // Optimistic UI update
    onDelete(userStory.id);

    // Success notification
    toast.success(
      `Deleted "${result.deletedUserStory.title}" and ${result.deletedSubTasks.length} sub-task(s)`
    );

    setShowConfirmDialog(false);
    setShowForceDialog(false);
  };

  const handleError = (error) => {
    if (error.message.includes('completed sub-task')) {
      // Show force confirmation
      setShowForceDialog(true);
      setErrorMessage(error.message);
    } else if (error.message.includes('external tasks depend')) {
      // Show dependency error (non-recoverable)
      toast.error(error.message);
    } else {
      // Generic error
      toast.error(`Failed to delete: ${error.message}`);
    }
  };

  return (
    <>
      <div className="user-story-card">
        {/* Card content */}
        <button
          onClick={() => setShowConfirmDialog(true)}
          disabled={isDeleting}
          className="delete-button"
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>

      {/* Normal confirmation dialog */}
      <ConfirmDialog
        isOpen={showConfirmDialog}
        title="Delete User Story?"
        message={`Are you sure you want to delete "${userStory.title}"? This will also delete all ${userStory.subtaskCount} associated task(s).`}
        confirmText={isDeleting ? 'Deleting...' : 'Delete'}
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowConfirmDialog(false)}
      />

      {/* Force delete confirmation dialog */}
      <ConfirmDialog
        isOpen={showForceDialog}
        title="⚠️ Delete with Completed Work?"
        message={`${errorMessage}\n\nThis will permanently delete all completed work. Are you sure you want to continue?`}
        confirmText={isDeleting ? 'Deleting...' : 'Force Delete'}
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleForceDelete}
        onCancel={() => setShowForceDialog(false)}
      />
    </>
  );
}
```

---

## ✅ Checklist Implementazione

### Must Have
- [ ] Add delete button/icon to UserStoryCard component
- [ ] Integrate with existing ConfirmDialog component
- [ ] Implement double confirmation flow (normal → force)
- [ ] Call MCP tool `delete_user_story` via service layer
- [ ] Handle loading states (disable button, show spinner)
- [ ] Implement optimistic UI updates (remove from list on success)
- [ ] Show success toast notification with deleted count
- [ ] Handle 3 error types: not found, completed work, external dependencies

### Should Have
- [ ] Prefetch sub-task count for confirmation message
- [ ] Show sub-task titles in confirmation dialog
- [ ] Implement rollback on error (restore in list if optimistically removed)
- [ ] Debounce delete button (prevent double-click)
- [ ] Add keyboard shortcuts (e.g., Shift+Delete)
- [ ] Navigate away from detail view after delete (if applicable)

### Nice to Have
- [ ] Undo delete functionality (soft delete + restore)
- [ ] Bulk delete multiple user stories
- [ ] Export deleted data before deletion
- [ ] Show deletion progress for stories with many sub-tasks

---

## 🧪 Test Cases

### Unit Tests
1. ✅ Delete button renders correctly
2. ✅ Clicking delete shows confirmation dialog
3. ✅ Canceling confirmation closes dialog without deleting
4. ✅ Confirming delete calls MCP service with force=false
5. ✅ Success removes story from UI and shows toast
6. ✅ Completed work error shows force confirmation
7. ✅ Force confirmation calls MCP service with force=true
8. ✅ External dependency error shows error message
9. ✅ Loading state disables button and shows spinner

### Integration Tests
1. ✅ Delete user story with 0 sub-tasks
2. ✅ Delete user story with only backlog sub-tasks
3. ✅ Delete user story with completed sub-tasks (should prompt force)
4. ✅ Force delete user story with completed sub-tasks
5. ✅ Attempt delete with external dependencies (should fail)
6. ✅ Verify CASCADE delete removes all sub-tasks
7. ✅ Verify UI updates correctly after delete
8. ✅ Test concurrent delete operations
9. ✅ Test network timeout handling

---

## 📚 Related Components

### Existing Components to Reuse
- **ConfirmDialog** (`web-dashboard/components/ConfirmDialog.tsx`)
  - Already has all required features
  - Supports variant="danger" for destructive actions
  - Includes accessibility (ARIA labels, focus management)

### Files to Create/Modify
- `web-dashboard/services/userStoryService.ts` - MCP client wrapper (CREATE)
- `web-dashboard/components/UserStoryCard.tsx` - Add delete button (MODIFY)
- `web-dashboard/app/story/[id]/page.tsx` - Story detail page integration (MODIFY)
- `web-dashboard/types/task.ts` - Type definitions for response (VERIFY/UPDATE)

---

## 🎯 Backend Implementation Status

| Component | Status | Location |
|-----------|--------|----------|
| MCP Tool `deleteUserStory` | ✅ Done | `src/tools/task.ts:510-647` |
| MCP Tool Registration | ✅ Done | `src/server.ts:700-716, 1891-1902` |
| Database CASCADE Constraint | ✅ Done | `src/db/migrations/007_add_user_story_grouping.sql:7` |
| Event Emission | ✅ Done | `user_story_deleted` event |
| Cache Invalidation | ✅ Done | `cache.clearPattern('tasks:*')` |
| Safety Checks | ✅ Done | Completed work protection, dependency checking |

---

## 🚀 Ready for Implementation

Il backend è completamente pronto. Il frontend team può procedere con l'implementazione seguendo queste specifiche.

Per domande o chiarimenti, consultare:
- Backend implementation: `src/tools/task.ts` (linee 510-647)
- MCP tool registration: `src/server.ts` (linee 700-716, 1891-1902)
