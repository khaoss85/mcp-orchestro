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
export declare const WORKFLOW_INSTRUCTIONS: {
    readonly TASK_CREATED: {
        readonly action: "analyze";
        readonly step: 0;
        readonly message: "✅ Task created successfully.\n\n⚠️ IMPORTANT: Before implementation, this task needs codebase analysis.\n\n📋 NEXT STEP:\nCall prepare_task_for_execution() to get the analysis prompt, then analyze the codebase using Read/Grep/Glob tools.\n\nWithout analysis, the Dependencies tab will be empty and implementation risks are unknown.";
        readonly nextTool: "prepare_task_for_execution";
    };
    readonly STORY_DECOMPOSED: {
        readonly action: "analyze_tasks";
        readonly step: 0;
        readonly message: "✅ User story decomposed into tasks.\n\n⚠️ IMPORTANT: Each task needs codebase analysis before implementation.\n\n📋 NEXT STEP:\nAnalyze tasks starting with those that have no dependencies. For each task:\n1. Call prepare_task_for_execution({ taskId })\n2. Analyze the codebase using Read/Grep/Glob\n3. Call save_task_analysis() with findings\n\nThis ensures all tasks have complete metadata and dependency mapping.";
        readonly nextTool: "prepare_task_for_execution";
    };
    readonly AUTO_ANALYSIS_COMPLETE: {
        readonly action: "review_analysis";
        readonly step: 1;
        readonly message: "✅ Auto-analysis complete! Analysis prompts prepared for all tasks without dependencies.\n\n🎯 ANALYSIS PROMPTS READY:\nThe system has automatically prepared detailed analysis prompts for each task.\n\n📋 NEXT STEP:\nReview the analysis prompts in the analysisPrompts field and execute them:\n1. Read each task's analysis prompt\n2. Use Read/Grep/Glob tools to perform the codebase analysis\n3. Call save_task_analysis() for each task with your findings\n\nOnce all tasks are analyzed, you can start implementation by calling get_execution_prompt() for each task.";
        readonly nextTool: "save_task_analysis";
    };
    readonly ANALYSIS_PREPARED: {
        readonly action: "analyze_codebase";
        readonly step: 1;
        readonly message: "📊 Analysis prompt generated.\n\n🔍 CURRENT STEP: Analyze the codebase\nUse Read, Grep, and Glob tools to:\n- Find files to modify\n- Identify dependencies\n- Detect risks and conflicts\n- Locate similar code patterns\n\n📋 NEXT STEP:\nWhen analysis is complete, call save_task_analysis() with your findings in this format:\n{\n  taskId: \"...\",\n  analysis: {\n    filesToModify: [{ path, reason, risk }],\n    filesToCreate: [{ path, reason }],\n    dependencies: [{ type, name, path, action }],\n    risks: [{ level, description, mitigation }],\n    relatedCode: [{ file, description, lines }],\n    recommendations: [\"...\"]\n  }\n}";
        readonly nextTool: "save_task_analysis";
    };
    readonly ANALYSIS_SAVED: {
        readonly action: "get_execution_prompt";
        readonly step: 2;
        readonly message: "✅ Analysis saved successfully. Dependencies mapped in database.\n\n📋 NEXT STEP:\nCall get_execution_prompt() to receive the enriched implementation prompt with:\n- Complete dependency graph\n- Risk assessments and mitigations\n- Related code patterns\n- Project guidelines\n- Similar learnings from past tasks";
        readonly nextTool: "get_execution_prompt";
    };
    readonly READY_TO_IMPLEMENT: {
        readonly action: "implement";
        readonly step: 3;
        readonly message: "🚀 Task is ready for implementation.\n\nYou now have complete context including:\n- Files to modify/create\n- Dependencies and conflicts\n- Risk mitigations\n- Code patterns to follow\n- Project guidelines\n\n📋 IMPLEMENTATION STEPS:\n1. Update task status to in_progress\n2. Follow the implementation prompt above\n3. Make the required code changes\n4. Test your changes\n5. Update task status to done\n6. Add feedback for future similar tasks\n\nStart by calling: update_task({ id, status: 'in_progress' })";
        readonly nextTool: "update_task";
    };
    readonly IMPLEMENTATION_COMPLETE: {
        readonly action: "collect_feedback";
        readonly step: 4;
        readonly message: "✅ Task marked as complete.\n\n📋 FINAL STEP (Optional but recommended):\nCall add_feedback() to record what worked well, challenges encountered, and lessons learned.\n\nThis helps the system:\n- Improve future task analysis\n- Detect recurring patterns\n- Provide better recommendations\n- Build organizational knowledge\n\nFormat:\n{\n  taskId: \"...\",\n  feedback: \"What worked, what didn't, lessons learned\",\n  type: \"success\" | \"failure\" | \"improvement\",\n  pattern: \"pattern-name\"\n}";
        readonly nextTool: "add_feedback";
    };
};
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
export declare function buildNextSteps(workflowStage: WorkflowStage, params?: {
    taskId?: string;
    taskIds?: string[];
    toolsToCall?: Array<{
        tool: string;
        params: Record<string, any>;
    }>;
    analyzedTaskIds?: string[];
    message?: string;
}): NextSteps;
/**
 * Formats a workflow message with consistent styling
 */
export declare function formatWorkflowMessage(emoji: string, title: string, sections: Array<{
    heading: string;
    content: string;
}>): string;
