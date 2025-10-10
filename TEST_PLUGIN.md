# 🧪 Test Plugin Marketplace Locale - Guida Rapida

## Setup Completato ✅

La struttura del plugin marketplace è pronta:
```
mcp-coder-expert/
├── .claude-plugin/marketplace.json    ✅ Validato
└── plugins/orchestro-suite/           ✅ Completo
    ├── .claude-plugin/plugin.json     ✅ Validato
    ├── .mcp.json                      ✅ Validato
    ├── agents/ (5 guardian agents)    ✅ Copiati
    └── README.md                      ✅ Documentato
```

## 🚀 Procedura di Test

### Opzione A: Test dalla Parent Directory (Consigliato)

```bash
# 1. Vai alla parent directory
cd /Users/pelleri/Documents

# 2. Avvia Claude Code
claude

# 3. Aggiungi il marketplace locale
/plugin marketplace add ./mcp-coder-expert

# 4. Verifica che sia stato aggiunto
/plugin marketplace list
# Dovresti vedere: orchestro-marketplace

# 5. Installa il plugin
/plugin install orchestro-suite@orchestro-marketplace

# 6. Riavvia Claude Code quando richiesto
```

### Opzione B: Test con Path Assoluto

```bash
# Da qualsiasi directory
claude

# Aggiungi con path assoluto
/plugin marketplace add /Users/pelleri/Documents/mcp-coder-expert

# Installa
/plugin install orchestro-suite@orchestro-marketplace
```

## ✅ Verifica Installazione

Dopo il riavvio, verifica che tutto funzioni:

### 1. Controlla Marketplace
```bash
/plugin marketplace list
```
**Aspettato**: `orchestro-marketplace` nella lista

### 2. Controlla Plugin Installato
```bash
/plugin
# Naviga a "Manage Plugins"
```
**Aspettato**: `orchestro-suite` (enabled) con descrizione e versione 2.1.0

### 3. Verifica Guardian Agents
```bash
/agents
```
**Aspettato**: 5 nuovi agenti:
- `database-guardian`
- `api-guardian`
- `architecture-guardian`
- `test-maintainer`
- `production-ready-code-reviewer`

### 4. Testa MCP Tools
```bash
# Info progetto
mcp__orchestro__get_project_info

# Lista task
mcp__orchestro__list_tasks

# User stories
mcp__orchestro__get_user_stories
```
**Aspettato**: Risposte JSON con dati Orchestro

### 5. Test Decomposizione
```bash
mcp__orchestro__decompose_story {
  "userStory": "Add export to CSV feature"
}
```
**Aspettato**: Creazione task con dipendenze

## 🐛 Troubleshooting

### Marketplace non trovato
**Errore**: `Marketplace not found`
**Soluzione**:
```bash
# Verifica che il file esista
ls -la /Users/pelleri/Documents/mcp-orchestro/.claude-plugin/

# Verifica JSON syntax
cat /Users/pelleri/Documents/mcp-orchestro/.claude-plugin/marketplace.json
```

### Plugin non si installa
**Errore**: `Plugin installation failed`
**Soluzione**:
```bash
# Verifica struttura plugin
ls -la /Users/pelleri/Documents/mcp-orchestro/plugins/orchestro-suite/

# Verifica JSON
cat /Users/pelleri/Documents/mcp-orchestro/plugins/orchestro-suite/.claude-plugin/plugin.json
```

### Guardian Agents non appaiono
**Problema**: `/agents` non mostra i guardian
**Soluzione**:
1. Riavvia Claude Code completamente
2. Verifica che il plugin sia "enabled": `/plugin`
3. Controlla che i file .md esistano:
   ```bash
   ls /Users/pelleri/Documents/mcp-orchestro/plugins/orchestro-suite/agents/
   ```

### MCP Tools non disponibili
**Problema**: `mcp__orchestro__*` non funzionano
**Soluzione**:
1. Verifica variabili ambiente:
   ```bash
   echo $SUPABASE_URL
   echo $SUPABASE_SERVICE_KEY
   echo $ANTHROPIC_API_KEY
   ```
2. Se mancano, aggiungile a `~/.zshrc`:
   ```bash
   export SUPABASE_URL="https://your-project.supabase.co"
   export SUPABASE_SERVICE_KEY="your-key"
   export ANTHROPIC_API_KEY="your-key"
   ```
3. Ricarica: `source ~/.zshrc`
4. Riavvia Claude Code

## 📊 Risultati Attesi

Se tutto funziona correttamente:
- ✅ Marketplace aggiunto
- ✅ Plugin installato
- ✅ 5 guardian agents disponibili
- ✅ 50+ MCP tools `mcp__orchestro__*` funzionanti
- ✅ Decomposizione user story operativa

## 🎉 Prossimi Passi

Una volta verificato il funzionamento locale:
1. Commit su GitHub
2. Altri utenti possono installare con: `/plugin marketplace add khaoss85/mcp-orchestro`

---

**Pronto per il test!** 🚀

Segui l'Opzione A dalla parent directory per iniziare.
