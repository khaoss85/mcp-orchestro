# Quick Start Guide - MCP Coder Expert

## 🚀 Setup Rapido (5 minuti)

### 1. Verifica che tutto sia running

```bash
# Dashboard dovrebbe essere già attiva
open http://localhost:3000

# Verifica build MCP server
cd /Users/pelleri/Documents/mcp-coder-expert
npm run build
```

✅ Se vedi la dashboard e build completa senza errori, sei pronto!

---

### 2. Configura Claude Code

**Apri il file di config**:
```bash
open ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**Aggiungi questa configurazione**:
```json
{
  "mcpServers": {
    "mcp-coder-expert": {
      "command": "/Users/pelleri/Documents/mcp-coder-expert/run-mcp-server.sh",
      "args": [],
      "env": {
        "SUPABASE_URL": "https://zjtiqmdhqtapxeidiubd.supabase.co",
        "SUPABASE_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqdGlxbWRocXRhcHhlaWRpdWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc5NzQ2MTAsImV4cCI6MjA1MzU1MDYxMH0.TDlAWJ8G4MXfMOAZcpx6oZmvX1dVNUVL6-V4kkdN-jw"
      }
    }
  }
}
```

**Riavvia Claude Code completamente**.

---

### 3. Test Base - Verifica Connessione

Apri Claude Code e chiedi:

```
Quali MCP tools hai disponibili per mcp-coder-expert?
```

**Dovresti vedere**:
- ✅ prepare_task_for_execution
- ✅ save_task_analysis
- ✅ get_execution_prompt
- ✅ decompose_story
- ✅ create_task
- ✅ update_task
- ✅ list_tasks
- ✅ get_task_context
- ✅ add_feedback
- ✅ get_similar_learnings
- ✅ save_dependencies
- ✅ get_task_dependency_graph
- ✅ get_resource_usage
- ✅ get_task_conflicts

---

### 4. Test Workflow Completo

Copia e incolla questo prompt in Claude Code:

```
Voglio testare il nuovo workflow di mcp-coder-expert.

User Story: "Come amministratore voglio poter bannare utenti dalla piattaforma"

Esegui questo workflow passo per passo:

FASE 1 - PLANNING:
1. Usa decompose_story per decomporre la user story in tasks
2. Crea ogni task usando create_task

FASE 2 - ANALYSIS PREPARATION:
3. Prendi il primo task e usa prepare_task_for_execution
4. Mostrami il prompt di analisi che hai ricevuto

FASE 3 - CODEBASE ANALYSIS:
5. Analizza il codebase seguendo il prompt:
   - Usa Grep per cercare i pattern suggeriti
   - Usa Read per leggere file rilevanti
   - Usa Glob per trovare file matching
6. Compila i risultati dell'analisi

FASE 4 - SAVE ANALYSIS:
7. Salva l'analisi usando save_task_analysis
8. Mostrami il messaggio di conferma

FASE 5 - GET ENRICHED PROMPT:
9. Usa get_execution_prompt per ottenere il prompt arricchito
10. Mostrami il prompt completo che hai ricevuto

FASE 6 - SUMMARY:
11. Elenca tutti i task creati con list_tasks
12. Dammi gli ID dei task così posso vederli nella dashboard

Esegui tutto il workflow e mostrami i risultati di ogni fase!
```

---

### 5. Verifica Dashboard

Mentre Claude Code lavora, apri:
**http://localhost:3000**

**Dovresti vedere in tempo reale**:
- 🔔 **Notifiche toast** per ogni task creato
- 📋 **Tasks nel Kanban board** (colonna Backlog)
- ⚡ **Updates istantanei** mentre Claude Code lavora

**Clicca su un task** per vedere:
- Tab **Overview**: Dettagli task
- Tab **History**: Timeline completa con tutti gli eventi
- Tab **Dependencies**: Grafo delle dipendenze (dopo analysis)

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
