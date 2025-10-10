# Intelligent Story Decomposition Workflow

## Problema Risolto

Il workflow originale `decompose_story` decomponeva user stories usando un LLM call diretto con:
- ❌ Tech stack hardcoded nel prompt
- ❌ Nessuna esplorazione della codebase reale
- ❌ Task generici senza file paths concreti
- ❌ Dipendenze stimate senza contesto

## Nuovo Workflow Intelligente

### Overview

Il nuovo workflow usa un approccio a 2 fasi dove **Claude Code analizza la codebase PRIMA** di creare i task:

```
User Story
  ↓
intelligent_decompose_story (genera prompt)
  ↓
Claude Code analizza codebase (Grep/Glob/Read)
  ↓
save_story_decomposition (salva risultati)
  ↓
Task creati con contesto reale
```

## Strumenti Implementati

### 1. `intelligent_decompose_story`

**Scopo**: Genera un prompt strutturato per guidare Claude Code nell'analisi della codebase.

**Input**:
```json
{
  "userStory": "User should be able to...",
  "projectId": "optional-project-id"
}
```

**Output**:
```json
{
  "success": true,
  "prompt": "# INTELLIGENT USER STORY DECOMPOSITION\n...",
  "workflowInstructions": {...},
  "projectId": "project-uuid",
  "nextSteps": "..."
}
```

**Cosa fa**:
1. Recupera configurazione progetto (tech stack, guidelines, pattern)
2. Costruisce prompt ricco di contesto per Claude Code
3. Guida Claude Code nell'uso di Grep/Glob/Read per esplorare il codebase
4. Ritorna istruzioni chiare sul prossimo step

### 2. `save_story_decomposition`

**Scopo**: Salva i risultati dell'analisi di Claude Code dopo l'esplorazione della codebase.

**Input**:
```json
{
  "userStory": "Original user story",
  "projectId": "optional",
  "analysis": {
    "tasks": [
      {
        "title": "Task title",
        "description": "Detailed description with real file paths",
        "complexity": "simple|medium|complex",
        "estimatedHours": 3,
        "dependencies": ["Other task title"],
        "tags": ["backend", "api"],
        "category": "backend_database",
        "filesToModify": [
          {
            "path": "src/components/UserProfile.tsx",
            "reason": "Add preferences section",
            "risk": "low"
          }
        ],
        "filesToCreate": [
          {
            "path": "src/hooks/useUserPreferences.ts",
            "reason": "New hook for state management"
          }
        ],
        "codebaseReferences": [
          {
            "file": "src/components/Settings.tsx",
            "description": "Similar pattern",
            "lines": "45-78"
          }
        ]
      }
    ],
    "overallComplexity": "medium",
    "totalEstimatedHours": 12,
    "architectureNotes": ["Following React hooks pattern"],
    "risks": [
      {
        "level": "medium",
        "description": "Component used in 15 places",
        "mitigation": "Add tests and backward compatibility"
      }
    ],
    "recommendations": ["Consider shared context"]
  }
}
```

**Output**:
```json
{
  "success": true,
  "userStory": {...},
  "tasks": [...],
  "totalTasks": 5,
  "totalEstimatedHours": 12,
  "nextSteps": {...},
  "message": "✅ User story decomposed into 5 tasks with real codebase context!"
}
```

## Workflow Completo - Esempio

### Step 1: Avvia l'analisi intelligente

```typescript
// Claude Code riceve:
mcp__orchestro__intelligent_decompose_story({
  userStory: "User should be able to export their data to CSV format"
})

// Ritorna:
{
  prompt: "# INTELLIGENT USER STORY DECOMPOSITION...",
  nextSteps: "Claude Code: analyze the codebase with Grep/Glob/Read"
}
```

### Step 2: Claude Code analizza la codebase

Claude Code usa i suoi tool:
```typescript
// Cerca feature simili
Grep("pattern": "export.*csv", "output_mode": "files_with_matches")

// Trova componenti esistenti
Glob("pattern": "**/*Export*.tsx")

// Legge implementazioni esistenti
Read("file_path": "src/utils/exportUtils.ts")
```

### Step 3: Claude Code decompose con contesto reale

Dopo l'analisi, Claude Code crea la struttura JSON con:
- **File paths reali** trovati nel progetto
- **Dipendenze accurate** basate su import/export
- **Stime realistiche** basate su complessità del codice
- **Pattern esistenti** da seguire
- **Rischi identificati** (es. file con molte dipendenze)

