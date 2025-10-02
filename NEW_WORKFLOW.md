# Nuovo Workflow MCP Coder Expert

## 🎯 Principio Chiave

**MCP Server = Orchestratore, NON Analizzatore**

Il MCP server non ha accesso diretto al codebase. Solo Claude Code può leggere, cercare e analizzare il codice.

---

## 🔄 Flusso Completo

```
┌─────────────────────────────────────────────────────────┐
│           CLAUDE CODE (AI Agent)                         │
│  - Ha accesso al codebase (Read, Grep, Glob)            │
│  - Può analizzare codice, cercare pattern, leggere file │
│  - Esegue le implementazioni                            │
└─────────────────────────────────────────────────────────┘
                        ↓ ↑ (MCP Tools via stdio)
┌─────────────────────────────────────────────────────────┐
│           MCP SERVER (Task Manager)                      │
│  - Gestisce task nel database                           │
│  - Fornisce prompt strutturati                          │
│  - Salva analisi e dipendenze                           │
│  - Genera prompt arricchiti                             │
│  - NON ha accesso al codebase                           │
└─────────────────────────────────────────────────────────┘
                        ↓ ↑
┌─────────────────────────────────────────────────────────┐
│           SUPABASE DATABASE                              │
│  - Tasks, dipendenze, eventi                            │
│  - Resource graph (nodes + edges)                       │
│  - Knowledge base (patterns, learnings)                 │
└─────────────────────────────────────────────────────────┘
                        ↓ (Socket.io polling)
┌─────────────────────────────────────────────────────────┐
│           WEB DASHBOARD (Real-time UI)                   │
│  - Kanban board                                          │
│  - Task detail con tabs (Overview/History/Dependencies) │
│  - Notifiche real-time                                  │
└─────────────────────────────────────────────────────────┘
```

---

## 📋 Step-by-Step Workflow

### 1. Planning Phase

**User → Claude Code**:
```
Decomponi questa user story: "User login con email e password"
```

**Claude Code → MCP**:
```typescript
decompose_story({ userStory: "..." })
```

**MCP → Claude Code** (risposta):
```json
{
  "tasks": [
    {
      "id": "temp-1",
      "title": "Setup database schema for users",
      "description": "Create users table with email, password_hash",
      "complexity": "medium",
      "dependencies": []
    },
    // ... altri task
  ]
}
```

**Claude Code → MCP** (per ogni task):
```typescript
create_task({
  title: "...",
  description: "...",
  status: "backlog",
  dependencies: []
})
```

**MCP → Database**:
- Salva task
- Emette evento `task_created`

**Database → Dashboard** (via Socket.io):
- Kanban board si aggiorna
- Notifica toast appare

---

### 2. Analysis Preparation Phase

**Claude Code → MCP**:
```typescript
prepare_task_for_execution({ taskId: "abc-123" })
```

**MCP** (internamente):
1. Carica il task dal database
2. Cerca learnings simili nel knowledge base
3. Genera search patterns basati su keywords del task
4. Genera file patterns da controllare
5. Genera risk checks specifici

**MCP → Claude Code** (risposta):
```json
{
  "taskId": "abc-123",
  "taskTitle": "Setup database schema for users",
  "taskDescription": "...",
  "prompt": "# Task Analysis Request\n\n## Your Mission\nAnalizza il codebase per preparare questo task...\n\n## 1. Search Patterns\n- CREATE TABLE\n- migration\n- schema\n\n## 2. File Locations to Check\n- src/db/migrations/*.sql\n- prisma/schema.prisma\n\n## 3. Risks to Identify\n- Check for existing migrations that might conflict\n- Verify foreign key constraints\n\n## 4. Expected Output\nCall save_task_analysis with this structure:\n{ ... }",
  "searchPatterns": ["CREATE TABLE", "migration", ...],
  "filesToCheck": ["src/db/**/*.sql", ...],
  "risksToIdentify": ["Check for existing migrations", ...]
}
```

---

### 3. Codebase Analysis Phase

**Claude Code** (usando i suoi tool nativi):

```typescript
// 1. Cerca pattern nel codebase
Grep({ pattern: "CREATE TABLE", path: "." })
Grep({ pattern: "migration", path: "src/db" })

// 2. Leggi file rilevanti
Read({ file_path: "src/db/migrations/001_initial.sql" })
Read({ file_path: "prisma/schema.prisma" })

// 3. Trova file matching
Glob({ pattern: "src/db/**/*.sql" })

// 4. Analizza i risultati e compila l'analisi
```

