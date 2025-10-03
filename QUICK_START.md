# 🚀 Orchestro - Quick Start Guide

## For Immediate Use on a New Project

### Step 1: Prerequisites Check ✅

Make sure you have:
- ✅ Node.js 18+ (`node --version`)
- ✅ Claude Code installed
- ✅ Supabase database URL (pooler connection)

---

### Step 2: Install/Configure Orchestro ⚡

#### If Already Installed at `/Users/pelleri/Documents/mcp-coder-expert`:

```bash
cd /Users/pelleri/Documents/mcp-coder-expert
npm run configure-claude
```

This updates your Claude Code config automatically.

#### If Installing Fresh:

```bash
npx @orchestro/init
```

---

### Step 3: Restart Claude Code 🔄

**Important**: Claude Code must be completely restarted to load the MCP server!

**macOS**: Cmd+Q then reopen
**Windows**: Close completely then reopen
**Linux**: Close and reopen

---

### Step 4: Verify Installation ✅

Open Claude Code and ask:
```
Show me the available Orchestro tools
```

You should see 27 MCP tools available.

---

### Step 5: Start Dashboard (Optional) 📊

```bash
cd /Users/pelleri/Documents/mcp-coder-expert
npm run dashboard
```

Browser should automatically open to: **http://localhost:5173**

---

## Quick Usage Examples

### Create Your First Task
In Claude Code, say:
```
Create a task to implement user authentication
```

### Decompose a User Story
```
Decompose this user story: "User should be able to login with email and password"
```

### List All Tasks
```
List all tasks in the backlog
```

---

## Current Setup Status

Your current installation at `/Users/pelleri/Documents/mcp-coder-expert`:

✅ **Already Configured**:
- ✅ Built: `dist/server.js` exists
- ✅ Environment: `.env` configured with DATABASE_URL
- ✅ Claude Config: Orchestro MCP server added
- ✅ Migrations: All database migrations ready

### To Use Right Now on a New Project:

1. **Open Claude Code**
2. **Navigate to your new project directory**
3. **Ask Claude Code**:
   ```
   Create a new Orchestro task for [your feature]
   ```

That's it! Orchestro works across all your projects once installed.

---

## Test Workflow Example

Copy and paste this into Claude Code:

```
I want to test the Orchestro workflow.

User Story: "As an admin I want to ban users from the platform"

Execute this workflow step by step:

PHASE 1 - PLANNING:
1. Use decompose_story to break down the user story into tasks
2. Create each task using create_task

PHASE 2 - ANALYSIS PREPARATION:
3. Take the first task and use prepare_task_for_execution
4. Show me the analysis prompt you received

PHASE 3 - CODEBASE ANALYSIS:
5. Analyze the codebase following the prompt:
   - Use Grep to search for suggested patterns
   - Use Read to read relevant files
   - Use Glob to find matching files
6. Compile the analysis results

PHASE 4 - SAVE ANALYSIS:
7. Save the analysis using save_task_analysis
8. Show me the confirmation message

PHASE 5 - GET ENRICHED PROMPT:
9. Use get_execution_prompt to get the enriched prompt
10. Show me the complete prompt you received

PHASE 6 - SUMMARY:
11. List all created tasks with list_tasks
12. Give me the task IDs so I can see them in the dashboard

Execute the entire workflow and show me the results of each phase!
```

---

### Step 6: Verify Dashboard

While Claude Code works, the dashboard should auto-open at:
**http://localhost:5173**

**You should see in real-time**:
- 🔔 **Toast notifications** for each created task
- 📋 **Tasks in Kanban board** (Backlog column)
- ⚡ **Instant updates** while Claude Code works

**Click on a task** to see:
- Tab **Overview**: Task details
- Tab **History**: Complete timeline with all events
- Tab **Dependencies**: Dependency graph (after analysis)

---

## 📊 Cosa Aspettarsi

### Durante il Workflow

1. **Decompose Story** (~5 secondi)
   - Claude Code riceve 4-6 task suggeriti
   - Dashboard mostra notifica per ogni task creato

2. **Prepare for Execution** (~2 secondi)
   - Claude Code riceve prompt strutturato
   - Prompt include: search patterns, file patterns, risks

3. **Codebase Analysis** (~10-20 secondi)
   - Claude Code usa Grep/Read/Glob
   - Analizza il codebase reale del progetto
   - Compila risultati dettagliati

4. **Save Analysis** (~3 secondi)
   - Dipendenze salvate nel grafo
   - Metadata salvato nel task
   - Eventi emessi se ci sono HIGH risks
   - Dashboard si aggiorna con badge "Dependencies"

