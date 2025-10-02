# MCP Coder Expert - Esempi Pratici

## 📖 Esempi di User Stories e Workflow

---

## Esempio 1: Autenticazione Utente

### User Story
```
"Come utente voglio poter resettare la mia password via email"
```

### Prompt per Claude Code
```
Usando mcp-coder-expert, decomponi questa user story:
"Come utente voglio poter resettare la mia password via email"

Workflow completo:
1. decompose_story
2. create_task per ogni task
3. Per il primo task:
   - prepare_task_for_execution
   - Analizza codebase (Grep/Read/Glob)
   - save_task_analysis
   - get_execution_prompt
4. Mostrami il prompt arricchito finale
```

### Output Atteso

**Tasks generati**:
1. "Implement password reset token generation" (backlog)
2. "Setup email service for reset emails" (backlog, dipende da 1)
3. "Create reset password API endpoints" (backlog, dipende da 1,2)
4. "Build password reset UI flow" (backlog, dipende da 3)

**Analysis results**:
- Files to modify: `src/models/User.ts`, `src/routes/auth.ts`
- Files to create: `src/services/email.ts`, `src/db/migrations/006_password_reset.sql`
- Dependencies: User model (modifies), Auth routes (modifies), Email service (creates)
- Risks:
  - 🔴 HIGH: Security - tokens must expire
  - 🟡 MEDIUM: Email service requires configuration
- Related code: `src/services/emailVerification.ts` (similar pattern)
- Recommendations:
  - Use crypto.randomBytes for secure tokens
  - Tokens expire after 1 hour
  - Rate limit reset requests

**Enriched Prompt** (estratto):
```markdown
# Implementation Task

## Files to Modify
🔴 src/routes/auth.ts - Add reset endpoints
  Reason: Need POST /reset-request and POST /reset-confirm

🟡 src/models/User.ts - Add reset token fields
  Reason: Store reset_token and reset_token_expires

## Files to Create
- src/services/email.ts - Email sending service
- src/db/migrations/006_password_reset.sql

## ⚠️ Risks
🔴 HIGH: Security - tokens must expire
  Mitigation: Set expiry to 1 hour, check expiry before reset

## 📚 Related Code
- src/services/emailVerification.ts (lines 10-50)
  Similar email token implementation

## 💡 Recommendations
- Use crypto.randomBytes(32) for token generation
- Hash tokens before storing in database
- Rate limit: max 3 reset requests per hour per email
```

---

## Esempio 2: Feature di Export Dati

### User Story
```
"Come utente voglio poter esportare i miei dati in formato CSV"
```

### Workflow Step-by-Step

**Step 1: Planning**
```
Claude Code → decompose_story("Come utente voglio esportare i miei dati in CSV")

Output:
- Task 1: "Implement CSV generation library integration"
- Task 2: "Create export data API endpoint"
- Task 3: "Add export button to user profile"
- Task 4: "Add download progress indicator"
```

**Step 2: Analysis Preparation**
```
Claude Code → prepare_task_for_execution(task1_id)

Output (prompt):
"# Task Analysis Request
## Search Patterns:
- csv, export, download
- stream, buffer
- file generation

## Files to Check:
- src/utils/**/*.ts
- src/routes/api/**/*.ts
- package.json (check for csv libraries)

## Risks:
- Large datasets - memory issues
- File size limits
- Security: user data access control"
```

**Step 3: Codebase Analysis** (Claude Code usa i suoi tool)
```
Grep: pattern="csv" → Found: No existing CSV functionality
Grep: pattern="export" → Found: src/utils/exportJSON.ts
Read: src/utils/exportJSON.ts → Similar pattern to follow
Glob: src/routes/api/**/*.ts → Found: src/routes/api/user.ts
Read: package.json → No CSV library installed

Analysis compiled:
{
  filesToModify: [
    {
      path: "src/routes/api/user.ts",
      reason: "Add new /export endpoint",
      risk: "medium"
    }
  ],
  filesToCreate: [
    {
      path: "src/utils/exportCSV.ts",
      reason: "New CSV generation utility"
    }
  ],
  dependencies: [
    {
      type: "file",
      name: "exportJSON.ts",
      path: "src/utils/exportJSON.ts",
      action: "uses"
    },
    {
      type: "api",
      name: "GET /api/user/export",
      path: "src/routes/api/user.ts",
      action: "creates"
    }
  ],
  risks: [
    {
      level: "high",
      description: "Large datasets could cause memory issues",
      mitigation: "Use streaming with csv-writer library"
    },
    {
      level: "medium",
      description: "Need to verify user owns the data",
      mitigation: "Add auth middleware check"
    }
  ],
  relatedCode: [
    {
      file: "src/utils/exportJSON.ts",
      description: "Similar export implementation with streaming",
      lines: "15-80"
    }
  ],
  recommendations: [
    "Install csv-writer package",
    "Use streaming for large datasets",
    "Add rate limiting on export endpoint",
    "Include export_requested timestamp in user audit log"
  ]
}
```