Claude Code raccoglie:
- **filesToModify**: `[{ path: "prisma/schema.prisma", reason: "Needs User model", risk: "medium" }]`
- **filesToCreate**: `[{ path: "src/db/migrations/002_users.sql", reason: "New migration" }]`
- **dependencies**:
  - `{ type: "file", name: "001_initial.sql", path: "...", action: "uses" }`
  - `{ type: "model", name: "User", path: "...", action: "creates" }`
- **risks**:
  - `{ level: "high", description: "Migration order matters", mitigation: "Ensure 001 runs first" }`
- **relatedCode**:
  - `{ file: "src/models/Session.ts", description: "Similar auth model", lines: "10-50" }`
- **recommendations**:
  - `"Use bcrypt for password hashing"`
  - `"Add unique index on email"`

---

### 4. Save Analysis Phase

**Claude Code → MCP**:
```typescript
save_task_analysis({
  taskId: "abc-123",
  analysis: {
    filesToModify: [...],
    filesToCreate: [...],
    dependencies: [...],
    risks: [...],
    relatedCode: [...],
    recommendations: [...]
  }
})
```

**MCP** (internamente):
1. Salva ogni dependency come resource_node nel database
2. Crea resource_edge da task a ogni risorsa
3. Salva analysis metadata nel campo `metadata` del task
4. Se ci sono HIGH risks → emette evento `guardian_intervention`
5. Emette evento `task_updated` (analysis_completed)

**Database → Dashboard**:
- Task ora ha badge "Dependencies (3)"
- Tab "Dependencies" mostra il grafo
- Se HIGH risk → notifica rossa appare

---

### 5. Get Enriched Prompt Phase

**Claude Code → MCP**:
```typescript
get_execution_prompt({ taskId: "abc-123" })
```

**MCP** (internamente):
1. Carica task analysis dal metadata
2. Carica dependencies dal resource graph
3. Cerca similar learnings nel knowledge base
4. Carica project guidelines
5. Costruisce prompt arricchito

**MCP → Claude Code** (risposta):
```json
{
  "taskId": "abc-123",
  "taskTitle": "Setup database schema for users",
  "taskDescription": "...",
  "prompt": "# Implementation Task\n\n## Files to Modify\n🟡 prisma/schema.prisma - Needs User model\n\n## Files to Create\n- src/db/migrations/002_users.sql\n\n## ⚠️ Risks\n🔴 HIGH: Migration order matters\n  Mitigation: Ensure 001 runs first\n\n## 📚 Related Code\n- src/models/Session.ts (lines 10-50) - Similar auth model\n\n## 💡 Recommendations\n- Use bcrypt for password hashing\n- Add unique index on email\n\n## 🎓 Learnings\n1. Previous auth implementations used argon2\n2. Remember to add created_at/updated_at timestamps\n\n## Implementation Steps\n1. Read prisma/schema.prisma\n2. Add User model\n3. Create migration file\n4. Test with `prisma migrate dev`\n5. Record decisions with record_decision\n6. Update task status with update_task\n7. Add feedback with add_feedback",
  "context": {
    "dependencies": [...],
    "risks": [...],
    "relatedCode": [...],
    "recommendations": [...],
    "patterns": [...],
    "guidelines": [...]
  }
}
```

---

### 6. Execution Phase

**Claude Code** (segue il prompt arricchito):

```typescript
// 1. Leggi file
Read({ file_path: "prisma/schema.prisma" })

// 2. Implementa modifiche
Edit({
  file_path: "prisma/schema.prisma",
  old_string: "...",
  new_string: "model User { ... }"
})

// 3. Crea nuovo file
Write({
  file_path: "src/db/migrations/002_users.sql",
  content: "CREATE TABLE users ..."
})

// 4. Registra decisione importante
record_decision({
  taskId: "abc-123",
  decision: "Use bcrypt for password hashing",
  rationale: "Industry standard, well-tested",
  timestamp: "...",
  actor: "claude"
})

// 5. Testa
Bash({ command: "npx prisma migrate dev" })

// 6. Aggiorna status
update_task({
  id: "abc-123",
  status: "done"
})

// 7. Aggiungi feedback
add_feedback({
  taskId: "abc-123",
  feedback: "Successfully created users table. Bcrypt integration worked smoothly.",
  type: "success",
  pattern: "database_schema_creation",
  tags: ["auth", "migration"]
})
```

**MCP → Database**:
- Eventi registrati: decision_made, status_transition, feedback_received
- Task status aggiornato

**Database → Dashboard**:
- Task si sposta nella colonna "Done"
- Tab "History" mostra timeline completa:
  - ✅ Task created
  - 🔍 Analysis completed (3 dependencies, 1 HIGH risk)
  - 💡 Decision: Use bcrypt
  - 🔄 Status: backlog → in_progress
  - 🔄 Status: in_progress → done
  - 📚 Feedback: Success message

---

