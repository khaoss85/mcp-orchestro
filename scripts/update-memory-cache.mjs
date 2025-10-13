#!/usr/bin/env node

/**
 * Memory Cache Updater
 *
 * This script fetches data from the Memory MCP tool and saves it to a cache file
 * that the web dashboard can read. Since the web dashboard can't directly call
 * MCP tools (they run in Claude Code), we use this periodic update approach.
 *
 * Usage:
 *   node scripts/update-memory-cache.mjs [query]
 *
 * Examples:
 *   node scripts/update-memory-cache.mjs                    # Fetch all (limited)
 *   node scripts/update-memory-cache.mjs "orchestro"        # Search specific term
 *
 * The cache file is saved to: ../.memory-cache.json
 */

import { writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧠 Memory Cache Updater');
console.log('======================\n');

// Get query from command line or use default
const query = process.argv[2] || 'orchestro';

console.log(`📝 Fetching data with query: "${query}"`);
console.log('⚠️  Note: This is a placeholder. To populate with real data:');
console.log('   1. Use Claude Code to call mcp__memory__search_nodes');
console.log('   2. Copy the results to this script');
console.log('   3. Or implement an MCP client here\n');

/**
 * Validates memory graph data structure
 * @param {Object} data - Memory graph data
 * @param {Array} data.entities - Array of entity objects
 * @param {Array} data.relations - Array of relation objects
 * @returns {Object} Validation result with warnings array
 */
function validateMemoryData(data) {
  const warnings = [];

  if (!data.entities || !Array.isArray(data.entities)) {
    warnings.push('⚠️  entities must be an array');
    return { valid: false, warnings };
  }

  if (!data.relations || !Array.isArray(data.relations)) {
    warnings.push('⚠️  relations must be an array');
    return { valid: false, warnings };
  }

  // Validate each entity
  data.entities.forEach((entity, index) => {
    if (!entity.name || typeof entity.name !== 'string') {
      warnings.push(`⚠️  Entity ${index}: name must be a non-empty string`);
    }

    if (!entity.entityType || typeof entity.entityType !== 'string') {
      warnings.push(`⚠️  Entity ${index} (${entity.name}): entityType must be a string`);
    }

    if (!entity.observations) {
      warnings.push(`⚠️  Entity ${index} (${entity.name}): missing observations array`);
    } else if (!Array.isArray(entity.observations)) {
      warnings.push(`⚠️  Entity ${index} (${entity.name}): observations must be an array`);
    } else if (entity.observations.length === 0) {
      warnings.push(`⚠️  Entity ${index} (${entity.name}): has no observations (recommended at least 1)`);
    } else {
      // Validate each observation is a string
      entity.observations.forEach((obs, obsIndex) => {
        if (typeof obs !== 'string') {
          warnings.push(`⚠️  Entity ${entity.name}, observation ${obsIndex}: must be a string`);
        }
      });
    }
  });

  return { valid: warnings.length === 0, warnings };
}

/**
 * Memory Graph Data Structure
 *
 * Expected format for the Memory MCP cache file:
 * {
 *   entities: [
 *     {
 *       name: string,           // Unique entity name
 *       entityType: string,     // Type: person, project, concept, technology, task, etc.
 *       observations: string[]  // Array of observation strings (at least 1 recommended)
 *     }
 *   ],
 *   relations: [
 *     {
 *       from: string,          // Source entity name
 *       to: string,            // Target entity name
 *       relationType: string   // Relation type (e.g., "is component of", "uses")
 *     }
 *   ],
 *   metadata: {
 *     lastUpdated: string,     // ISO timestamp
 *     query: string,           // Search query used
 *     totalEntities: number,   // Count of entities
 *     totalRelations: number,  // Count of relations
 *     totalObservations: number // Count of all observations across entities
 *   }
 * }
 */

// Placeholder data structure
// TODO: Replace with actual MCP tool call when MCP client is implemented
const memoryData = {
  entities: [
    {
      name: "Orchestro Project",
      entityType: "project",
      observations: [
        "AI-assisted development conductor",
        "Rebranded from mcp-coder-expert to Orchestro",
        "Version 2.1.0",
        "Features: Task management, User stories, Knowledge Hub, Analytics",
        "27 MCP tools available"
      ]
    },
    {
      name: "Web Dashboard",
      entityType: "technology",
      observations: [
        "Built with Next.js 15.5.4",
        "Uses Server Components and API Routes",
        "Supabase for database operations",
        "WebSocket real-time updates via socket.io",
        "Comprehensive API routes for all operations"
      ]
    },
    {
      name: "Knowledge Hub",
      entityType: "feature",
      observations: [
        "Manages learnings, patterns, and templates",
        "Analytics dashboard with recharts visualizations",
        "Real-time filtering and search capabilities",
        "Four main pages: Overview, Learnings, Patterns, Templates",
        "Memory Graph visualization with @xyflow/react"
      ]
    },
    {
      name: "Claude Code Integration",
      entityType: "technology",
      observations: [
        "MCP protocol integration",
        "5 guardian agents configured",
        "7 MCP tools connected",
        "Sub-agents: architecture-guardian, api-guardian, test-maintainer, database-guardian, production-ready-code-reviewer"
      ]
    },
    {
      name: "Guardian Agents",
      entityType: "tooling",
      observations: [
        "architecture-guardian: Prevents code duplication and ensures consistency",
        "api-guardian: Maintains frontend-backend sync",
        "database-guardian: Ensures schema alignment",
        "test-maintainer: Manages test suites and cleanup",
        "production-ready-code-reviewer: Verifies production readiness"
      ]
    },
    {
      name: "MCP Tools",
      entityType: "tooling",
      observations: [
        "27 tools for task management, decomposition, and analysis",
        "Knowledge system tools for patterns, learnings, templates",
        "Dependency analysis and execution order calculation",
        "Project configuration and tech stack management"
      ]
    }
  ],
  relations: [
    {
      from: "Web Dashboard",
      to: "Orchestro Project",
      relationType: "is component of"
    },
    {
      from: "Knowledge Hub",
      to: "Web Dashboard",
      relationType: "is feature of"
    },
    {
      from: "Claude Code Integration",
      to: "Orchestro Project",
      relationType: "integrates with"
    },
    {
      from: "Guardian Agents",
      to: "Claude Code Integration",
      relationType: "provides automation for"
    },
    {
      from: "MCP Tools",
      to: "Orchestro Project",
      relationType: "extends functionality of"
    }
  ],
  metadata: {
    lastUpdated: new Date().toISOString(),
    query: query,
    totalEntities: 6,
    totalRelations: 5,
    totalObservations: 0 // Will be calculated below
  }
};

// Calculate total observations
memoryData.metadata.totalObservations = memoryData.entities.reduce(
  (sum, entity) => sum + (entity.observations?.length || 0),
  0
);

// Validate data structure
console.log('🔍 Validating data structure...');
const validation = validateMemoryData(memoryData);

if (validation.warnings.length > 0) {
  console.log('\n⚠️  Validation warnings:');
  validation.warnings.forEach(warning => console.log(`   ${warning}`));
  console.log('');
}

// Save to cache file
const cacheFilePath = join(__dirname, '../.memory-cache.json');

try {
  await writeFile(cacheFilePath, JSON.stringify(memoryData, null, 2), 'utf-8');
  console.log('✅ Cache updated successfully!');
  console.log(`📂 Location: ${cacheFilePath}`);
  console.log(`📊 Stats: ${memoryData.entities.length} entities, ${memoryData.relations.length} relations, ${memoryData.metadata.totalObservations} observations`);
  console.log(`🕐 Last updated: ${memoryData.metadata.lastUpdated}\n`);

  console.log('💡 To see the graph:');
  console.log('   1. Open http://localhost:3000/knowledge/memory');
  console.log('   2. Click the Refresh button to reload\n');
} catch (error) {
  console.error('❌ Failed to update cache:', error);
  process.exit(1);
}
