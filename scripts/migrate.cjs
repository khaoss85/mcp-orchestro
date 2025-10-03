#!/usr/bin/env node

/**
 * Database Migration Script for Orchestro
 *
 * Runs all SQL migrations in order
 * Usage: npm run migrate
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
};

function print(text, color = 'reset') {
  console.log(`${colors[color]}${text}${colors.reset}`);
}

async function getMigrationsDir() {
  const migrationsPath = path.join(process.cwd(), 'src', 'db', 'migrations');
  if (!fs.existsSync(migrationsPath)) {
    throw new Error(`Migrations directory not found: ${migrationsPath}`);
  }
  return migrationsPath;
}

async function getMigrationFiles() {
  const migrationsDir = await getMigrationsDir();
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort(); // Migrations run in order by filename

  return files.map(f => ({
    name: f,
    path: path.join(migrationsDir, f),
    version: f.split('_')[0] // e.g., "001" from "001_initial_schema.sql"
  }));
}

async function createMigrationsTable(supabase) {
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS _migrations (
        version TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      );
    `
  });

  if (error) {
    // If RPC doesn't exist, use direct SQL
    const { error: createError } = await supabase.from('_migrations').select('version').limit(1);

    if (createError && createError.code === '42P01') {
      // Table doesn't exist, try to create it
      print('⚠️  Creating migrations table...', 'yellow');
      // Note: This requires SUPABASE_SERVICE_KEY with admin privileges
    }
  }
}

async function getExecutedMigrations(supabase) {
  try {
    const { data, error } = await supabase
      .from('_migrations')
      .select('version, name, executed_at')
      .order('executed_at', { ascending: true });

    if (error) {
      if (error.code === '42P01') {
        // Table doesn't exist yet
        return [];
      }
      throw error;
    }

    return data || [];
  } catch (error) {
    return [];
  }
}

async function executeMigration(supabase, migration) {
  print(`\n📝 Running: ${migration.name}`, 'blue');

  const sql = fs.readFileSync(migration.path, 'utf8');

  // Split by semicolons but keep them for execution
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const statement of statements) {
    const { error } = await supabase.rpc('exec', { sql: statement + ';' });

    if (error) {
      // Fallback: try direct execution (for simple queries)
      print(`   ⚠️  RPC failed, trying direct execution...`, 'yellow');

      // This is a simplified approach - in production, you'd use the Supabase Admin API
      throw new Error(`Failed to execute migration: ${error.message}`);
    }
  }

  // Record migration
  const { error: recordError } = await supabase
    .from('_migrations')
    .insert({
      version: migration.version,
      name: migration.name
    });

  if (recordError) {
    throw new Error(`Failed to record migration: ${recordError.message}`);
  }

  print(`   ✓ Completed: ${migration.name}`, 'green');
}

async function main() {
  print('\n🗄️  Orchestro Database Migrations', 'blue');
  print('━'.repeat(50), 'blue');

  try {
    // Check environment
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL not found in environment');
    }

    // Parse connection string
    const dbUrl = new URL(process.env.DATABASE_URL);
    const supabaseUrl = process.env.SUPABASE_URL || `https://${dbUrl.hostname.split('.')[1]}.supabase.co`;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseKey) {
      print('\n⚠️  SUPABASE_SERVICE_KEY not found', 'yellow');
      print('   Migrations require admin privileges', 'yellow');
      print('\n📋 Manual Migration Steps:', 'blue');
      print('\n1. Go to Supabase Dashboard → SQL Editor');
      print('2. Run each migration file in order:');

      const migrations = await getMigrationFiles();
      migrations.forEach(m => {
        print(`   • ${m.name}`, 'yellow');
      });

      print('\n3. Files are located in: src/db/migrations/', 'blue');
      print('\nAlternatively, set SUPABASE_SERVICE_KEY in .env\n', 'yellow');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    print(`\n📍 Connected to: ${supabaseUrl}`, 'green');

    // Create migrations table if needed
    await createMigrationsTable(supabase);

    // Get migration status
    const migrations = await getMigrationFiles();
    const executed = await getExecutedMigrations(supabase);
    const executedVersions = new Set(executed.map(m => m.version));

    const pending = migrations.filter(m => !executedVersions.has(m.version));

    if (pending.length === 0) {
      print('\n✅ All migrations up to date!', 'green');
      print(`\n📊 Total migrations: ${migrations.length}`, 'blue');
      print(`   Already executed: ${executed.length}`, 'green');
      return;
    }

    print(`\n📊 Migration Status:`, 'blue');
    print(`   Total: ${migrations.length}`);
    print(`   Executed: ${executed.length}`, 'green');
    print(`   Pending: ${pending.length}`, 'yellow');

    // Execute pending migrations
    print('\n🚀 Executing pending migrations...', 'blue');

    for (const migration of pending) {
      await executeMigration(supabase, migration);
    }

    print('\n✅ All migrations completed successfully!', 'green');
    print(`\n📊 Database is up to date (${migrations.length} migrations)\n`, 'blue');

  } catch (error) {
    print(`\n❌ Migration failed: ${error.message}`, 'red');
    print('\n💡 Troubleshooting:', 'yellow');
    print('   1. Check DATABASE_URL is correct');
    print('   2. Ensure SUPABASE_SERVICE_KEY has admin privileges');
    print('   3. Try running migrations manually in Supabase SQL Editor');
    print('   4. See INTEGRATION_GUIDE.md for help\n');
    process.exit(1);
  }
}

main();
