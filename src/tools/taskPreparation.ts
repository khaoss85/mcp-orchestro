/**
 * Task Preparation - Orchestrates analysis by requesting Claude Code to inspect codebase
 *
 * This module doesn't analyze code directly - instead it provides structured prompts
 * that guide Claude Code to analyze the codebase using its own tools (Read, Grep, Glob, etc.)
 */

import { getTask } from './task.js';
import { getSimilarLearnings } from './knowledge.js';
import { buildNextSteps } from '../constants/workflows.js';

export interface AnalysisRequest {
  taskId: string;
  taskTitle: string;
  taskDescription: string;
  prompt: string;
  searchPatterns: string[];
  filesToCheck: string[];
  risksToIdentify: string[];
  workflowInstructions?: any; // Workflow guidance for Claude Code
}

/**
 * Prepares a task for execution by generating a structured analysis request for Claude Code
 *
 * Claude Code will receive this and use its tools to analyze the codebase, then call
 * save_task_analysis with the results.
 */
export async function prepareTaskForExecution(taskId: string): Promise<AnalysisRequest> {
  const task = await getTask(taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }

  // Get similar past work to inform the analysis
  const similarLearnings = await getSimilarLearnings({
    context: `${task.title} ${task.description}`,
  });

  // Generate search patterns based on task description
  const searchPatterns = generateSearchPatterns(task.title, task.description);

  // Generate file patterns to check
  const filesToCheck = generateFilePatterns(task.title, task.description);

  // Generate risks to look for
  const risksToIdentify = generateRiskChecks(task.title, task.description);

  // Build the analysis prompt
  const prompt = buildAnalysisPrompt({
    task,
    searchPatterns,
    filesToCheck,
    risksToIdentify,
    similarLearnings,
  });

  // Build workflow instructions
  const workflowInstructions = buildNextSteps('ANALYSIS_PREPARED', { taskId: task.id });

  return {
    taskId: task.id,
    taskTitle: task.title,
    taskDescription: task.description,
    prompt,
    searchPatterns,
    filesToCheck,
    risksToIdentify,
    workflowInstructions,
  };
}

/**
 * Generate search patterns based on task keywords
 */
function generateSearchPatterns(title: string, description: string): string[] {
  const patterns: string[] = [];
  const text = `${title} ${description}`.toLowerCase();

  // Database/Schema related
  if (text.match(/database|table|schema|migration/)) {
    patterns.push('CREATE TABLE', 'ALTER TABLE', 'migration', 'schema');
  }

  // API/Endpoint related
  if (text.match(/api|endpoint|route|controller/)) {
    patterns.push('app.get', 'app.post', 'router.', 'export.*Router', '@Controller', 'createHandler');
  }

  // Authentication related
  if (text.match(/auth|login|password|token|session/)) {
    patterns.push('authenticate', 'verifyToken', 'hashPassword', 'session', 'jwt', 'bcrypt');
  }

  // UI/Component related
  if (text.match(/component|form|page|ui|frontend/)) {
    patterns.push('export.*function.*Component', 'export default', 'useState', 'useEffect', 'interface.*Props');
  }

  // Email related
  if (text.match(/email|mail|send|notification/)) {
    patterns.push('sendEmail', 'nodemailer', 'transport.send', 'email.*template');
  }

  // Testing related
  if (text.match(/test|spec|unit|integration/)) {
    patterns.push('describe\\(', 'it\\(', 'test\\(', 'expect\\(');
  }

  return patterns;
}

/**
 * Generate file glob patterns to check
 */
function generateFilePatterns(title: string, description: string): string[] {
  const patterns: string[] = [];
  const text = `${title} ${description}`.toLowerCase();

  // Always check common locations
  patterns.push('src/**/*.ts', 'src/**/*.tsx');

  // Database
  if (text.match(/database|table|schema|migration/)) {
    patterns.push('src/db/**/*.sql', 'prisma/schema.prisma', 'src/models/**/*.ts');
  }

  // API
  if (text.match(/api|endpoint|route/)) {
    patterns.push('src/routes/**/*.ts', 'src/controllers/**/*.ts', 'src/api/**/*.ts');
  }

  // Frontend
  if (text.match(/component|form|page|ui|frontend/)) {
    patterns.push('src/components/**/*.tsx', 'src/pages/**/*.tsx', 'app/**/*.tsx');
  }

  // Tests
  if (text.match(/test/)) {
    patterns.push('**/*.test.ts', '**/*.spec.ts');
  }

  return patterns;
}

