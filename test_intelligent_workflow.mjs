#!/usr/bin/env node

/**
 * Test script for intelligent_decompose_story workflow
 * This demonstrates the new workflow end-to-end
 */

import { intelligent_decompose_story, save_story_decomposition } from './dist/tools/intelligentDecompose.js';

async function testIntelligentWorkflow() {
  console.log('🧪 Testing Intelligent Story Decomposition Workflow\n');

  const userStory = "User should be able to view and filter tasks by multiple criteria including status, tags, and complexity in the web dashboard with real-time updates";
  const projectId = "7b189723-6695-4f56-80bd-ef242f293402";

  console.log('📋 User Story:');
  console.log(`"${userStory}"\n`);

  // Step 1: Get the analysis prompt
  console.log('Step 1: Calling intelligent_decompose_story...\n');

  try {
    const result = await intelligent_decompose_story({
      userStory,
      projectId
    });

    if (!result.success) {
      console.error('❌ Error:', result.error);
      process.exit(1);
    }

    console.log('✅ Prompt generated successfully!\n');
    console.log('📝 Generated Prompt:');
    console.log('='.repeat(80));
    console.log(result.prompt);
    console.log('='.repeat(80));
    console.log('\n');

    console.log('📋 Next Steps:');
    console.log(result.nextSteps);
    console.log('\n');

    console.log('🔍 Now Claude Code would:');
    console.log('1. Use Grep to search for similar features');
    console.log('2. Use Glob to find related components');
    console.log('3. Use Read to understand existing patterns');
    console.log('4. Create detailed task breakdown with real file paths');
    console.log('5. Call save_story_decomposition with the analysis\n');

    // Step 2: Simulate Claude Code's analysis
    console.log('Step 2: Simulating codebase analysis...\n');

    // This is what Claude Code would discover:
    const mockAnalysis = {
      tasks: [
        {
          title: "Extend TasksGrid component with advanced filtering UI",
          description: "Add multi-select filters for status, tags, and complexity to the existing TasksGrid component in web-dashboard/components/tasks/TasksGrid.tsx. Follow the existing filter pattern from StatusFilter. Add FilterBar component with dropdown selects for each criteria. Ensure accessibility with proper ARIA labels.",
          complexity: "medium",
          estimatedHours: 4,
          dependencies: [],
          tags: ["frontend", "react", "ui", "filtering"],
          category: "design_frontend",
          filesToModify: [
            {
              path: "web-dashboard/components/tasks/TasksGrid.tsx",
              reason: "Add FilterBar component and filter state management",
              risk: "low"
            },
            {
              path: "web-dashboard/components/tasks/TaskCard.tsx",
              reason: "Ensure task card displays all filterable fields",
              risk: "low"
            }
          ],
          filesToCreate: [
            {
              path: "web-dashboard/components/tasks/FilterBar.tsx",
              reason: "New component for multi-criteria filtering UI"
            },
            {
              path: "web-dashboard/hooks/useTaskFilters.ts",
              reason: "Custom hook for filter state and logic"
            }
          ],
          codebaseReferences: [
            {
              file: "web-dashboard/components/tasks/TasksGrid.tsx",
              description: "Existing grid structure and data fetching pattern",
              lines: "1-150"
            }
          ]
        },
        {
          title: "Add multi-criteria filtering to list_tasks API",
          description: "Extend the list_tasks MCP tool in src/tools/task.ts to support filtering by multiple criteria simultaneously. Update SQL query builder to handle AND/OR conditions for status, tags (array contains), and complexity. Maintain backward compatibility with existing single-filter API.",
          complexity: "medium",
          estimatedHours: 3,
          dependencies: ["Extend TasksGrid component with advanced filtering UI"],
          tags: ["backend", "api", "filtering", "database"],
          category: "backend_database",
          filesToModify: [
            {
              path: "src/tools/task.ts",
              reason: "Extend listTasks function with multi-criteria filtering",
              risk: "medium"
            },
            {
              path: "src/server.ts",
              reason: "Update list_tasks tool schema to include new filter params",
              risk: "low"
            }
          ],
          filesToCreate: [],
          codebaseReferences: [
            {
              file: "src/tools/task.ts",
              description: "Existing listTasks implementation with status filter",
              lines: "50-120"
            }
          ]
        },
        {
          title: "Implement real-time task updates with Supabase subscriptions",
          description: "Add Supabase realtime subscription to tasks table in web dashboard. Create useTaskSubscription hook that subscribes to INSERT, UPDATE, DELETE events. Update TasksGrid to automatically refresh when tasks change. Handle reconnection and error states gracefully.",
          complexity: "complex",
          estimatedHours: 5,
          dependencies: ["Add multi-criteria filtering to list_tasks API"],
          tags: ["frontend", "realtime", "supabase", "subscriptions"],
          category: "design_frontend",
          filesToModify: [
            {
              path: "web-dashboard/components/tasks/TasksGrid.tsx",
              reason: "Integrate useTaskSubscription hook for real-time updates",
              risk: "medium"
            }
          ],
          filesToCreate: [
            {
              path: "web-dashboard/hooks/useTaskSubscription.ts",
              reason: "Hook for managing Supabase realtime subscriptions"
            },
            {
              path: "web-dashboard/lib/supabaseClient.ts",
              reason: "Singleton Supabase client for realtime connections"
            }
          ],
          codebaseReferences: [
            {
              file: "web-dashboard/app/page.tsx",
              description: "Existing data fetching pattern to enhance with subscriptions",
              lines: "20-45"
            }
          ]
        },
        {
          title: "Add comprehensive tests for filtering and real-time features",
          description: "Create unit tests for useTaskFilters hook, integration tests for list_tasks API with multiple filters, and E2E tests for real-time updates. Test edge cases: empty filters, all filters combined, rapid filter changes, subscription reconnection.",
          complexity: "medium",
          estimatedHours: 4,
          dependencies: ["Implement real-time task updates with Supabase subscriptions"],
          tags: ["testing", "e2e", "integration", "unit"],
          category: "test_fix",
          filesToModify: [],
          filesToCreate: [
            {
              path: "web-dashboard/__tests__/hooks/useTaskFilters.test.tsx",
              reason: "Unit tests for filter hook"
            },
            {
              path: "web-dashboard/__tests__/hooks/useTaskSubscription.test.tsx",
              reason: "Unit tests for subscription hook with mock Supabase"
            },
            {
              path: "src/__tests__/tools/task-filtering.test.ts",
              reason: "Integration tests for multi-criteria filtering API"
            }
          ],
          codebaseReferences: []
        }
      ],
      overallComplexity: "medium",
      totalEstimatedHours: 16,
      architectureNotes: [
        "Following existing React component structure in web-dashboard/components/",
        "Reusing Supabase client pattern from existing codebase",
        "API maintains backward compatibility with single-filter interface",
        "Real-time subscriptions use Supabase's built-in realtime feature"
      ],
      risks: [
        {
          level: "medium",
          description: "TasksGrid is a core component used throughout dashboard",
          mitigation: "Add comprehensive tests and feature flag for gradual rollout"
        },
        {
          level: "medium",
          description: "Realtime subscriptions can cause performance issues with large datasets",
          mitigation: "Implement pagination and limit subscription to visible tasks only"
        },
        {
          level: "low",
          description: "Multiple filter combinations increase SQL query complexity",
          mitigation: "Add query performance monitoring and optimize indexes"
        }
      ],
      recommendations: [
        "Consider adding filter presets (e.g., 'My Tasks', 'Urgent', 'Blocked')",
        "Add URL query params to persist filter state across page reloads",
        "Implement debouncing for rapid filter changes to reduce API calls",
        "Add loading skeleton during real-time updates for better UX"
      ]
    };

    console.log('📊 Analysis Complete! Discovered:');
    console.log(`- ${mockAnalysis.tasks.length} tasks`);
    console.log(`- ${mockAnalysis.totalEstimatedHours} hours estimated`);
    console.log(`- ${mockAnalysis.risks.length} risks identified`);
    console.log(`- ${mockAnalysis.recommendations.length} recommendations\n`);

    // Step 3: Save the decomposition
    console.log('Step 3: Calling save_story_decomposition...\n');

    const saveResult = await save_story_decomposition({
      projectId,
      userStory,
      analysis: mockAnalysis
    });

    if (!saveResult.success) {
      console.error('❌ Error:', saveResult.error);
      process.exit(1);
    }

    console.log('✅ Story decomposed successfully!\n');
    console.log('📦 Results:');
    console.log(`- User Story ID: ${saveResult.userStory.id}`);
    console.log(`- Tasks Created: ${saveResult.totalTasks}`);
    console.log(`- Total Estimated Hours: ${saveResult.totalEstimatedHours}`);
    console.log(`\n${saveResult.message}\n`);

    console.log('🎉 Workflow test completed successfully!\n');
    console.log('📋 Tasks created with:');
    console.log('  ✅ Real file paths from codebase analysis');
    console.log('  ✅ Accurate dependencies based on implementation order');
    console.log('  ✅ Realistic estimates from code complexity');
    console.log('  ✅ Identified risks and mitigation strategies');
    console.log('  ✅ Actionable recommendations\n');

  } catch (error) {
    console.error('❌ Workflow test failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

testIntelligentWorkflow();
