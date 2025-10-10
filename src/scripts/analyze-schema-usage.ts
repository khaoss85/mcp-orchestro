#!/usr/bin/env node
/**
 * Schema Usage Analyzer
 * Scans codebase to find which database tables/columns are actually used
 * Helps identify obsolete schema elements
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface SchemaElement {
  type: 'table' | 'column' | 'function' | 'view';
  name: string;
  parentName?: string;
  foundIn: string[];
  accessCount: number;
}

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

// Tables we expect to find in the schema
const EXPECTED_TABLES = [
  'projects',
  'tasks',
  'task_dependencies',
  'templates',
  'patterns',
  'learnings',
  'resource_nodes',
  'resource_edges',
  'code_entities',
  'code_dependencies',
  'file_history',
  'codebase_analysis',
  'event_queue',
  'pattern_frequency',
  'schema_usage_tracking',
  'schema_deprecation'
];

/**
 * Recursively scan directory for TypeScript/JavaScript files
 */
function scanDirectory(dir: string, fileList: string[] = []): string[] {
  const files = readdirSync(dir);

  files.forEach((file) => {
    const filePath = join(dir, file);
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules, dist, and hidden directories
      if (!file.startsWith('.') && file !== 'node_modules' && file !== 'dist') {
        scanDirectory(filePath, fileList);
      }
    } else if (file.match(/\.(ts|js|mjs)$/)) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

/**
 * Extract table references from SQL queries in code
 */
function findTableReferences(content: string, filePath: string): Map<string, Set<string>> {
  const references = new Map<string, Set<string>>();

  // Patterns to match SQL table references
  const patterns = [
    // FROM/JOIN clauses
    /(?:FROM|JOIN)\s+([a-z_]+)/gi,
    // INSERT INTO
    /INSERT\s+INTO\s+([a-z_]+)/gi,
    // UPDATE
    /UPDATE\s+([a-z_]+)/gi,
    // DELETE FROM
    /DELETE\s+FROM\s+([a-z_]+)/gi,
    // Supabase client calls: .from('table_name')
    /\.from\s*\(\s*['"`]([a-z_]+)['"`]\s*\)/gi,
    // Direct table names in queries
    /(['"`])([a-z_]+)\1\s*(?:WHERE|SET|VALUES)/gi,
  ];

  patterns.forEach((pattern) => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const tableName = match[1] || match[2];
      if (EXPECTED_TABLES.includes(tableName)) {
        if (!references.has(tableName)) {
          references.set(tableName, new Set());
        }
        references.get(tableName)!.add(filePath);
      }
    }
  });

  return references;
}

/**
 * Analyze codebase for schema usage
 */
async function analyzeSchemaUsage() {
  console.log('🔍 Analyzing schema usage in codebase...\n');

  const projectRoot = join(__dirname, '../..');
  const files = scanDirectory(join(projectRoot, 'src'));

  const allReferences = new Map<string, Set<string>>();

  // Scan all files
  files.forEach((filePath) => {
    const content = readFileSync(filePath, 'utf-8');
    const refs = findTableReferences(content, filePath.replace(projectRoot + '/', ''));

    refs.forEach((files, table) => {
      if (!allReferences.has(table)) {
        allReferences.set(table, new Set());
      }
      files.forEach((file) => allReferences.get(table)!.add(file));
    });
  });

  // Report findings
  console.log('📊 Schema Usage Report\n');
  console.log('=' .repeat(80));

  const usedTables = new Set(allReferences.keys());
  const unusedTables = EXPECTED_TABLES.filter((t) => !usedTables.has(t));

  console.log('\n✅ USED TABLES:');
  allReferences.forEach((files, table) => {
    console.log(`\n  ${table} (${files.size} references)`);
    files.forEach((file) => console.log(`    - ${file}`));
  });

  if (unusedTables.length > 0) {
    console.log('\n\n⚠️  POTENTIALLY UNUSED TABLES:');
    unusedTables.forEach((table) => {
      console.log(`  - ${table}`);
    });
  }

  // Update database tracking
  if (supabase) {
    console.log('\n\n💾 Updating schema usage tracking in database...');

    for (const [table, files] of allReferences) {
      await supabase.rpc('record_schema_access', {
        p_schema_type: 'table',
        p_schema_name: table,
        p_parent_name: null,
        p_accessed_by: `code_scan:${files.size}_files`,
      });
    }

    console.log('✅ Database tracking updated');
  } else {
    console.log('\n\n⚠️  Supabase not configured - skipping database tracking update');
    console.log('   Set SUPABASE_URL and SUPABASE_SERVICE_KEY to enable tracking');
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log(`\n📈 SUMMARY:`);
  console.log(`  Total tables in schema: ${EXPECTED_TABLES.length}`);
  console.log(`  Tables found in code: ${usedTables.size}`);
  console.log(`  Potentially unused: ${unusedTables.length}`);
  console.log(`  Total files scanned: ${files.length}\n`);

  // Return exit code based on findings
  if (unusedTables.length > 0) {
    console.log('⚠️  Warning: Some tables appear unused. Review before removal.\n');
    process.exit(0); // Don't fail, just warn
  } else {
    console.log('✅ All tables are actively used in the codebase.\n');
  }
}

// Run analysis
analyzeSchemaUsage().catch((error) => {
  console.error('❌ Error analyzing schema usage:', error);
  process.exit(1);
});