### Step 4: Salva la decomposizione

```typescript
mcp__orchestro__save_story_decomposition({
  userStory: "User should be able to export...",
  analysis: {
    tasks: [...], // Task con contesto reale
    totalEstimatedHours: 8,
    architectureNotes: ["Reuse existing exportUtils", "Follow CSV pattern in ReportsExport"],
    risks: [...]
  }
})
```

## Vantaggi vs Vecchio Workflow

| Aspetto | decompose_story (vecchio) | intelligent_decompose_story (nuovo) |
|---------|-------------------------|-------------------------------------|
| Contesto codebase | ❌ Tech stack hardcoded | ✅ Analisi reale con Grep/Glob/Read |
| File paths | ❌ Generici | ✅ Path reali dal progetto |
| Dipendenze | ❌ Stimate | ✅ Basate su import/export reali |
| Stime | ❌ Generiche | ✅ Basate su complessità reale |
| Pattern | ❌ Nessuno | ✅ Pattern esistenti identificati |
| Rischi | ❌ Non identificati | ✅ Rischi concreti (es. file con 50 dipendenze) |
| Workflow | 1 fase (LLM call diretto) | 2 fasi (analisi + decomposizione) |

## Quando Usare Quale?

### Usa `decompose_story` (vecchio) quando:
- ✅ Hai bisogno di decomposizione rapida
- ✅ Il progetto è nuovo senza codebase esistente
- ✅ Non serve contesto approfondito

### Usa `intelligent_decompose_story` (nuovo) quando:
- ✅ Hai una codebase esistente da esplorare
- ✅ Vuoi task con file paths reali
- ✅ Serve identificare rischi e dipendenze accurate
- ✅ Vuoi stime basate su complessità reale
- ✅ Vuoi seguire pattern esistenti nel progetto

## Esempio Output Comparativo

### decompose_story (vecchio):
```json
{
  "title": "Create CSV export functionality",
  "description": "Implement CSV export for user data",
  "complexity": "medium",
  "estimatedHours": 4,
  "dependencies": [],
  "tags": ["backend", "export"]
}
```

### intelligent_decompose_story (nuovo):
```json
{
  "title": "Extend exportUtils with CSV formatter for user data",
  "description": "Add new CSVFormatter class in src/utils/exportUtils.ts following the existing PDFFormatter pattern. Support user data fields: id, name, email, createdAt, preferences. Handle large datasets (>10k rows) with streaming.",
  "complexity": "medium",
  "estimatedHours": 3,
  "dependencies": ["Update UserService to expose getAllUsersStream method"],
  "tags": ["backend", "export", "csv"],
  "category": "backend_database",
  "filesToModify": [
    {
      "path": "src/utils/exportUtils.ts",
      "reason": "Add CSVFormatter class following PDFFormatter pattern (lines 120-180)",
      "risk": "low"
    },
    {
      "path": "src/services/UserService.ts",
      "reason": "Add getAllUsersStream method for large datasets",
      "risk": "medium"
    }
  ],
  "filesToCreate": [
    {
      "path": "src/utils/csv/CSVStream.ts",
      "reason": "Streaming helper for large CSV exports (>10k rows)"
    }
  ],
  "codebaseReferences": [
    {
      "file": "src/utils/exportUtils.ts",
      "description": "Existing PDFFormatter pattern to follow",
      "lines": "120-180"
    },
    {
      "file": "src/components/Reports/ReportsExport.tsx",
      "description": "UI pattern for export button and progress",
      "lines": "45-92"
    }
  ]
}
```

## Integrazione con TodoList

I task creati da `save_story_decomposition` vengono automaticamente salvati in Orchestro e possono essere sincronizzati con la TodoList di Claude Code per tracking visivo.

## Next Steps

1. ✅ Tool implementati e testati
2. ⏳ Testare workflow con user story reale
3. ⏳ Aggiornare dashboard web per mostrare metadati enriched
4. ⏳ Aggiungere visualizzazione file paths e dipendenze reali

## File Modificati

- `src/tools/intelligentDecompose.ts` - Nuovi tool (creato)
- `src/server.ts` - Registrazione tool MCP (aggiornato)
- Compilation: ✅ TypeScript OK