5. **Get Enriched Prompt** (~2 secondi)
   - Prompt completo generato
   - Include: files, risks, related code, patterns, guidelines
   - Pronto per l'esecuzione

### Output Atteso

Claude Code dovrebbe mostrarti:

```
✅ FASE 1 - Tasks creati:
- Task 1: Setup ban user database field (ID: abc-123-...)
- Task 2: Implement ban API endpoint (ID: def-456-...)
- Task 3: Add ban button to admin UI (ID: ghi-789-...)
- Task 4: Add ban status indicator (ID: jkl-012-...)

✅ FASE 2 - Prompt di analisi ricevuto:
# Task Analysis Request
## Search for these patterns:
- CREATE TABLE, ALTER TABLE
- api endpoint, router
...

✅ FASE 3 - Analisi completata:
Found:
- Files to modify: src/models/User.ts, src/routes/admin.ts
- Files to create: src/middleware/checkBanned.ts
- Dependencies: User model, Admin routes, Auth middleware
- Risks: HIGH - Modifying user authentication flow
...

✅ FASE 4 - Analysis saved:
Analysis saved: 5 dependencies, 2 risks identified
1 HIGH risk - guardian intervention event emitted

✅ FASE 5 - Enriched prompt:
# Implementation Task
## Files to Modify
🔴 src/routes/admin.ts - Add ban endpoint
🟡 src/models/User.ts - Add isBanned field
## ⚠️ Risks
🔴 HIGH: Modifying auth flow could lock users out
  Mitigation: Add banned_at timestamp for audit trail
...

✅ FASE 6 - Summary:
4 tasks created and visible on dashboard!
Task IDs:
- Task 1: abc-123-...
- Task 2: def-456-...
```

---

## 🎯 Dashboard Features

### Kanban Board
- Drag & drop tasks tra le colonne
- Badge "Dependencies" se task ha dipendenze
- Badge "Risks" se ci sono HIGH risks
- Status colors

### Task Detail Page
**Tab Overview**:
- Title, description, status
- Dependencies list (clickable)
- Guidelines e tech stack

**Tab History**:
- Timeline completa eventi
- Decision records
- Status transitions
- Feedback entries
- Rollback capability

**Tab Dependencies**:
- Grafo visuale delle dipendenze
- Resource nodes e edges
- Tipo di azione (uses/modifies/creates)

---

## 🐛 Troubleshooting

### MCP Server non si connette

```bash
# Test manuale
cd /Users/pelleri/Documents/mcp-coder-expert
./run-mcp-server.sh
# Dovresti vedere: "MCP Coder Expert server running on stdio"
# Ctrl+C per fermare
```

**Se errore "permission denied"**:
```bash
chmod +x /Users/pelleri/Documents/mcp-coder-expert/run-mcp-server.sh
```

### Claude Code non vede i tools

1. Verifica che il config JSON sia valido (no virgole extra)
2. Riavvia Claude Code COMPLETAMENTE (Cmd+Q, poi riapri)
3. Controlla i log: `~/Library/Logs/Claude/`

### Dashboard non si aggiorna

1. Verifica che sia aperta: http://localhost:3000
2. Apri DevTools (F12) e controlla Console per errori Socket.io
3. Verifica che il server Node sia running (dovrebbe essere in background)

### Tasks non appaiono

```bash
# Verifica che le migrations siano applicate
# Controlla su Supabase dashboard che tasks table esista
open https://supabase.com/dashboard/project/zjtiqmdhqtapxeidiubd/editor
```

---

## 📚 Documentazione Completa

- **Workflow Dettagliato**: NEW_WORKFLOW.md
- **Setup Completo**: CLAUDE_CODE_SETUP.md
- **Implementation Details**: IMPLEMENTATION_SUMMARY.md

---

## ✅ Checklist Pre-Test

Prima di testare, verifica:
- [ ] Dashboard aperta su http://localhost:3000
- [ ] MCP server builds senza errori (`npm run build`)
- [ ] Claude Code config aggiornato
- [ ] Claude Code riavviato
- [ ] MCP tools visibili in Claude Code

---

## 🎉 Successo!

Se vedi:
- ✅ Tasks nella dashboard
- ✅ Timeline nella History tab
- ✅ Grafo nella Dependencies tab
- ✅ Notifiche real-time

**Congratulazioni! Il sistema funziona!** 🚀

Puoi ora usare il workflow per task reali:
1. Decompose user story reale
2. Analizza il tuo codebase
3. Ricevi prompt arricchito
4. Implementa con context completo

---

**Tempo totale setup**: ~5 minuti
**Pronto per**: Production testing
**Dashboard**: http://localhost:3000
