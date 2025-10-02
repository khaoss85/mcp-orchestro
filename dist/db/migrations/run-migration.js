#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
const __dirname = dirname(fileURLToPath(import.meta.url));
async function runMigration() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
        process.exit(1);
    }
    // Use service role key for DDL operations
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
            persistSession: false,
        },
    });
    console.log('🚀 Running database migration: 001_initial_schema.sql');
    const migrationSQL = readFileSync(join(__dirname, '001_initial_schema.sql'), 'utf-8');
    try {
        // Execute the migration
        const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
        if (error) {
            console.error('❌ Migration failed:', error.message);
            process.exit(1);
        }
        console.log('✅ Migration completed successfully!');
        // Verify tables were created
        const { data: tables, error: tablesError } = await supabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_schema', 'public');
        if (tablesError) {
            console.error('⚠️  Could not verify tables:', tablesError.message);
        }
        else {
            console.log('\n📊 Tables created:');
            tables?.forEach((t) => console.log(`  - ${t.table_name}`));
        }
    }
    catch (error) {
        console.error('❌ Unexpected error:', error);
        process.exit(1);
    }
}
runMigration();
