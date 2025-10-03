#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { getProjectInfo } from "./tools/project.js";
import { createTask, listTasks, updateTask, getTaskContext, getUserStories, getTasksByUserStory } from "./tools/task.js";
import { listTemplates, listPatterns, listLearnings, renderTemplate, getRelevantKnowledge, addFeedback, getSimilarLearnings, getTopPatterns, getTrendingPatterns, getPatternStats, detectFailurePatterns, checkPatternRisk } from "./tools/knowledge.js";
import { decomposeStory } from "./tools/decompose.js";
import { saveDependencies, getTaskDependencyGraph, getResourceUsage, getTaskConflicts } from "./tools/dependencies.js";
import { prepareTaskForExecution } from "./tools/taskPreparation.js";
import { saveTaskAnalysis, getExecutionPrompt } from "./tools/taskAnalysis.js";

const server = new Server(
  {
    name: "mcp-coder-expert",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_project_info",
        description: "Returns information about the current project including name, status, and description",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "create_task",
        description: "Creates a new task with title, description, status (backlog|todo|in_progress|done), dependencies, assignee, priority, and tags",
        inputSchema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Task title",
            },
            description: {
              type: "string",
              description: "Task description",
            },
            status: {
              type: "string",
              enum: ["backlog", "todo", "in_progress", "done"],
              description: "Task status (default: backlog)",
            },
            dependencies: {
              type: "array",
              items: { type: "string" },
              description: "Array of task IDs this task depends on",
            },
            assignee: {
              type: "string",
              description: "Task assignee",
            },
            priority: {
              type: "string",
              enum: ["low", "medium", "high", "urgent"],
              description: "Task priority",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Task tags for categorization",
            },
          },
          required: ["title", "description"],
        },
      },
      {
        name: "list_tasks",
        description: "Lists all tasks, optionally filtered by status",
        inputSchema: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["backlog", "todo", "in_progress", "done"],
              description: "Filter tasks by status (optional)",
            },
          },
        },
      },
      {
        name: "update_task",
        description: "Updates an existing task. Validates status transitions and dependencies",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Task ID",
            },
            title: {
              type: "string",
              description: "New task title",
            },
            description: {
              type: "string",
              description: "New task description",
            },
            status: {
              type: "string",
              enum: ["backlog", "todo", "in_progress", "done"],
              description: "New task status",
            },
            dependencies: {
              type: "array",
              items: { type: "string" },
              description: "New array of task IDs this task depends on",
            },
            assignee: {
              type: "string",
              description: "Task assignee",
            },
            priority: {
              type: "string",
              enum: ["low", "medium", "high", "urgent"],
              description: "Task priority",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Task tags for categorization",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "get_task_context",
        description: "Gets comprehensive context for a task including dependencies, previous work, guidelines, and tech stack",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Task ID",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "list_templates",
        description: "Lists available prompt and code templates",
        inputSchema: {
          type: "object",
          properties: {
            category: {
              type: "string",
              enum: ["prompt", "code", "architecture", "review"],
              description: "Filter by template category (optional)",
            },
          },
        },
      },
      {
        name: "list_patterns",
        description: "Lists coding patterns learned from the codebase",
        inputSchema: {
          type: "object",
          properties: {
            category: {
              type: "string",
              description: "Filter by pattern category (optional)",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Filter by tags (optional)",
            },
          },
        },
      },
      {
        name: "list_learnings",
        description: "Lists learnings from past experiences",
        inputSchema: {
          type: "object",
          properties: {
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Filter by tags (optional)",
            },
          },
        },
      },
      {
        name: "render_template",
        description: "Renders a template with provided variables",
        inputSchema: {
          type: "object",
          properties: {
            templateId: {
              type: "string",
              description: "Template ID to render",
            },
            variables: {
              type: "object",
              description: "Variables to substitute in template",
            },
          },
          required: ["templateId", "variables"],
        },
      },
      {
        name: "get_relevant_knowledge",
        description: "Gets relevant templates, patterns, and learnings for a task",
        inputSchema: {
          type: "object",
          properties: {
            taskTitle: {
              type: "string",
              description: "Task title",
            },
            taskDescription: {
              type: "string",
              description: "Task description",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Tags for filtering relevant knowledge (optional)",
            },
          },
          required: ["taskTitle", "taskDescription"],
        },
      },
      {
        name: "decompose_story",
        description: "Decomposes a user story into technical tasks using AI, with automatic dependency detection and complexity estimation",
        inputSchema: {
          type: "object",
          properties: {
            userStory: {
              type: "string",
              description: "The user story to decompose (e.g., 'User should be able to login with email')",
            },
          },
          required: ["userStory"],
        },
      },
      {
        name: "add_feedback",
        description: "Add feedback/learning from task execution to improve future recommendations",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "Task ID to associate feedback with",
            },
            feedback: {
              type: "string",
              description: "Feedback text describing what was learned",
            },
            type: {
              type: "string",
              enum: ["success", "failure", "improvement"],
              description: "Type of feedback",
            },
            pattern: {
              type: "string",
              description: "Pattern used or identified for similarity matching",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Optional tags for categorization",
            },
          },
          required: ["taskId", "feedback", "type", "pattern"],
        },
      },
      {
        name: "get_similar_learnings",
        description: "Find similar learnings/feedback based on context and pattern matching",
        inputSchema: {
          type: "object",
          properties: {
            context: {
              type: "string",
              description: "Context to search for (task description, problem, etc.)",
            },
            taskId: {
              type: "string",
              description: "Optional task ID to filter by",
            },
            type: {
              type: "string",
              enum: ["success", "failure", "improvement"],
              description: "Optional feedback type filter",
            },
            pattern: {
              type: "string",
              description: "Optional pattern to match",
            },
          },
          required: ["context"],
        },
      },
      {
        name: "get_top_patterns",
        description: "Get the most frequently used patterns across all tasks, sorted by frequency and recency",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Maximum number of patterns to return (default: 10)",
            },
          },
        },
      },
      {
        name: "get_trending_patterns",
        description: "Get patterns that are trending (most used in recent days), useful for identifying current development patterns",
        inputSchema: {
          type: "object",
          properties: {
            days: {
              type: "number",
              description: "Number of days to look back (default: 7)",
            },
            limit: {
              type: "number",
              description: "Maximum number of patterns to return (default: 10)",
            },
          },
        },
      },
      {
        name: "get_pattern_stats",
        description: "Get detailed statistics for a specific pattern including frequency, success rate, and usage timeline",
        inputSchema: {
          type: "object",
          properties: {
            pattern: {
              type: "string",
              description: "The pattern name to get statistics for",
            },
          },
          required: ["pattern"],
        },
      },
      {
        name: "detect_failure_patterns",
        description: "Automatically detect patterns with high failure rates to identify risky approaches. Returns patterns sorted by failure rate with risk assessments and recommendations.",
        inputSchema: {
          type: "object",
          properties: {
            minOccurrences: {
              type: "number",
              description: "Minimum number of times a pattern must occur to be analyzed (default: 3)",
            },
            failureThreshold: {
              type: "number",
              description: "Minimum failure rate (0.0-1.0) to flag a pattern as risky (default: 0.5 = 50%)",
            },
          },
        },
      },
      {
        name: "check_pattern_risk",
        description: "Check if a specific pattern has a history of failures and get risk assessment before using it. Provides immediate feedback on pattern safety.",
        inputSchema: {
          type: "object",
          properties: {
            pattern: {
              type: "string",
              description: "The pattern name to check for risk",
            },
          },
          required: ["pattern"],
        },
      },
      {
        name: "prepare_task_for_execution",
        description: "Prepares a task for execution by generating a structured analysis request. Returns a prompt that guides Claude Code to analyze the codebase using its tools (Read, Grep, Glob). After analysis, call save_task_analysis with the results.",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "Task ID to prepare for execution",
            },
          },
          required: ["taskId"],
        },
      },
      {
        name: "save_task_analysis",
        description: "Saves the codebase analysis performed by Claude Code. Call this after analyzing the codebase following the prepare_task_for_execution prompt. Records dependencies, risks, and recommendations.",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "Task ID",
            },
            analysis: {
              type: "object",
              description: "Analysis results from codebase inspection",
              properties: {
                filesToModify: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      path: { type: "string" },
                      reason: { type: "string" },
                      risk: { type: "string", enum: ["low", "medium", "high"] },
                    },
                  },
                },
                filesToCreate: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      path: { type: "string" },
                      reason: { type: "string" },
                    },
                  },
                },
                dependencies: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["file", "component", "api", "model"] },
                      name: { type: "string" },
                      path: { type: "string" },
                      action: { type: "string", enum: ["uses", "modifies", "creates"] },
                    },
                  },
                },
                risks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      level: { type: "string", enum: ["low", "medium", "high"] },
                      description: { type: "string" },
                      mitigation: { type: "string" },
                    },
                  },
                },
                relatedCode: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      file: { type: "string" },
                      description: { type: "string" },
                      lines: { type: "string" },
                    },
                  },
                },
                recommendations: {
                  type: "array",
                  items: { type: "string" },
                },
              },
            },
          },
          required: ["taskId", "analysis"],
        },
      },
      {
        name: "get_execution_prompt",
        description: "Generates an enriched execution prompt with full context for implementing a task. Call this after save_task_analysis to get a comprehensive prompt with dependencies, risks, patterns, and guidelines.",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "Task ID to get execution prompt for",
            },
          },
          required: ["taskId"],
        },
      },
      {
        name: "save_dependencies",
        description: "Save analyzed dependencies and detect potential conflicts with other tasks",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "Task ID to associate dependencies with",
            },
            resources: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["file", "component", "api", "model"] },
                  name: { type: "string" },
                  path: { type: "string" },
                  action: { type: "string", enum: ["uses", "modifies", "creates"] },
                  confidence: { type: "number" },
                },
                required: ["type", "name", "action"],
              },
              description: "Array of analyzed resources from analyze_dependencies",
            },
          },
          required: ["taskId", "resources"],
        },
      },
      {
        name: "get_task_dependency_graph",
        description: "Get the dependency graph (nodes and edges) for a specific task",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "Task ID to get dependency graph for",
            },
          },
          required: ["taskId"],
        },
      },
      {
        name: "get_resource_usage",
        description: "Get all tasks that touch a specific resource",
        inputSchema: {
          type: "object",
          properties: {
            resourceId: {
              type: "string",
              description: "Resource ID to query usage for",
            },
          },
          required: ["resourceId"],
        },
      },
      {
        name: "get_task_conflicts",
        description: "Get potential conflicts for a task based on resource usage",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "Task ID to check for conflicts",
            },
          },
          required: ["taskId"],
        },
      },
      {
        name: "get_user_stories",
        description: "Get all user stories with task counts for dashboard display",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_tasks_by_user_story",
        description: "Get all tasks belonging to a specific user story",
        inputSchema: {
          type: "object",
          properties: {
            userStoryId: {
              type: "string",
              description: "UUID of the user story",
            },
          },
          required: ["userStoryId"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "get_project_info") {
    try {
      const projectInfo = await getProjectInfo();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(projectInfo, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: false, error: (error as Error).message }, null, 2),
          },
        ],
        isError: true,
      };
    }
  }

  if (name === "create_task") {
    const result = await createTask(args as any);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
      isError: !result.success,
    };
  }

  if (name === "list_tasks") {
    const tasks = await listTasks(args as any);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(tasks, null, 2),
        },
      ],
    };
  }

  if (name === "update_task") {
    const result = await updateTask(args as any);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
      isError: !result.success,
    };
  }

  if (name === "get_task_context") {
    const result = await getTaskContext((args as any).id);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
      isError: !result.success,
    };
  }

  if (name === "list_templates") {
    const templates = await listTemplates(args as any);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(templates, null, 2),
        },
      ],
    };
  }

  if (name === "list_patterns") {
    const patterns = await listPatterns(args as any);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(patterns, null, 2),
        },
      ],
    };
  }

  if (name === "list_learnings") {
    const learnings = await listLearnings(args as any);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(learnings, null, 2),
        },
      ],
    };
  }

  if (name === "render_template") {
    const result = await renderTemplate((args as any).templateId, (args as any).variables);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
      isError: !result.success,
    };
  }

  if (name === "get_relevant_knowledge") {
    const knowledge = await getRelevantKnowledge(args as any);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(knowledge, null, 2),
        },
      ],
    };
  }

  if (name === "decompose_story") {
    const result = await decomposeStory((args as any).userStory);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
      isError: !result.success,
    };
  }

  if (name === "add_feedback") {
    const result = await addFeedback(args as any);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
      isError: !result.success,
    };
  }

  if (name === "get_similar_learnings") {
    const learnings = await getSimilarLearnings(args as any);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(learnings, null, 2),
        },
      ],
    };
  }

  if (name === "get_top_patterns") {
    const patterns = await getTopPatterns((args as any).limit);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(patterns, null, 2),
        },
      ],
    };
  }

  if (name === "get_trending_patterns") {
    const patterns = await getTrendingPatterns((args as any).days, (args as any).limit);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(patterns, null, 2),
        },
      ],
    };
  }

  if (name === "get_pattern_stats") {
    const stats = await getPatternStats((args as any).pattern);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(stats, null, 2),
        },
      ],
    };
  }

  if (name === "detect_failure_patterns") {
    const failurePatterns = await detectFailurePatterns(
      (args as any).minOccurrences,
      (args as any).failureThreshold
    );
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(failurePatterns, null, 2),
        },
      ],
    };
  }

  if (name === "check_pattern_risk") {
    const risk = await checkPatternRisk((args as any).pattern);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(risk, null, 2),
        },
      ],
    };
  }

  if (name === "prepare_task_for_execution") {
    try {
      const request = await prepareTaskForExecution((args as any).taskId);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(request, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: false, error: (error as Error).message }, null, 2),
          },
        ],
        isError: true,
      };
    }
  }

  if (name === "save_task_analysis") {
    try {
      const result = await saveTaskAnalysis(args as any);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
        isError: !result.success,
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: false, error: (error as Error).message }, null, 2),
          },
        ],
        isError: true,
      };
    }
  }

  if (name === "get_execution_prompt") {
    try {
      const prompt = await getExecutionPrompt((args as any).taskId);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(prompt, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: false, error: (error as Error).message }, null, 2),
          },
        ],
        isError: true,
      };
    }
  }

  if (name === "save_dependencies") {
    const result = await saveDependencies((args as any).taskId, (args as any).resources);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
      isError: !result.success,
    };
  }

  if (name === "get_task_dependency_graph") {
    const graph = await getTaskDependencyGraph((args as any).taskId);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(graph, null, 2),
        },
      ],
    };
  }

  if (name === "get_resource_usage") {
    const usage = await getResourceUsage((args as any).resourceId);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(usage, null, 2),
        },
      ],
    };
  }

  if (name === "get_task_conflicts") {
    const conflicts = await getTaskConflicts((args as any).taskId);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(conflicts, null, 2),
        },
      ],
    };
  }

  if (name === "get_user_stories") {
    const stories = await getUserStories();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(stories, null, 2),
        },
      ],
    };
  }

  if (name === "get_tasks_by_user_story") {
    const { userStoryId } = args as { userStoryId: string };
    const tasks = await getTasksByUserStory(userStoryId);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(tasks, null, 2),
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Coder Expert server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