## 🆕 Nuovi MCP Tools

### 1. `prepare_task_for_execution`

**Input**:
```typescript
{ taskId: string }
```

**Output**:
```typescript
{
  taskId: string;
  taskTitle: string;
  taskDescription: string;
  prompt: string; // Markdown prompt strutturato
  searchPatterns: string[];
  filesToCheck: string[];
  risksToIdentify: string[];
}
```

**Scopo**: Genera un prompt strutturato che dice a Claude Code esattamente cosa cercare nel codebase.

---

### 2. `save_task_analysis`

**Input**:
```typescript
{
  taskId: string;
  analysis: {
    filesToModify: Array<{ path, reason, risk }>;
    filesToCreate: Array<{ path, reason }>;
    dependencies: Array<{ type, name, path, action }>;
    risks: Array<{ level, description, mitigation }>;
    relatedCode: Array<{ file, description, lines? }>;
    recommendations: string[];
  }
}
```

**Output**:
```typescript
{
  success: boolean;
  message: string;
}
```

**Scopo**: Salva i risultati dell'analisi fatta da Claude Code nel database.

---

### 3. `get_execution_prompt`

**Input**:
```typescript
{ taskId: string }
```

**Output**:
```typescript
{
  taskId: string;
  taskTitle: string;
  taskDescription: string;
  prompt: string; // Markdown prompt arricchito
  context: {
    dependencies: any[];
    risks: any[];
    relatedCode: any[];
    recommendations: string[];
    patterns: any[];
    guidelines: string[];
  }
}
```

**Scopo**: Genera un prompt completo arricchito con tutto il contesto necessario per implementare il task.

---

## 📊 Vantaggi del Nuovo Design

### 1. **Separation of Concerns**
- MCP: orchestrazione e persistenza
- Claude Code: analisi codebase
- Nessuna duplicazione di funzionalità

### 2. **Context Awareness**
- Claude Code vede il codebase completo
- Può fare analisi più accurate
- Non limitato a euristics o LLM interni

### 3. **Structured Guidance**
- MCP fornisce struttura e best practices
- Claude Code riempie i dettagli specifici
- Workflow consistente e ripetibile

### 4. **Tracciabilità Completa**
- Tutte le decisioni registrate
- Timeline completa nella dashboard
- Grafo delle dipendenze visibile

### 5. **Real-time Feedback**
- Dashboard aggiornata istantaneamente
- Eventi visibili in tempo reale
- Notifiche per rischi HIGH

---

## 🧪 Test del Workflow

Per testare il nuovo workflow, usa questo prompt in Claude Code:

```
Ciao! Voglio testare il nuovo flusso completo del mcp-coder-expert.

User Story: "Come amministratore voglio poter bannare utenti dalla piattaforma"

Per favore esegui questo workflow:

1. Decomponi la storia in tasks usando decompose_story
2. Crea ogni task usando create_task
3. Per il primo task:
   a. Prepara il task per l'esecuzione con prepare_task_for_execution
   b. Analizza il codebase seguendo il prompt che ricevi (usa Grep, Read, Glob)
   c. Salva l'analisi con save_task_analysis
   d. Ottieni il prompt di esecuzione arricchito con get_execution_prompt
4. Mostrami il prompt arricchito che hai ricevuto
5. Elenca tutti i task creati con list_tasks

Fammi sapere l'ID del primo task così posso aprirlo nella dashboard!
```

**Cosa Aspettarsi**:
- Tasks visibili su http://localhost:3000
- Claude Code analizza usando Grep/Read/Glob (non LLM interno)
- Dipendenze salvate nel grafo
- Prompt arricchito disponibile
- Timeline completa nella dashboard
- Tutto aggiornato in real-time

---

## 🔧 File Modificati

1. **Nuovi File**:
   - `src/tools/taskPreparation.ts` - prepare_task_for_execution
   - `src/tools/taskAnalysis.ts` - save_task_analysis, get_execution_prompt

2. **File Modificati**:
   - `src/tools/dependencies.ts` - Rimosso analyzeDependencies (deprecated)
   - `src/server.ts` - Registrati 3 nuovi tool
   - `CLAUDE_CODE_SETUP.md` - Aggiornato con nuovo workflow

3. **Build**:
   - `npm run build` ✅ Success
   - Server pronto per essere testato

---

## ✅ Prossimi Step

1. Configura Claude Code con MCP server (vedi CLAUDE_CODE_SETUP.md)
2. Testa il workflow con il prompt sopra
3. Verifica dashboard su http://localhost:3000
4. Controlla che tutti gli eventi appaiano in real-time
5. Ispeziona il grafo delle dipendenze nella tab Dependencies
6. Verifica la timeline nella tab History

Buon testing! 🚀
