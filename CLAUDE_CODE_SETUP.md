# Come Connettere Claude Code al MCP Coder Expert

## 🎯 Obiettivo
Configurare Claude Code per usare il nostro MCP server e testare il flusso completo:
User Story → Task Creation → Real-time Dashboard Updates

---

## 📋 Step 1: Verifica Prerequisiti

1. Claude Code è installato e funzionante
2. Dashboard web è attiva su http://localhost:3000
3. MCP server è compilato (directory `dist/` esiste)

---

## 🔧 Step 2: Aggiungi MCP Server a Claude Code

### Opzione A: Via Interfaccia Claude Code (Consigliata)

1. Apri Claude Code
2. Apri le impostazioni (Cmd/Ctrl + ,)
3. Cerca "MCP Servers" o "Model Context Protocol"
4. Aggiungi un nuovo server con questi parametri:

```json
{
  "mcp-coder-expert": {
    "command": "/Users/pelleri/Documents/mcp-coder-expert/run-mcp-server.sh",
    "args": [],
    "env": {}
  }
}
```

### Opzione B: Modifica Manuale Config

Percorso config file:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

Aggiungi al file:

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

---

## 🔄 Step 3: Riavvia Claude Code

Dopo aver aggiunto la configurazione:
1. Chiudi completamente Claude Code
2. Riapri Claude Code
3. Il server MCP dovrebbe caricarsi automaticamente

---

## ✅ Step 4: Verifica Connessione

### Test 1: Verifica Tools Disponibili

In Claude Code, chiedi:

```
Quali MCP tools hai disponibili per mcp-coder-expert?
```

**Risposta Attesa**: Claude dovrebbe elencare i tool:
- get_project_info
- create_task
- list_tasks
- update_task
- get_task_context
- decompose_story
- analyze_dependencies
- save_dependencies
- get_task_dependency_graph
- add_feedback
- list_templates
- list_patterns
- list_learnings

### Test 2: Crea un Task

In Claude Code, chiedi:

```
Usa mcp-coder-expert per creare un nuovo task:
- Titolo: "Implement user logout functionality"
- Descrizione: "Add logout button and clear session on logout"
- Status: backlog
```

**Cosa Aspettarsi**:
1. Claude Code chiama `create_task`
2. Task viene creato nel database
3. Event viene emesso via Socket.io
4. **Dashboard si aggiorna in real-time** mostrando il nuovo task!

---

## 🎬 Step 5: Test Flusso Completo

### Scenario: User Story → Tasks → Analysis → Execution

Chiedi a Claude Code:

```
Usando mcp-coder-expert, decomponi questa user story in tasks:

"Come utente voglio poter resettare la mia password via email"

Dopo aver decomposto:
1. Crea tutti i task nel sistema
2. Prepara il primo task per l'esecuzione
3. Analizza il codebase per trovare le dipendenze
4. Salva l'analisi
5. Ottieni il prompt di esecuzione arricchito
```

**Flusso Atteso (NUOVO DESIGN)**:

### 1. Planning Phase
**Claude Code chiama** `decompose_story`
- Input: User story
- Output: Lista di task suggeriti con dipendenze e complessità

**Claude Code chiama** `create_task` per ogni task
- Tasks creati nel database
- Eventi `task_created` emessi
- **Dashboard si aggiorna** in tempo reale (Kanban board + notifiche)

### 2. Analysis Preparation Phase
**Claude Code chiama** `prepare_task_for_execution(taskId)`
- Input: ID del primo task
- Output: Prompt strutturato che dice a Claude Code cosa cercare nel codebase
- Esempio: "Cerca pattern 'authenticate', 'hashPassword', controlla file src/routes/**/*.ts"

### 3. Codebase Analysis Phase (Claude Code usa i suoi tool)
**Claude Code analizza il codebase** usando:
- `Grep` per cercare pattern specifici
- `Read` per leggere file rilevanti
- `Glob` per trovare file matching

Claude Code raccoglie:
- File da modificare (con livello di rischio)
- File da creare
- Dipendenze (API, modelli, componenti)
- Rischi identificati (es. "modifica codice di autenticazione = rischio HIGH")
- Codice simile esistente da cui prendere spunto

