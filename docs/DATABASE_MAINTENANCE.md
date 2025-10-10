# Database Schema Maintenance Guide

## 📋 Overview

Questo documento spiega come mantenere il database schema allineato con il codice ed evitare tabelle/colonne obsolete.

## 🔍 Strumenti Disponibili

### 1. **Schema Usage Analyzer**
Analizza il codice per trovare quali tabelle sono effettivamente usate.

```bash
npm run db:analyze
```

**Output:**
- Lista di tabelle usate con riferimenti nel codice
- Tabelle potenzialmente inutilizzate
- Aggiorna automaticamente il tracking nel database

### 2. **Schema Health Dashboard**
Visualizza lo stato di salute di tutte le tabelle.

```bash
npm run db:health
```

**Mostra:**
- Ultima volta che ogni tabella è stata acceduta
- Numero di accessi
- Stato di deprecazione
- Flag di "salute" (ACTIVE, UNUSED_30_DAYS, DEPRECATED, ecc.)

### 3. **Find Unused Elements**
Trova elementi del database non usati da N giorni.

```bash
npm run db:unused
```

**Default:** trova elementi non usati da 30+ giorni

## 🔄 Workflow di Manutenzione

### Step 1: Analisi Periodica
Esegui l'analisi settimanalmente o prima di ogni release:

```bash
npm run db:analyze
npm run db:health
```

### Step 2: Revisione degli Elementi Non Usati

```bash
npm run db:unused
```

Se trovi elementi non usati:

1. **Verifica nel codice** - potrebbero essere usati in modi non rilevati dall'analyzer
2. **Controlla le migration** - potrebbero essere tabelle legacy
3. **Valuta la rimozione** - se confermato inutilizzato

### Step 3: Processo di Deprecazione

Quando vuoi rimuovere una tabella:

```sql
-- 1. Marca come deprecated
INSERT INTO schema_deprecation (
  schema_type,
  schema_name,
  deprecation_reason,
  planned_removal_date,
  migration_path
) VALUES (
  'table',
  'old_table_name',
  'No longer needed after refactoring to new architecture',
  NOW() + INTERVAL '90 days', -- grace period
  'Migrate data to new_table_name using migration_script.sql'
);

-- 2. Dopo il periodo di grace, rimuovi
CREATE MIGRATION ... DROP TABLE old_table_name;
```

### Step 4: Pulizia Periodica

Ogni 3-6 mesi:

```sql
-- Trova tabelle deprecate da rimuovere
SELECT * FROM schema_deprecation
WHERE status = 'deprecated'
AND planned_removal_date < NOW();

-- Aggiorna status dopo rimozione
UPDATE schema_deprecation
SET status = 'removed'
WHERE schema_name = 'removed_table_name';
```

## 📊 Best Practices

### 1. **Sempre Deprecare Prima di Rimuovere**
```sql
-- ❌ NO - rimozione diretta
DROP TABLE old_table;

-- ✅ SI - deprecazione prima
INSERT INTO schema_deprecation (...);
-- wait grace period
DROP TABLE old_table;
```

### 2. **Documentare nelle Migration**
```sql
-- Migration: Remove deprecated table 'old_analytics'
-- Deprecated on: 2025-09-01
-- Reason: Replaced by new_analytics_v2
-- Data Migration: Already completed in migration 045

DROP TABLE old_analytics;
```

### 3. **Tracking Automatico nel Codice**

Aggiungi tracking nelle query frequenti:

```typescript
// Prima di query importanti
await supabase.rpc('record_schema_access', {
  p_schema_type: 'table',
  p_schema_name: 'critical_table',
  p_accessed_by: 'api_endpoint:/v1/analytics'
});

// Poi esegui la query
const { data } = await supabase.from('critical_table').select('*');
```

### 4. **CI/CD Integration**

Aggiungi al tuo CI pipeline:

```yaml
# .github/workflows/schema-check.yml
- name: Check Schema Health
  run: |
    npm run db:analyze
    npm run db:unused
  # Fail se ci sono troppe tabelle non usate
```

## 🚨 Alert e Monitoring

### Configurazione Alert
Crea una scheduled function in Supabase:

```sql
-- Alert se tabelle non usate da 60+ giorni
CREATE OR REPLACE FUNCTION check_unused_tables_alert()
RETURNS void AS $$
DECLARE
  unused_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO unused_count
  FROM schema_usage_tracking
  WHERE last_accessed < NOW() - INTERVAL '60 days'
  AND schema_type = 'table';

  IF unused_count > 0 THEN
    -- Invia notifica (webhook, email, etc.)
    RAISE NOTICE 'ALERT: % tables unused for 60+ days', unused_count;
  END IF;
END;
$$ LANGUAGE plpgsql;
```

## 📈 Metriche da Monitorare

1. **Copertura dello Schema**
   - % di tabelle tracked vs totali
   - Target: >95%

2. **Freshness**
   - Età media dell'ultimo accesso
   - Target: <7 giorni per tabelle core

3. **Obsolescenza**
   - Numero di tabelle non usate da 30+ giorni
   - Target: <5%

4. **Deprecation Pipeline**
   - Tempo medio da deprecation a removal
   - Target: 90 giorni

## 🔧 Risoluzione Problemi

### "Tabella appare non usata ma è necessaria"
- Aggiungi tracking manuale nel codice
- Verifica query dinamiche non rilevate dall'analyzer
- Documenta in `schema_usage_tracking.accessed_by`

### "Troppe false positives"
- Migliora i pattern nell'analyzer
- Aggiungi tracking esplicito nelle parti critiche
- Usa commenti SQL nel codice per hint

### "Come testare prima della rimozione?"
1. Marca come deprecated
2. Monitor per 30+ giorni
3. Verifica logs e metriche
4. Rimuovi se nessun errore

## 📝 Checklist Pre-Rimozione

Prima di rimuovere una tabella/colonna:

- [ ] Analisi codice completata (`npm run db:analyze`)
- [ ] Non usata da 90+ giorni
- [ ] Marcata come deprecated da 30+ giorni
- [ ] Migration path documentata
- [ ] Backup dei dati esistenti
- [ ] Team notificato
- [ ] Tests passano senza la tabella
- [ ] Rollback plan pronto

## 🔗 Risorse

- [Migrations Guide](./migrations/)
- [Supabase Schema Design](https://supabase.com/docs/guides/database/schema)
- [PostgreSQL Best Practices](https://wiki.postgresql.org/wiki/Don%27t_Do_This)