**Step 4: Save Analysis**
```
Claude Code → save_task_analysis(task1_id, analysis)

MCP Server:
- Creates resource_nodes: exportJSON.ts, GET /api/user/export
- Creates resource_edges: task → exportJSON.ts (uses), task → API (creates)
- Saves to tasks.metadata.analysis
- Emits guardian_intervention (HIGH risk detected)
- Emits task_updated

Output: "Analysis saved: 2 dependencies, 2 risks identified"
```

**Step 5: Get Enriched Prompt**
```
Claude Code → get_execution_prompt(task1_id)

Output (enriched prompt):
"# Implementation Task

## Task: Implement CSV generation library integration

## Files to Modify
🟡 src/routes/api/user.ts - Add export endpoint

## Files to Create
- src/utils/exportCSV.ts - CSV generation utility

## Dependencies
- exportJSON.ts (similar pattern)
- GET /api/user/export (new endpoint)

## ⚠️ Risks
🔴 HIGH: Large datasets → memory issues
  Mitigation: Use streaming with csv-writer

🟡 MEDIUM: User data verification
  Mitigation: Auth middleware check

## 📚 Related Code
- src/utils/exportJSON.ts (lines 15-80)
  Shows streaming export implementation

## 💡 Recommendations
1. Run: npm install csv-writer
2. Use createObjectCsvWriter with streaming
3. Add rate limit: max 5 exports per hour
4. Log export requests in audit trail

## Implementation Steps
1. Install csv-writer dependency
2. Create src/utils/exportCSV.ts following exportJSON.ts pattern
3. Add GET /api/user/export endpoint to user.ts
4. Add auth middleware to verify user ownership
5. Implement streaming to handle large datasets
6. Add rate limiting
7. Test with sample data
8. Call record_decision for library choice
9. Call update_task when complete
10. Call add_feedback with results"
```

---

## Esempio 3: Bug Fix con Context

### Bug Report
```
"Gli utenti non possono caricare immagini più grandi di 1MB"
```

### Workflow
```
1. Create task manually:
   create_task({
     title: "Fix image upload size limit",
     description: "Users cannot upload images larger than 1MB. Need to increase limit to 5MB",
     status: "todo"
   })

2. Analyze:
   prepare_task_for_execution(task_id)
   → Search patterns: upload, file size, limit, 1MB, multer, multipart

3. Claude Code finds:
   - src/middleware/upload.ts (contains multer config)
   - .env (contains MAX_FILE_SIZE=1048576)
   - src/config/app.ts (reads MAX_FILE_SIZE)

4. Analysis shows:
   Files to modify:
   - .env (change MAX_FILE_SIZE to 5242880)
   - src/middleware/upload.ts (update limits comment)

   Risks:
   - LOW: Increased storage usage

   Related code:
   - Existing multer configuration is correct

5. get_execution_prompt provides:
   "Simply update MAX_FILE_SIZE in .env from 1048576 to 5242880 (5MB)
   No code changes needed - configuration already supports it"
```

---

## Esempio 4: Refactoring con Pattern Learning

### Task
```
"Refactor authentication to use JWT instead of sessions"
```

### Workflow Highlights

**Analysis finds**:
- Files to modify: 15+ files (auth routes, middleware, tests)
- HIGH complexity
- Similar past work: None (first JWT implementation)

**Enriched prompt includes**:
```markdown
## ⚠️ Major Refactoring
This affects 15 files across the codebase.

## Recommendations from similar projects:
1. Keep old session code during migration period
2. Use feature flag to toggle between session/JWT
3. Migrate users gradually
4. Keep JWT secret in environment variables

## Implementation Strategy:
Phase 1: Add JWT alongside sessions
Phase 2: Migrate endpoints one by one
Phase 3: Deprecate sessions
Phase 4: Remove old code

## Files grouped by phase:
Phase 1:
- Add: src/utils/jwt.ts
- Modify: src/middleware/auth.ts (add JWT support)

Phase 2:
- Modify: src/routes/api/auth.ts (add JWT endpoints)
...
```

**After completion**:
```
add_feedback({
  taskId: task_id,
  feedback: "JWT migration successful. Feature flag approach worked well. Users migrated seamlessly.",
  type: "success",
  pattern: "auth_refactoring_jwt",
  tags: ["refactoring", "authentication", "jwt"]
})
```

**Future benefit**: Next time someone does JWT refactoring, they'll see this pattern and feedback!

---

## Esempio 5: Multi-Task Dependency Chain

