/**
 * Task Analysis - Saves Claude Code's codebase analysis and generates execution prompts
 *
 * This module receives the results of Claude Code's codebase analysis and:
 * 1. Saves dependencies to the resource graph
 * 2. Records risks and recommendations
 * 3. Generates enriched prompts for task execution
 */
import { getSupabaseClient } from '../db/supabase.js';
import { buildNextSteps } from '../constants/workflows.js';
import { getTask } from './task.js';
import { emitEvent } from '../db/eventQueue.js';
import { getSimilarLearnings } from './knowledge.js';
import { saveDependencies } from './dependencies.js';
/**
 * Save the analysis performed by Claude Code
 */
export async function saveTaskAnalysis(params) {
    const { taskId, analysis } = params;
    const task = await getTask(taskId);
    if (!task) {
        throw new Error(`Task ${taskId} not found`);
    }
    const supabase = getSupabaseClient();
    try {
        // 1. Save dependencies to resource graph using optimized saveDependencies function
        // Transform to AnalyzedResource format with confidence score
        const analyzedResources = analysis.dependencies.map(dep => ({
            type: dep.type,
            name: dep.name,
            path: dep.path,
            action: dep.action,
            confidence: 1.0, // High confidence since this is from manual analysis
        }));
        // Save dependencies and detect conflicts
        const depResult = await saveDependencies(taskId, analyzedResources);
        if (!depResult.success) {
            throw new Error(depResult.error || 'Failed to save dependencies');
        }
        // Emit guardian event if conflicts detected
        if (depResult.conflicts && depResult.conflicts.length > 0) {
            await emitEvent('guardian_intervention', {
                task_id: taskId,
                intervention_type: 'conflict_detected',
                severity: 'medium',
                details: {
                    conflicts: depResult.conflicts,
                    message: `${depResult.conflicts.length} resource conflicts detected`,
                },
            });
        }
        // 2. Store analysis metadata in task
        await supabase
            .from('tasks')
            .update({
            metadata: {
                analysis: {
                    files_to_modify: analysis.filesToModify,
                    files_to_create: analysis.filesToCreate,
                    risks: analysis.risks,
                    related_code: analysis.relatedCode,
                    recommendations: analysis.recommendations,
                    analyzed_at: new Date().toISOString(),
                },
            },
        })
            .eq('id', taskId);
        // 3. Record high-risk items as events
        const highRisks = analysis.risks.filter(r => r.level === 'high');
        if (highRisks.length > 0) {
            await emitEvent('guardian_intervention', {
                task_id: taskId,
                intervention_type: 'risk_identified',
                severity: 'high',
                details: {
                    risks: highRisks,
                    message: `${highRisks.length} high-risk items identified during analysis`,
                },
            });
        }
        // 4. Emit analysis complete event
        await emitEvent('task_updated', {
            task: { id: taskId, title: task.title },
            task_id: taskId,
            update_type: 'analysis_completed',
            dependencies_count: analysis.dependencies.length,
            risks_count: analysis.risks.length,
            high_risk_count: highRisks.length,
        });
        // Build success message with conflict info
        let message = `Analysis saved: ${analysis.dependencies.length} dependencies, ${analysis.risks.length} risks identified`;
        if (depResult.conflicts && depResult.conflicts.length > 0) {
            message += `, ${depResult.conflicts.length} conflicts detected`;
        }
        // Build workflow instructions
        const nextSteps = buildNextSteps('ANALYSIS_SAVED', { taskId });
        return {
            success: true,
            message,
            nextSteps,
        };
    }
    catch (error) {
        console.error('Error saving task analysis:', error);
        throw new Error(`Failed to save analysis: ${error.message}`);
    }
}
/**
 * Generate enriched execution prompt with all context
 *
 * Optimization: This function can accept a pre-fetched analysis object from TaskContext
 * to avoid redundant database queries. If analysis is not provided, it will fetch from
 * the database for backward compatibility.
 *
 * @param taskId - The ID of the task
 * @param providedAnalysis - Optional pre-fetched analysis from TaskContext (optimization)
 */
