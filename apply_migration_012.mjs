#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { readFileSync } from 'fs';

async function applyMigration() {
  console.log('📦 Applying Migration 012: Project Configuration System\n');

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/server.js'],
  });

  const client = new Client(
    {
      name: 'migration-client',
      version: '1.0.0',
    },
    {
      capabilities: {},
    }
  );

  try {
    await client.connect(transport);
    console.log('✅ Connected to MCP server\n');

    // Read migration file
    const migrationSQL = readFileSync('src/db/migrations/012_project_configuration_system.sql', 'utf-8');

    console.log('🔄 Applying migration 012...');

    // Note: We need to use execute_sql directly since apply_migration expects a name
    // For this complex migration, we'll execute it directly
    const result = await client.callTool({
      name: 'execute_sql',
      arguments: {
        query: migrationSQL
      },
    });

    console.log('✅ Migration 012 applied successfully!\n');
    console.log('Result:', JSON.parse(result.content[0].text));

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await client.close();
    process.exit(0);
  }
}

applyMigration().catch(console.error);
