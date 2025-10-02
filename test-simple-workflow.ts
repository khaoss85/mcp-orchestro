#!/usr/bin/env node

/**
 * Simple Test Workflow - Manual task creation to test the full stack
 */

import { createTask, updateTask, listTasks } from './dist/tools/task.js';
import { recordDecision, recordStatusTransition } from './dist/tools/taskHistory.js';
import { addFeedback } from './dist/tools/knowledge.js';

async function runSimpleWorkflow() {
  console.log('🚀 Starting Simple Workflow Test\n');
  console.log('=' .repeat(60));

  // STEP 1: CREATE TASKS
  console.log('\n📝 STEP 1: CREATE TASKS');

  const result1 = await createTask({
    title: 'Setup database schema for authentication',
    description: 'Create users table with email and password_hash fields',
    status: 'backlog',
  });
  if (!result1.success || !result1.task) throw new Error('Failed to create task 1');
  const task1 = result1.task;
  console.log(`✓ Created Task 1: ${task1.title} (ID: ${task1.id})`);

  const result2 = await createTask({
    title: 'Implement login API endpoint',
    description: 'POST /api/login endpoint with email/password validation',
    status: 'backlog',
    dependencies: [task1.id],
  });
  if (!result2.success || !result2.task) throw new Error('Failed to create task 2');
  const task2 = result2.task;
  console.log(`✓ Created Task 2: ${task2.title} (ID: ${task2.id})`);

  const result3 = await createTask({
    title: 'Add login form to frontend',
    description: 'React component with email and password inputs',
    status: 'backlog',
    dependencies: [task2.id],
  });
  if (!result3.success || !result3.task) throw new Error('Failed to create task 3');
  const task3 = result3.task;
  console.log(`✓ Created Task 3: ${task3.title} (ID: ${task3.id})`);

  // STEP 2: RECORD DECISIONS
  console.log('\n💡 STEP 2: RECORD DECISIONS');

  await recordDecision({
    taskId: task1.id,
    decision: 'Use PostgreSQL with Supabase',
    rationale: 'Already integrated in the project, provides auth out of the box',
    timestamp: new Date(),
    actor: 'claude',
  });
  console.log('✓ Recorded decision for Task 1');

  // STEP 3: MOVE TASK TO IN_PROGRESS
  console.log('\n⚙️  STEP 3: START EXECUTION');

  await updateTask({ id: task1.id, status: 'in_progress' });
  await recordStatusTransition(
    task1.id,
    'backlog',
    'in_progress',
    'Starting database schema implementation'
  );
  console.log(`✓ Task 1 → in_progress`);

  // STEP 4: COMPLETE TASK
  console.log('\n✅ STEP 4: COMPLETE TASK');

  await updateTask({ id: task1.id, status: 'done' });
  await recordStatusTransition(
    task1.id,
    'in_progress',
    'done',
    'Schema created and tested'
  );
  console.log(`✓ Task 1 → done`);

  // STEP 5: RECORD FEEDBACK
  console.log('\n📚 STEP 5: STORE FEEDBACK');

  await addFeedback({
    taskId: task1.id,
    feedback: 'Successfully created users table. Added indexes on email for faster lookups.',
    type: 'success',
    pattern: 'database_schema_creation',
  });
  console.log('✓ Feedback stored');

  // STEP 6: MOVE NEXT TASK
  console.log('\n🔄 STEP 6: NEXT TASK');

  await updateTask({ id: task2.id, status: 'todo' });
  await recordStatusTransition(
    task2.id,
    'backlog',
    'todo',
    'Dependency completed, ready to start'
  );
  console.log(`✓ Task 2 → todo`);

  // STEP 7: SHOW DASHBOARD STATE
  console.log('\n📊 STEP 7: DASHBOARD STATE');

  const allTasks = await listTasks();

  const byStatus = {
    backlog: allTasks.filter(t => t.status === 'backlog').length,
    todo: allTasks.filter(t => t.status === 'todo').length,
    in_progress: allTasks.filter(t => t.status === 'in_progress').length,
    done: allTasks.filter(t => t.status === 'done').length,
  };

  console.log('\nKanban Board State:');
  console.log(`  📦 Backlog: ${byStatus.backlog}`);
  console.log(`  📋 To Do: ${byStatus.todo}`);
  console.log(`  ⚙️  In Progress: ${byStatus.in_progress}`);
  console.log(`  ✅ Done: ${byStatus.done}`);

  console.log('\n\nAll Tasks:');
  allTasks.forEach(t => {
    const status = {
      backlog: '📦',
      todo: '📋',
      in_progress: '⚙️',
      done: '✅'
    }[t.status];
    console.log(`  ${status} ${t.title} (${t.status})`);
  });

  console.log('\n=' + '='.repeat(60));
  console.log('✅ WORKFLOW COMPLETE!');
  console.log('\n📍 NOW CHECK THE DASHBOARD:');
  console.log('   1. Open: http://localhost:3000');
  console.log('   2. You should see 3 tasks in the Kanban board');
  console.log(`   3. Click on "${task1.title}" to see:`);
  console.log('      - Overview tab with task details');
  console.log('      - History tab with timeline:');
  console.log('        • Task created event');
  console.log('        • Decision: Use PostgreSQL');
  console.log('        • Status: backlog → in_progress');
  console.log('        • Status: in_progress → done');
  console.log('        • Feedback: Success message');
  console.log('   4. Real-time events should have appeared via Socket.io');
  console.log('\n🔍 Task IDs for reference:');
  console.log(`   Task 1: ${task1.id}`);
  console.log(`   Task 2: ${task2.id}`);
  console.log(`   Task 3: ${task3.id}`);
}

// Run the workflow
runSimpleWorkflow()
  .then(() => {
    console.log('\n✨ Test completed successfully!');
    console.log('⏱  Waiting 2 seconds for events to process...');
    setTimeout(() => {
      console.log('✅ Done! Check the dashboard now.');
      process.exit(0);
    }, 2000);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