export async function getExecutionPrompt(taskId, providedAnalysis) {
    const task = await getTask(taskId);
    if (!task) {
        throw new Error(`Task ${taskId} not found`);
    }
    const supabase = getSupabaseClient();
    // Optimization: Use provided analysis from context if available (avoids database query)
    let analysis = providedAnalysis;
    // Fallback: Fetch from database if not provided (backward compatibility)
    if (!analysis) {
        const { data: taskData, error: taskError } = await supabase
            .from('tasks')
            .select('metadata')
            .eq('id', taskId)
            .single();
        if (taskError || !taskData) {
            throw new Error(`Failed to load task metadata: ${taskError?.message || 'Task not found'}`);
        }
        analysis = taskData.metadata?.analysis || null;
    }
    if (!analysis) {
        throw new Error(`Task ${taskId} has not been analyzed yet. Call prepare_task_for_execution first.`);
    }
    // Get dependencies from graph
    const { data: dependencies } = await supabase
        .from('resource_edges')
        .select(`
      *,
      resource:resource_nodes!resource_edges_resource_id_fkey(*)
    `)
        .eq('task_id', taskId);
    // Get similar patterns and learnings
    const similarLearnings = await getSimilarLearnings({
        context: `${task.title} ${task.description}`,
    });
    // Get project guidelines (from templates or patterns)
    const guidelines = await getProjectGuidelines();
    // Build enriched prompt
    const prompt = buildExecutionPrompt({
        task,
        analysis,
        dependencies: dependencies || [],
        similarLearnings,
        guidelines,
    });
    // Build workflow instructions
    const nextSteps = buildNextSteps('READY_TO_IMPLEMENT', { taskId: task.id });
    return {
        taskId: task.id,
        taskTitle: task.title,
        taskDescription: task.description,
        prompt,
        context: {
            dependencies: dependencies || [],
            risks: analysis.risks,
            relatedCode: analysis.related_code,
            recommendations: analysis.recommendations,
            patterns: similarLearnings,
            guidelines,
        },
        nextSteps,
    };
}
/**
 * Get project coding guidelines
 */
async function getProjectGuidelines() {
    const supabase = getSupabaseClient();
    const { data: templates } = await supabase
        .from('templates')
        .select('content')
        .eq('category', 'prompt')
        .eq('name', 'coding_guidelines')
        .single();
    if (templates?.content) {
        return templates.content.split('\n').filter((line) => line.trim());
    }
    // Default guidelines
    return [
        'Write clean, readable, and maintainable code',
        'Follow TypeScript best practices',
        'Add comprehensive error handling',
        'Include JSDoc comments for public APIs',
        'Write tests for new functionality',
        'Update relevant documentation',
    ];
}
/**
 * Build the complete execution prompt
 */
