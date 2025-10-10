#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function testSuggestions() {
  console.log('🧪 Testing Agent and Tool Suggestions Integration\n');

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/server.js'],
  });

  const client = new Client(
    {
      name: 'test-client',
      version: '1.0.0',
    },
    {
      capabilities: {},
    }
  );

  try {
    await client.connect(transport);
    console.log('✅ Connected to MCP server\n');

    // Step 1: Get project info
    console.log('📋 Step 1: Getting project info...');
    const projectInfo = await client.callTool({
      name: 'get_project_info',
      arguments: {},
    });
    const project = JSON.parse(projectInfo.content[0].text);
    const projectId = project.id;
    console.log(`   Project ID: ${projectId}\n`);

    // Step 2: Sync Claude Code agents
    console.log('🔄 Step 2: Syncing Claude Code agents...');
    const syncResult = await client.callTool({
      name: 'sync_claude_code_agents',
      arguments: { projectId },
    });
    const syncData = JSON.parse(syncResult.content[0].text);
    console.log(`   Synced ${syncData.syncedCount} agents\n`);

    // Step 3: Decompose a user story
    console.log('🎯 Step 3: Decomposing user story with suggestions...');
    const userStory = 'User should be able to search and filter tasks by database schema changes and migrations';
    const decomposeResult = await client.callTool({
      name: 'decompose_story',
      arguments: { userStory },
    });
    const decomposition = JSON.parse(decomposeResult.content[0].text);

    if (!decomposition.success) {
      console.error('❌ Decomposition failed:', decomposition.error);
      return;
    }

    console.log(`   ✅ Created ${decomposition.tasks.length} tasks\n`);

    // Step 4: Check suggestions in created tasks
    console.log('🔍 Step 4: Checking suggestions in tasks...\n');

    for (const taskInfo of decomposition.tasks) {
      const task = taskInfo.task;
      const metadata = task.storyMetadata || {};

      console.log(`📌 Task: ${task.title}`);
      console.log(`   Complexity: ${metadata.complexity || 'N/A'}`);
      console.log(`   Estimated Hours: ${metadata.estimatedHours || 'N/A'}`);

      if (metadata.suggestedAgent) {
        console.log(`   🤖 Suggested Agent: ${metadata.suggestedAgent.agentName}`);
        console.log(`      - Type: ${metadata.suggestedAgent.agentType}`);
        console.log(`      - Confidence: ${(metadata.suggestedAgent.confidence * 100).toFixed(0)}%`);
        console.log(`      - Reason: ${metadata.suggestedAgent.reason}`);
      } else {
        console.log(`   🤖 Suggested Agent: None`);
      }

      if (metadata.suggestedTools && metadata.suggestedTools.length > 0) {
        console.log(`   🔧 Suggested Tools (${metadata.suggestedTools.length}):`);
        metadata.suggestedTools.forEach((tool, idx) => {
          console.log(`      ${idx + 1}. ${tool.toolName} (${(tool.confidence * 100).toFixed(0)}%) - ${tool.reason}`);
        });
      } else {
        console.log(`   🔧 Suggested Tools: None`);
      }

      console.log('');
    }

    console.log('✅ Test completed successfully!\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await client.close();
    process.exit(0);
  }
}

testSuggestions().catch(console.error);
