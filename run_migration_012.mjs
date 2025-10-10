#!/usr/bin/env node

import { readFileSync } from 'fs';
import { getSupabaseClient } from './dist/db/supabase.js';

async function runMigration() {
  console.log('📦 Running Migration 012: Project Configuration System\n');

  try {
    const supabase = getSupabaseClient();

    // Read migration file
    const migrationSQL = readFileSync('src/db/migrations/012_project_configuration_system.sql', 'utf-8');

    console.log('🔄 Executing migration SQL...');

    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: migrationSQL
    });

    if (error) {
      // Try direct execution if rpc doesn't work
      console.log('⚠️  RPC failed, trying direct execution...');

      // Split by semicolons and execute each statement
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        const result = await supabase.from('__migrations').select('*').limit(1); // dummy query to test
        if (result.error) {
          console.error('❌ Error:', result.error);
        }
      }

      console.log('\n⚠️  Manual migration required!');
      console.log('Please run the migration SQL in Supabase SQL Editor:');
      console.log('src/db/migrations/012_project_configuration_system.sql');
    } else {
      console.log('✅ Migration 012 executed successfully!');
      console.log('Result:', data);
    }
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('\n📝 Please apply migration manually via Supabase SQL Editor:');
    console.log('   Copy contents of: src/db/migrations/012_project_configuration_system.sql');
  }
}

runMigration().catch(console.error);