function buildExecutionPrompt(params) {
    const { task, analysis, dependencies, similarLearnings, guidelines } = params;
    let prompt = `# Implementation Task

## Task Overview
**Title**: ${task.title}
**Description**: ${task.description}
`;
    // Add AI-powered suggestions if available
    if (task.storyMetadata?.suggestedAgent) {
        const agent = task.storyMetadata.suggestedAgent;
        prompt += `\n## 🤖 Recommended Sub-Agent
**Agent**: ${agent.agentName} (${agent.agentType})
**Confidence**: ${Math.round(agent.confidence * 100)}%
**Why**: ${agent.reason}

💡 **Tip**: This task is well-suited for the ${agent.agentName} sub-agent. Consider using it for implementation.
`;
    }
    if (task.storyMetadata?.suggestedTools && task.storyMetadata.suggestedTools.length > 0) {
        prompt += `\n## 🛠️ Recommended MCP Tools\n`;
        task.storyMetadata.suggestedTools.forEach((tool, i) => {
            prompt += `${i + 1}. **${tool.toolName}** (${tool.category}) - ${Math.round(tool.confidence * 100)}% match
   ${tool.reason}\n`;
        });
        prompt += `\n💡 **Tip**: These MCP tools can help you complete this task more efficiently.\n`;
    }
    prompt += `\n## Analysis Summary
Based on codebase analysis, you will need to:

`;
    // Files to modify
    if (analysis.files_to_modify?.length > 0) {
        prompt += `### Files to Modify\n`;
        analysis.files_to_modify.forEach((file) => {
            const riskEmoji = file.risk === 'high' ? '🔴' : file.risk === 'medium' ? '🟡' : '🟢';
            prompt += `${riskEmoji} **${file.path}** - ${file.reason}\n`;
        });
        prompt += `\n`;
    }
    // Files to create
    if (analysis.files_to_create?.length > 0) {
        prompt += `### Files to Create\n`;
        analysis.files_to_create.forEach((file) => {
            prompt += `- **${file.path}** - ${file.reason}\n`;
        });
        prompt += `\n`;
    }
    // Dependencies
    if (dependencies.length > 0) {
        prompt += `### Dependencies Identified\n`;
        dependencies.forEach((dep) => {
            prompt += `- **${dep.resource.name}** (${dep.resource.type}) - ${dep.action_type}\n`;
            if (dep.resource.path) {
                prompt += `  Path: \`${dep.resource.path}\`\n`;
            }
        });
        prompt += `\n`;
    }
    // Risks
    if (analysis.risks?.length > 0) {
        prompt += `### ⚠️ Risks to Consider\n`;
        const highRisks = analysis.risks.filter((r) => r.level === 'high');
        const mediumRisks = analysis.risks.filter((r) => r.level === 'medium');
        const lowRisks = analysis.risks.filter((r) => r.level === 'low');
        if (highRisks.length > 0) {
            prompt += `\n**🔴 HIGH PRIORITY RISKS**:\n`;
            highRisks.forEach((risk) => {
                prompt += `- **${risk.description}**\n`;
                prompt += `  Mitigation: ${risk.mitigation}\n`;
            });
        }
        if (mediumRisks.length > 0) {
            prompt += `\n**🟡 Medium Risks**:\n`;
            mediumRisks.forEach((risk) => {
                prompt += `- ${risk.description} (${risk.mitigation})\n`;
            });
        }
        if (lowRisks.length > 0) {
            prompt += `\n**🟢 Low Risks**:\n`;
            lowRisks.forEach((risk) => {
                prompt += `- ${risk.description}\n`;
            });
        }
        prompt += `\n`;
    }
    // Related code
    if (analysis.related_code?.length > 0) {
        prompt += `### 📚 Related Code to Reference\n`;
        analysis.related_code.forEach((ref) => {
            prompt += `- **${ref.file}**`;
            if (ref.lines) {
                prompt += ` (lines ${ref.lines})`;
            }
            prompt += `\n  ${ref.description}\n`;
        });
        prompt += `\n`;
    }
    // Recommendations
    if (analysis.recommendations?.length > 0) {
        prompt += `### 💡 Recommendations\n`;
        analysis.recommendations.forEach((rec) => {
            prompt += `- ${rec}\n`;
        });
        prompt += `\n`;
    }
    // Similar patterns
    if (similarLearnings.length > 0) {
        prompt += `### 🎓 Learnings from Similar Work\n`;
        similarLearnings.slice(0, 3).forEach((learning, i) => {
            prompt += `${i + 1}. ${learning.feedback}\n`;
        });
        prompt += `\n`;
    }
    // Guidelines
    prompt += `### 📋 Project Guidelines\n`;
    guidelines.forEach((guideline) => {
        prompt += `- ${guideline}\n`;
    });
    prompt += `\n`;
    // Implementation steps
    prompt += `## Implementation Steps

1. **Read the files** identified in the analysis above
2. **Follow the recommendations** to avoid common pitfalls
3. **Implement the changes** according to the task description
4. **Handle the risks** using the mitigation strategies provided
5. **Test your changes** to ensure they work correctly
6. **Update the task status** using \`update_task\` when done
7. **Record your decisions** using \`record_decision\` for important choices
8. **Add feedback** using \`add_feedback\` when complete

## After Implementation

When you complete this task, call \`add_feedback\` with:
- What worked well
- Any challenges encountered
- Lessons learned for future similar tasks

Good luck! 🚀
`;
    return prompt;
}