### 4. Save Analysis Phase
**Claude Code chiama** `save_task_analysis(taskId, analysis)`
- Input: Task ID + risultati dell'analisi
- Azioni:
  - Salva dipendenze nel grafo (resource_nodes, resource_edges)
  - Salva rischi e raccomandazioni nel metadata del task
  - Emette eventi se ci sono rischi HIGH
  - **Dashboard si aggiorna**: task ora ha badge "Dependencies" e rischi visibili

### 5. Get Enriched Prompt Phase
**Claude Code chiama** `get_execution_prompt(taskId)`
- Input: Task ID
- Output: Prompt completo arricchito con:
  - File da modificare con livello di rischio
  - Dipendenze identificate
  - Rischi con strategie di mitigazione
  - Codice simile da cui prendere spunto
  - Pattern apprese da task simili passati
  - Best practices del progetto

### 6. Execution Phase
**Claude Code esegue il task** seguendo il prompt arricchito:
- Implementa le modifiche
- Chiama `record_decision` per scelte importanti
- Chiama `update_task` per aggiornare lo status
- Chiama `add_feedback` al completamento

### 7. Dashboard Real-Time
**Durante tutto il flusso, la dashboard mostra**:
- Tasks nel Kanban board
- Notifiche toast per ogni evento
- Tab "Dependencies" con grafo visuale
- Tab "History" con timeline completa
- Indicatori di rischio (🔴 HIGH, 🟡 MEDIUM, 🟢 LOW)

---

## 🐛 Troubleshooting

### MCP Server non si connette

**Verifica**:
```bash
# Test manuale del server
cd /Users/pelleri/Documents/mcp-coder-expert
./run-mcp-server.sh
```

Premi Ctrl+C per fermare.

Se vedi errori, controlla:
- `dist/` directory esiste (run `npm run build`)
- Permissions su `run-mcp-server.sh` (run `chmod +x run-mcp-server.sh`)

### Claude Code non vede i tools

1. Verifica config JSON è valida (nessun carattere extra)
2. Riavvia Claude Code completamente
3. Controlla log di Claude Code:
   - macOS: `~/Library/Logs/Claude/`
   - Windows: `%APPDATA%\Claude\logs\`

### Dashboard non si aggiorna

1. Verifica dashboard è aperta: http://localhost:3000
2. Controlla console browser per errori Socket.io
3. Verifica server Node è running (in background shell a99380)

---

## 📊 Monitoraggio Real-Time

### Dashboard
- **Kanban Board**: Tasks appaiono istantaneamente
- **Notifications**: Toast in alto a destra per ogni evento
- **Connection Status**: Pallino verde = connesso

### Database
Tasks, eventi, dipendenze sono persistiti in Supabase:
- Tasks: https://supabase.com/dashboard/project/zjtiqmdhqtapxeidiubd/editor/tasks
- Events: https://supabase.com/dashboard/project/zjtiqmdhqtapxeidiubd/editor/event_queue

---

## 🎯 Esempio Prompt Completo per Claude Code

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

**Risultato Atteso**:
- Tasks creati e visibili su http://localhost:3000
- Claude Code analizza il codebase usando i suoi tool nativi (non LLM interno al MCP)
- Dipendenze, rischi, e raccomandazioni salvate nel sistema
- Prompt arricchito disponibile per l'esecuzione
- Grafo dipendenze visibile nella dashboard
- History timeline completa
- Tutto aggiornato in real-time

---

## ✨ Next Steps

Dopo aver verificato che funziona:

1. **Workflow Automation**: Implementare LangGraph per orchestrazione automatica
2. **Guardian Integration**: Far intervenire i guardian automaticamente
3. **Memory System**: Far apprendere pattern da execuzioni passate
4. **Auto-Context**: Arricchimento automatico contesto da codebase

---

**Dashboard**: http://localhost:3000
**Codebase Explorer**: http://localhost:3000/codebase
**Task History**: http://localhost:3000/task/[id] (sostituisci [id] con task ID)
