#!/usr/bin/env ts-node

/**
 * Test Workflow - Simulates complete flow:
 * User Story → Planning → Analysis → Execution → Updates
 */

import { decomposeStory } from './dist/tools/decompose.js';
import { createTask, updateTask, listTasks } from './dist/tools/task.js';
import { analyzeDependencies, saveDependencies } from './dist/tools/dependencies.js';
import { recordDecision, recordStatusTransition } from './dist/tools/taskHistory.js';
import { addFeedback } from './dist/tools/knowledge.js';

async function runCompleteWorkflow() {
  console.log('🚀 Starting Complete Workflow Test\n');
  console.log('=' .repeat(60));

  // STEP 1: USER STORY
  console.log('\n📖 STEP 1: USER STORY INPUT');
  const userStory = 'User should be able to login with email and password';
  console.log(`Story: "${userStory}"`);

  // STEP 2: PLANNING (LangGraph - Task Decomposition)
  console.log('\n🧠 STEP 2: PLANNING - Decompose Story');
  console.log('Calling decompose_story...');

  const decomposition = await decomposeStory(userStory);
  console.log(`✓ Generated ${decomposition.tasks.length} tasks`);

  const taskIds: string[] = [];

  // STEP 3: CREATE TASKS
  console.log('\n📝 STEP 3: CREATE TASKS IN SYSTEM');
  for (const taskSpec of decomposition.tasks) {
    const task = await createTask({
      title: taskSpec.title,
      description: taskSpec.description,
      status: 'backlog',
      dependencies: taskSpec.dependencies
        .map(dep => {
          const index = decomposition.tasks.findIndex(t => t.id === dep);
          return index >= 0 && index < taskIds.length ? taskIds[index] : null;
        })
        .filter(Boolean) as string[],
    });

    taskIds.push(task.id);
    console.log(`✓ Created: ${task.title} (${task.id})`);

    // Record decision for task creation
    await recordDecision({
      taskId: task.id,
      decision: `Created task as part of user story: ${userStory}`,
      rationale: `Task breakdown suggested complexity: ${taskSpec.complexity}`,
      timestamp: new Date(),
      actor: 'claude',
    });
  }

  // STEP 4: DEPENDENCY ANALYSIS
  console.log('\n🔍 STEP 4: DEPENDENCY ANALYSIS');
  const firstTask = taskIds[0];
  console.log(`Analyzing dependencies for: ${firstTask}`);

  const dependencies = await analyzeDependencies(
    `Implement database schema for user authentication table with email and password fields`
  );

  console.log(`✓ Found ${dependencies.resources.length} dependencies`);
  dependencies.resources.forEach(dep => {
    console.log(`  - ${dep.type}: ${dep.name} (${dep.action})`);
  });

  // STEP 5: SAVE DEPENDENCIES
  console.log('\n💾 STEP 5: SAVE DEPENDENCIES TO GRAPH');
  await saveDependencies(firstTask, dependencies.resources);
  console.log('✓ Dependencies saved to resource graph');

  // STEP 6: SIMULATE EXECUTION
  console.log('\n⚙️  STEP 6: SIMULATE TASK EXECUTION');

  // Move first task to in_progress
  await updateTask(firstTask, { status: 'in_progress' });
  await recordStatusTransition(firstTask, 'backlog', 'in_progress', 'Starting implementation');
  console.log(`✓ Task ${firstTask} → in_progress`);

  // Simulate a decision during execution
  await recordDecision({
    taskId: firstTask,
    decision: 'Use bcrypt for password hashing',
    rationale: 'Industry standard, well-tested, and provides good security',
    timestamp: new Date(),
    actor: 'claude',
    context: 'Evaluating password storage options',
  });
  console.log('✓ Recorded decision: Use bcrypt');

  // Complete the task
  await updateTask(firstTask, { status: 'done' });
  await recordStatusTransition(firstTask, 'in_progress', 'done', 'Implementation completed');
  console.log(`✓ Task ${firstTask} → done`);

  // STEP 7: FEEDBACK & LEARNING
  console.log('\n📚 STEP 7: STORE LEARNINGS');
  await addFeedback({
    taskId: firstTask,
    feedback: 'Successfully implemented user authentication schema. Bcrypt integration worked smoothly.',
    type: 'success',
    pattern: 'authentication_implementation',
  });
  console.log('✓ Feedback stored in knowledge base');

  // STEP 8: NEXT TASK GENERATION
  console.log('\n🔄 STEP 8: NEXT TASK SELECTION');
  const nextTask = taskIds[1];
  console.log(`Next task ready: ${nextTask}`);

  await updateTask(nextTask, { status: 'todo' });
  await recordStatusTransition(nextTask, 'backlog', 'todo', 'Previous dependency completed');
  console.log(`✓ Task ${nextTask} → todo (ready to start)`);

  // STEP 9: DASHBOARD VIEW
  console.log('\n📊 STEP 9: DASHBOARD STATE');
  const allTasks = await listTasks();

  const byStatus = {
    backlog: allTasks.filter(t => t.status === 'backlog').length,
    todo: allTasks.filter(t => t.status === 'todo').length,
    in_progress: allTasks.filter(t => t.status === 'in_progress').length,
    done: allTasks.filter(t => t.status === 'done').length,
  };

  console.log('Kanban Board State:');
  console.log(`  Backlog: ${byStatus.backlog}`);
  console.log(`  To Do: ${byStatus.todo}`);
  console.log(`  In Progress: ${byStatus.in_progress}`);
  console.log(`  Done: ${byStatus.done}`);

  console.log('\n=' + '='.repeat(60));
  console.log('✅ WORKFLOW COMPLETE!');
  console.log('\n📍 Check the dashboard at: http://localhost:3000');
  console.log('   - Kanban board should show the tasks');
  console.log('   - Click on a task to see history timeline');
  console.log('   - Real-time events should appear via Socket.io');
}

// Run the workflow
runCompleteWorkflow()
  .then(() => {
    console.log('\n✨ Test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