/**
 * Generate specific risks to check for
 */
function generateRiskChecks(title: string, description: string): string[] {
  const risks: string[] = [];
  const text = `${title} ${description}`.toLowerCase();

  if (text.match(/database|table|schema/)) {
    risks.push('Check for existing migrations that might conflict');
    risks.push('Verify foreign key constraints');
    risks.push('Check if table/column already exists');
  }

  if (text.match(/api|endpoint/)) {
    risks.push('Check if endpoint path is already used');
    risks.push('Verify authentication/authorization requirements');
    risks.push('Check for rate limiting needs');
  }

  if (text.match(/auth|security|password/)) {
    risks.push('Security: Ensure password hashing');
    risks.push('Security: Check for SQL injection vulnerabilities');
    risks.push('Security: Verify token expiration handling');
  }

  if (text.match(/delete|remove|drop/)) {
    risks.push('HIGH RISK: Data loss - verify backup strategy');
    risks.push('Check for cascade delete implications');
  }

  // Always check
  risks.push('Look for similar existing functionality that could be reused');
  risks.push('Check if changes break existing tests');

  return risks;
}

/**
 * Build the complete analysis prompt for Claude Code
 */
function buildAnalysisPrompt(params: {
  task: any;
  searchPatterns: string[];
  filesToCheck: string[];
  risksToIdentify: string[];
  similarLearnings: any[];
}): string {
  const { task, searchPatterns, filesToCheck, risksToIdentify, similarLearnings } = params;

  let prompt = `# Task Analysis Request

## Task Details
**Title**: ${task.title}
**Description**: ${task.description}
**Status**: ${task.status}

## Your Mission
Analyze the codebase to prepare for implementing this task. Use your Read, Grep, and Glob tools to gather the following information.

## 1. Search for Related Code
Use Grep to search for these patterns across the codebase:
${searchPatterns.map(p => `- \`${p}\``).join('\n')}

## 2. Check These File Locations
Use Glob and Read to inspect these file patterns:
${filesToCheck.map(p => `- \`${p}\``).join('\n')}

## 3. Identify Risks and Conflicts
Specifically look for:
${risksToIdentify.map(r => `- ${r}`).join('\n')}

## 4. Expected Analysis Output
After your analysis, call \`save_task_analysis\` with this structure:

\`\`\`json
{
  "taskId": "${task.id}",
  "analysis": {
    "filesToModify": [
      { "path": "src/example.ts", "reason": "Contains the function we need to update", "risk": "low|medium|high" }
    ],
    "filesToCreate": [
      { "path": "src/new-feature.ts", "reason": "New module for this feature" }
    ],
    "dependencies": [
      { "type": "file|component|api|model", "name": "ResourceName", "path": "src/path", "action": "uses|modifies|creates" }
    ],
    "risks": [
      { "level": "low|medium|high", "description": "Description of the risk", "mitigation": "How to handle it" }
    ],
    "relatedCode": [
      { "file": "src/existing.ts", "description": "Similar implementation we can reference", "lines": "10-50" }
    ],
    "recommendations": [
      "Specific recommendation for implementation"
    ]
  }
}
\`\`\`
`;

  // Add learnings from similar past work
  if (similarLearnings.length > 0) {
    prompt += `\n## 5. Learnings from Similar Past Work\n`;
    prompt += `Previous experience with similar tasks:\n\n`;
    similarLearnings.slice(0, 3).forEach((learning, i) => {
      prompt += `**Learning ${i + 1}**: ${learning.feedback}\n`;
      if (learning.pattern) {
        prompt += `Pattern: \`${learning.pattern}\`\n`;
      }
      prompt += `\n`;
    });
  }

  prompt += `\n## Instructions
1. Perform the analysis using your codebase tools
2. Structure your findings according to the JSON format above
3. Call \`save_task_analysis\` with your results
4. After saving, call \`get_execution_prompt\` to receive the enriched prompt for implementation
`;

  return prompt;
}
