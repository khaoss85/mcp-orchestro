/**
 * Workflow instruction templates for guiding Claude Code through task lifecycle
 *
 * The hybrid auto-analysis approach uses these instructions embedded in tool results
 * to guide Claude Code to follow the complete workflow without missing steps.
 */

export interface WorkflowInstruction {
  action: string;
  step: number;
  message: string;
  nextTool: string;
}

export const WORKFLOW_INSTRUCTIONS = {
  TASK_CREATED: {
    action: 'analyze',
    step: 0,
    message: `✅ Task created successfully.

⚠️ IMPORTANT: Before implementation, this task needs codebase analysis.

📋 NEXT STEP:
Call prepare_task_for_execution() to get the analysis prompt, then analyze the codebase using Read/Grep/Glob tools.

Without analysis, the Dependencies tab will be empty and implementation risks are unknown.`,
    nextTool: 'prepare_task_for_execution'
  },

  STORY_DECOMPOSED: {
    action: 'analyze_tasks',
    step: 0,
    message: `✅ User story decomposed into tasks.

⚠️ IMPORTANT: Each task needs codebase analysis before implementation.

📋 NEXT STEP:
Analyze tasks starting with those that have no dependencies. For each task:
1. Call prepare_task_for_execution({ taskId })
2. Analyze the codebase using Read/Grep/Glob
3. Call save_task_analysis() with findings

This ensures all tasks have complete metadata and dependency mapping.`,
    nextTool: 'prepare_task_for_execution'
  },

  AUTO_ANALYSIS_COMPLETE: {
    action: 'review_analysis',
    step: 1,
    message: `✅ Auto-analysis complete! Analysis prompts prepared for all tasks without dependencies.

🎯 ANALYSIS PROMPTS READY:
The system has automatically prepared detailed analysis prompts for each task.

📋 NEXT STEP:
Review the analysis prompts in the analysisPrompts field and execute them:
1. Read each task's analysis prompt
2. Use Read/Grep/Glob tools to perform the codebase analysis
3. Call save_task_analysis() for each task with your findings

Once all tasks are analyzed, you can start implementation by calling get_execution_prompt() for each task.`,
    nextTool: 'save_task_analysis'
  },

  ANALYSIS_PREPARED: {
    action: 'analyze_codebase',
    step: 1,
    message: `📊 Analysis prompt generated.

🔍 CURRENT STEP: Analyze the codebase
Use Read, Grep, and Glob tools to:
- Find files to modify
- Identify dependencies
- Detect risks and conflicts
- Locate similar code patterns

📋 NEXT STEP:
When analysis is complete, call save_task_analysis() with your findings in this format:
{
  taskId: "...",
  analysis: {
    filesToModify: [{ path, reason, risk }],
    filesToCreate: [{ path, reason }],
    dependencies: [{ type, name, path, action }],
    risks: [{ level, description, mitigation }],
    relatedCode: [{ file, description, lines }],
    recommendations: ["..."]
  }
}`,
    nextTool: 'save_task_analysis'
  },

  ANALYSIS_SAVED: {
    action: 'get_execution_prompt',
    step: 2,
    message: `✅ Analysis saved successfully. Dependencies mapped in database.

📋 NEXT STEP:
Call get_execution_prompt() to receive the enriched implementation prompt with:
- Complete dependency graph
- Risk assessments and mitigations
- Related code patterns
- Project guidelines
- Similar learnings from past tasks`,
    nextTool: 'get_execution_prompt'
  },

  READY_TO_IMPLEMENT: {
    action: 'implement',
    step: 3,
    message: `🚀 Task is ready for implementation.

You now have complete context including:
- Files to modify/create
- Dependencies and conflicts
- Risk mitigations
- Code patterns to follow
- Project guidelines

📋 IMPLEMENTATION STEPS:
1. Update task status to in_progress
2. Follow the implementation prompt above
3. Make the required code changes
4. Test your changes
5. Update task status to done
6. Add feedback for future similar tasks

Start by calling: update_task({ id, status: 'in_progress' })`,
    nextTool: 'update_task'
  },

  IMPLEMENTATION_COMPLETE: {
    action: 'collect_feedback',
    step: 4,
    message: `✅ Task marked as complete.

📋 FINAL STEP (Optional but recommended):
Call add_feedback() to record what worked well, challenges encountered, and lessons learned.

This helps the system:
- Improve future task analysis
- Detect recurring patterns
- Provide better recommendations
- Build organizational knowledge

Format:
{
  taskId: "...",
  feedback: "What worked, what didn't, lessons learned",
  type: "success" | "failure" | "improvement",
  pattern: "pattern-name"
}`,
    nextTool: 'add_feedback'
  }
} as const;

export type WorkflowStage = keyof typeof WORKFLOW_INSTRUCTIONS;

/**
 * Builds structured next-step instructions for tool results
 */
export interface NextSteps {
  step: number;
  action: string;
  instructions: string;
  nextTool: string;
  toolsToCall?: Array<{
    tool: string;
    params: Record<string, any>;
  }>;
}

export function buildNextSteps(
  workflowStage: WorkflowStage,
  params?: {
    taskId?: string;
    taskIds?: string[];
    toolsToCall?: Array<{ tool: string; params: Record<string, any> }>;
    analyzedTaskIds?: string[];
    message?: string;
  }
): NextSteps {
  const instruction = WORKFLOW_INSTRUCTIONS[workflowStage];

  const nextSteps: NextSteps = {
    step: instruction.step,
    action: instruction.action,
    instructions: instruction.message,
    nextTool: instruction.nextTool,
  };

  // Add specific tool calls based on stage and params
  if (params?.toolsToCall) {
    nextSteps.toolsToCall = params.toolsToCall;
  } else if (params?.taskId) {
    // Auto-generate tool calls based on stage
    switch (workflowStage) {
      case 'TASK_CREATED':
        nextSteps.toolsToCall = [
          { tool: 'prepare_task_for_execution', params: { taskId: params.taskId } }
        ];
        break;
      case 'ANALYSIS_SAVED':
        nextSteps.toolsToCall = [
          { tool: 'get_execution_prompt', params: { taskId: params.taskId } }
        ];
        break;
      case 'READY_TO_IMPLEMENT':
        nextSteps.toolsToCall = [
          { tool: 'update_task', params: { id: params.taskId, status: 'in_progress' } }
        ];
        break;
      case 'IMPLEMENTATION_COMPLETE':
        nextSteps.toolsToCall = [
          { tool: 'add_feedback', params: { taskId: params.taskId, feedback: '', type: 'success', pattern: '' } }
        ];
        break;
    }
  } else if (params?.taskIds) {
    // For multiple tasks (e.g., story decomposition)
    nextSteps.toolsToCall = params.taskIds.map(taskId => ({
      tool: 'prepare_task_for_execution',
      params: { taskId }
    }));
  }

  return nextSteps;
}

/**
 * Formats a workflow message with consistent styling
 */
export function formatWorkflowMessage(
  emoji: string,
  title: string,
  sections: Array<{ heading: string; content: string }>
): string {
  let message = `${emoji} ${title}\n\n`;

  sections.forEach(section => {
    message += `${section.heading}\n${section.content}\n\n`;
  });

  return message.trim();
}