### User Story
```
"Come utente voglio ricevere notifiche push quando ricevo un messaggio"
```

### Tasks Generated
1. Setup push notification service (Firebase/OneSignal)
2. Add device token storage to user model
3. Create notification API endpoints
4. Implement message event listener
5. Build notification preferences UI

### Dependency Chain
```
Task 1 (no deps)
  ↓
Task 2 (depends on 1)
  ↓
Task 3 (depends on 2)
  ↓
Task 4 (depends on 3)
  ↓
Task 5 (depends on 3)
```

### Workflow per Task 4
```
prepare_task_for_execution(task4_id)

Prompt includes:
"## Dependencies Context
This task depends on:
- ✅ Task 1: Push service setup (DONE)
- ✅ Task 2: Device tokens (DONE)
- ✅ Task 3: Notification API (DONE)

You can use:
- pushService from src/services/push.ts
- User.deviceToken from src/models/User.ts
- POST /api/notifications from src/routes/notifications.ts

## Previous Decisions from Dependencies:
- Task 1 decision: Using Firebase Cloud Messaging
- Task 2 decision: Storing multiple device tokens per user
- Task 3 decision: Notification payload includes: title, body, data"
```

---

## Best Practices dai Test

### 1. Decompose Story Prima
```
✅ GOOD:
decompose_story → create_task → prepare → analyze → save → get_prompt

❌ BAD:
create_task direttamente (senza decompose)
```

### 2. Analizza Sempre Prima di Implementare
```
✅ GOOD:
prepare → analyze codebase → save → get enriched prompt → implement

❌ BAD:
create_task → implement subito (senza context)
```

### 3. Registra Decisioni Importanti
```
✅ GOOD:
record_decision({
  decision: "Use Redis for session storage",
  rationale: "Need distributed sessions for multi-server deployment"
})

❌ BAD:
Implementare senza registrare il "perché"
```

### 4. Aggiungi Feedback dopo Completion
```
✅ GOOD:
add_feedback({
  type: "success",
  feedback: "Migration completed without downtime. Users didn't notice.",
  pattern: "database_migration_zero_downtime"
})

❌ BAD:
update_task(status: "done") e basta
```

---

## Pattern Comuni

### Pattern 1: Database Migration
```
Tasks:
1. Write migration SQL
2. Test on staging
3. Run on production
4. Verify data integrity

Analysis typically finds:
- High risk: data loss
- Recommendations: backup first, run during low traffic
```

### Pattern 2: API Endpoint Addition
```
Tasks:
1. Define API contract
2. Implement endpoint
3. Add tests
4. Update documentation

Analysis typically finds:
- Medium risk: auth/authorization
- Recommendations: rate limiting, input validation
```

### Pattern 3: UI Component Creation
```
Tasks:
1. Design component interface
2. Implement component
3. Add to storybook
4. Integrate in app

Analysis typically finds:
- Low risk
- Recommendations: reuse existing design system
```

---

## Dashboard Usage Examples

### Scenario 1: Monitoring Progress
```
1. Open http://localhost:3000
2. See all tasks in Kanban
3. Drag task from "To Do" to "In Progress" when starting
4. Click task to see enriched prompt in Overview
5. Check Dependencies tab to see what files will be touched
6. Drag to "Done" when complete
```

### Scenario 2: Understanding Impact
```
1. Click on task in dashboard
2. Go to Dependencies tab
3. See resource graph showing all affected files
4. See risk indicators (red/yellow/green)
5. Make informed decision about when to tackle this task
```

### Scenario 3: Learning from History
```
1. Complete a task
2. Go to History tab
3. See complete timeline:
   - When task was created
   - When analysis was done
   - What decisions were made
   - When status changed
   - Final feedback
4. Use this for retrospectives or knowledge transfer
```

---

## Troubleshooting Examples

### Example: Analysis Returns Empty
```
Problem: save_task_analysis has empty dependencies

Solution:
- Claude Code might not have found matching patterns
- Try broader search patterns in prepare_task_for_execution
- Check if file paths are correct
- Verify codebase is accessible
```

### Example: HIGH Risk but No Mitigation
```
Problem: Analysis shows HIGH risk but no mitigation strategy

Solution:
- Claude Code should analyze related code for best practices
- Check similar past tasks with get_similar_learnings
- Consult team before proceeding
- Document mitigation in record_decision
```

### Example: Tasks Not Appearing in Dashboard
```
Problem: create_task succeeds but no task in dashboard

Solution:
- Check dashboard is on http://localhost:3000
- Check Socket.io connection (green indicator)
- Check browser console for errors
- Refresh page
- Check event_queue table in Supabase
```

---

**More examples**: See CLAUDE_CODE_SETUP.md for complete workflow documentation
