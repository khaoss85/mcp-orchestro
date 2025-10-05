#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { getProjectInfo } from "./tools/project.js";
import { createTask, listTasks, updateTask, deleteTask, deleteUserStory, getTaskContext, getUserStories, getTasksByUserStory, safeDeleteTasksByStatus, getUserStoryHealth } from "./tools/task.js";
import { listTemplates, listPatterns, listLearnings, renderTemplate, getRelevantKnowledge, addFeedback, getSimilarLearnings, getTopPatterns, getTrendingPatterns, getPatternStats, detectFailurePatterns, checkPatternRisk } from "./tools/knowledge.js";
import { decomposeStory } from "./tools/decompose.js";
import { saveDependencies, getTaskDependencyGraph, getResourceUsage, getTaskConflicts } from "./tools/dependencies.js";
import { prepareTaskForExecution } from "./tools/taskPreparation.js";
import { saveTaskAnalysis, getExecutionPrompt } from "./tools/taskAnalysis.js";
import { getExecutionOrder } from "./tools/taskExecution.js";
import {
  getProjectConfiguration,
  addTechStack,
  updateTechStack,
  removeTechStack,
  addSubAgent,
  updateSubAgent,
  addMCPTool,
  updateMCPTool,
  addGuideline,
  addCodePattern,
  initializeProjectConfiguration
} from "./tools/configuration.js";
import {
  readClaudeCodeAgents,
  syncClaudeCodeAgents,
  suggestAgentsForTask,
  suggestToolsForTask,
  updateAgentPromptTemplates
} from "./tools/claudeCodeSync.js";
import {
  getTaskHistory,
  getStatusHistory,
  getDecisions,
  getGuardianInterventions,
  getCodeChanges,
  recordDecision,
  recordCodeChange,
  recordGuardianIntervention,
  recordStatusTransition,
  getIterationCount,
  getTaskSnapshot,
  rollbackTask,
  getTaskStats
} from "./tools/taskHistory.js";

const server = new Server(
  {
    name: "orchestro",
    version: "2.1.0",
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
        description: "Creates a new task with title, description, status (backlog|todo|in_progress|done), dependencies, assignee, priority, and tags. ⚠️ IMPORTANT: The tool response includes automatic workflow guidance (nextSteps field) for analyzing the task before implementation. Always follow the nextSteps instructions to ensure complete metadata and dependency mapping.",
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
            category: {
              type: "string",
              enum: ["design_frontend", "backend_database", "test_fix"],
              description: "Task category for visual filtering",
            },
          },
          required: ["title", "description"],
        },
      },
      {
        name: "list_tasks",
        description: "Lists all tasks, optionally filtered by status and/or category",
        inputSchema: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["backlog", "todo", "in_progress", "done"],
              description: "Filter tasks by status (optional)",
            },
            category: {
              type: "string",
              enum: ["design_frontend", "backend_database", "test_fix"],
              description: "Filter tasks by category (optional)",
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
            category: {
              type: "string",
              enum: ["design_frontend", "backend_database", "test_fix"],
              description: "Task category for visual filtering",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "delete_task",
        description: "Deletes a task. Checks for dependent tasks and prevents deletion if other tasks depend on it. Invalidates caches automatically.",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Task ID to delete",
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
        name: "get_execution_order",
        description: "Calculates the topological execution order for tasks based on dependencies. Uses Kahn's algorithm to detect circular dependencies and return tasks sorted by execution sequence. Handles edge cases: cycles (returns error with cycle path), multiple dependency chains (ensures all paths considered), and isolated tasks (included at end).",
        inputSchema: {
          type: "object",
          properties: {
            userStoryId: {
              type: "string",
              description: "Filter by user story ID (optional)",
            },
            status: {
              type: "string",
              enum: ["backlog", "todo", "in_progress", "done"],
              description: "Filter by task status (optional)",
            },
          },
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
        description: "Decomposes a user story into technical tasks using AI, with automatic dependency detection and complexity estimation. ⚠️ IMPORTANT: The tool response includes automatic workflow guidance (nextSteps field) for analyzing each created task. Follow the nextSteps and recommendedAnalysisOrder to analyze tasks efficiently. Set autoAnalyze=true to automatically prepare analysis prompts for all tasks.",
        inputSchema: {
          type: "object",
          properties: {
            userStory: {
              type: "string",
              description: "The user story to decompose (e.g., 'User should be able to login with email')",
            },
            autoAnalyze: {
              type: "boolean",
              description: "If true, automatically prepares analysis prompts for all tasks without dependencies (default: true)",
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
        description: "Prepares a task for execution by generating a structured analysis request. Returns a prompt that guides Claude Code to analyze the codebase using its tools (Read, Grep, Glob). ⚠️ IMPORTANT: The response includes workflowInstructions field - follow it to know exactly what to do next. After analysis, call save_task_analysis with the results.",
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
        description: "Saves the codebase analysis performed by Claude Code. Call this after analyzing the codebase following the prepare_task_for_execution prompt. Records dependencies, risks, and recommendations. ⚠️ IMPORTANT: The response includes nextSteps guidance - follow it to get the enriched execution prompt with all context.",
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
        description: "Generates an enriched execution prompt with full context for implementing a task. Call this after save_task_analysis to get a comprehensive prompt with dependencies, risks, patterns, and guidelines. ⚠️ IMPORTANT: The response includes nextSteps for implementation - follow the prompt and update task status to in_progress when you start.",
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
      {
        name: "safe_delete_tasks_by_status",
        description: "Safely delete tasks by status, automatically preserving user stories with completed work and tasks with dependencies. Returns detailed report of what was deleted vs. preserved.",
        inputSchema: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["backlog", "todo", "in_progress", "done"],
              description: "Status of tasks to delete",
            },
          },
          required: ["status"],
        },
      },
      {
        name: "get_user_story_health",
        description: "Get health monitoring data for all user stories, showing current vs. suggested status, completion percentage, and safety flags for deletion",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "delete_user_story",
        description: "Delete a user story and all its sub-tasks. Checks for completed work and external dependencies. Use force=true to delete user stories with completed sub-tasks.",
        inputSchema: {
          type: "object",
          properties: {
            userStoryId: {
              type: "string",
              description: "UUID of the user story to delete",
            },
            force: {
              type: "boolean",
              description: "Force deletion even if there are completed sub-tasks (default: false)",
            },
          },
          required: ["userStoryId"],
        },
      },
      {
        name: "get_project_configuration",
        description: "Get the complete configuration for a project including tech stack, sub-agents, MCP tools, guidelines, and code patterns",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description: "Project ID",
            },
          },
          required: ["projectId"],
        },
      },
      {
        name: "initialize_project_configuration",
        description: "Initialize default configuration for a project including tools and guardian agents",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description: "Project ID to initialize",
            },
          },
          required: ["projectId"],
        },
      },
      {
        name: "add_tech_stack",
        description: "Add a technology stack entry to the project configuration",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description: "Project ID",
            },
            techStack: {
              type: "object",
              properties: {
                category: {
                  type: "string",
                  enum: ["frontend", "backend", "database", "testing", "deployment", "other"],
                  description: "Technology category",
                },
                framework: {
                  type: "string",
                  description: "Framework or library name",
                },
                version: {
                  type: "string",
                  description: "Version number (optional)",
                },
                isPrimary: {
                  type: "boolean",
                  description: "Whether this is a primary technology (optional)",
                },
                configuration: {
                  type: "object",
                  description: "Additional configuration data (optional)",
                },
              },
              required: ["category", "framework"],
            },
          },
          required: ["projectId", "techStack"],
        },
      },
      {
        name: "update_tech_stack",
        description: "Update an existing tech stack entry",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Tech stack ID",
            },
            updates: {
              type: "object",
              properties: {
                framework: { type: "string" },
                version: { type: "string" },
                isPrimary: { type: "boolean" },
                configuration: { type: "object" },
              },
            },
          },
          required: ["id", "updates"],
        },
      },
      {
        name: "remove_tech_stack",
        description: "Remove a tech stack entry from the project",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Tech stack ID to remove",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "add_sub_agent",
        description: "Add a sub-agent (guardian) to the project configuration",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description: "Project ID",
            },
            subAgent: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "Sub-agent name",
                },
                agentType: {
                  type: "string",
                  description: "Type of agent (guardian, analyzer, etc.)",
                },
                enabled: {
                  type: "boolean",
                  description: "Whether the agent is enabled (optional)",
                },
                triggers: {
                  type: "array",
                  items: { type: "string" },
                  description: "Event triggers for the agent (optional)",
                },
                customPrompt: {
                  type: "string",
                  description: "Custom prompt for the agent (optional)",
                },
                rules: {
                  type: "array",
                  items: { type: "string" },
                  description: "Rules the agent enforces (optional)",
                },
                priority: {
                  type: "number",
                  description: "Agent priority (1-10, optional)",
                },
                configuration: {
                  type: "object",
                  description: "Additional configuration (optional)",
                },
              },
              required: ["name", "agentType"],
            },
          },
          required: ["projectId", "subAgent"],
        },
      },
      {
        name: "update_sub_agent",
        description: "Update an existing sub-agent configuration",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Sub-agent ID",
            },
            updates: {
              type: "object",
              properties: {
                name: { type: "string" },
                enabled: { type: "boolean" },
                triggers: { type: "array", items: { type: "string" } },
                customPrompt: { type: "string" },
                rules: { type: "array", items: { type: "string" } },
                priority: { type: "number" },
                configuration: { type: "object" },
              },
            },
          },
          required: ["id", "updates"],
        },
      },
      {
        name: "add_mcp_tool",
        description: "Add an MCP tool configuration to the project",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description: "Project ID",
            },
            tool: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "Tool name",
                },
                toolType: {
                  type: "string",
                  enum: ["local", "http", "stdin"],
                  description: "Tool connection type",
                },
                command: {
                  type: "string",
                  description: "Command to run the tool (for local/stdin types)",
                },
                enabled: {
                  type: "boolean",
                  description: "Whether the tool is enabled (optional)",
                },
                whenToUse: {
                  type: "array",
                  items: { type: "string" },
                  description: "Scenarios when to use this tool (optional)",
                },
                priority: {
                  type: "number",
                  description: "Tool priority (1-10, optional)",
                },
                url: {
                  type: "string",
                  description: "URL for HTTP tools (optional)",
                },
                apiKey: {
                  type: "string",
                  description: "API key for authentication (optional)",
                },
                fallbackTool: {
                  type: "string",
                  description: "Fallback tool name (optional)",
                },
                configuration: {
                  type: "object",
                  description: "Additional configuration (optional)",
                },
              },
              required: ["name", "toolType"],
            },
          },
          required: ["projectId", "tool"],
        },
      },
      {
        name: "update_mcp_tool",
        description: "Update an existing MCP tool configuration",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "MCP tool ID",
            },
            updates: {
              type: "object",
              properties: {
                name: { type: "string" },
                command: { type: "string" },
                enabled: { type: "boolean" },
                whenToUse: { type: "array", items: { type: "string" } },
                priority: { type: "number" },
                url: { type: "string" },
                apiKey: { type: "string" },
                fallbackTool: { type: "string" },
                configuration: { type: "object" },
              },
            },
          },
          required: ["id", "updates"],
        },
      },
      {
        name: "add_guideline",
        description: "Add a project guideline or coding standard",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description: "Project ID",
            },
            guideline: {
              type: "object",
              properties: {
                guidelineType: {
                  type: "string",
                  enum: ["coding_standard", "architecture", "security", "performance", "testing", "documentation"],
                  description: "Type of guideline",
                },
                title: {
                  type: "string",
                  description: "Guideline title",
                },
                description: {
                  type: "string",
                  description: "Detailed description",
                },
                example: {
                  type: "string",
                  description: "Example code or usage (optional)",
                },
                category: {
                  type: "string",
                  description: "Category or tag (optional)",
                },
                priority: {
                  type: "number",
                  description: "Priority level (1-10, optional)",
                },
                tags: {
                  type: "array",
                  items: { type: "string" },
                  description: "Tags for categorization (optional)",
                },
                isActive: {
                  type: "boolean",
                  description: "Whether the guideline is active (optional)",
                },
              },
              required: ["guidelineType", "title", "description"],
            },
          },
          required: ["projectId", "guideline"],
        },
      },
      {
        name: "add_code_pattern",
        description: "Add a reusable code pattern to the project library",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description: "Project ID",
            },
            pattern: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "Pattern name",
                },
                description: {
                  type: "string",
                  description: "Pattern description",
                },
                exampleCode: {
                  type: "string",
                  description: "Example code implementation",
                },
                language: {
                  type: "string",
                  description: "Programming language",
                },
                framework: {
                  type: "string",
                  description: "Framework or library (optional)",
                },
                category: {
                  type: "string",
                  description: "Pattern category (optional)",
                },
                tags: {
                  type: "array",
                  items: { type: "string" },
                  description: "Tags for categorization (optional)",
                },
              },
              required: ["name", "description", "exampleCode", "language"],
            },
          },
          required: ["projectId", "pattern"],
        },
      },
      {
        name: "read_claude_code_agents",
        description: "Read and parse Claude Code agents from .claude/agents/ directory",
        inputSchema: {
          type: "object",
          properties: {
            agentsDir: {
              type: "string",
              description: "Custom agents directory path (optional, defaults to .claude/agents)",
            },
          },
        },
      },
      {
        name: "sync_claude_code_agents",
        description: "Synchronize Claude Code agents to Orchestro database. Reads agents from .claude/agents/, parses YAML frontmatter and prompts, then upserts to sub_agents table",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description: "Project ID",
            },
            agentsDir: {
              type: "string",
              description: "Custom agents directory path (optional)",
            },
          },
          required: ["projectId"],
        },
      },
      {
        name: "suggest_agents_for_task",
        description: "Get AI-powered agent suggestions for a task based on description and category. Returns top 3 most relevant agents with confidence scores",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description: "Project ID",
            },
            taskDescription: {
              type: "string",
              description: "Task description",
            },
            taskCategory: {
              type: "string",
              enum: ["design_frontend", "backend_database", "test_fix"],
              description: "Task category (optional)",
            },
          },
          required: ["projectId", "taskDescription"],
        },
      },
      {
        name: "suggest_tools_for_task",
        description: "Get AI-powered MCP tool suggestions for a task based on description and category. Returns top 3 most relevant tools with confidence scores",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description: "Project ID",
            },
            taskDescription: {
              type: "string",
              description: "Task description",
            },
            taskCategory: {
              type: "string",
              enum: ["design_frontend", "backend_database", "test_fix"],
              description: "Task category (optional)",
            },
          },
          required: ["projectId", "taskDescription"],
        },
      },
      {
        name: "update_agent_prompt_templates",
        description: "Update prompt templates for all agent types with predefined best-practice templates",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description: "Project ID",
            },
          },
          required: ["projectId"],
        },
      },
      {
        name: "get_task_history",
        description: "Get complete event history for a task including all status changes, decisions, code changes, and guardian interventions",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "Task ID",
            },
          },
          required: ["taskId"],
        },
      },
      {
        name: "get_status_history",
        description: "Get status transition history for a task",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "Task ID",
            },
          },
          required: ["taskId"],
        },
      },
      {
        name: "get_decisions",
        description: "Get all decisions made for a task",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "Task ID",
            },
          },
          required: ["taskId"],
        },
      },
      {
        name: "get_guardian_interventions",
        description: "Get all guardian interventions for a task",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "Task ID",
            },
          },
          required: ["taskId"],
        },
      },
      {
        name: "get_code_changes",
        description: "Get all code changes for a task",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "Task ID",
            },
          },
          required: ["taskId"],
        },
      },
      {
        name: "record_decision",
        description: "Record a decision made during task execution",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "Task ID",
            },
            decision: {
              type: "string",
              description: "The decision made",
            },
            rationale: {
              type: "string",
              description: "Rationale for the decision",
            },
            actor: {
              type: "string",
              enum: ["claude", "human"],
              description: "Who made the decision",
            },
            context: {
              type: "string",
              description: "Additional context (optional)",
            },
          },
          required: ["taskId", "decision", "rationale", "actor"],
        },
      },
      {
        name: "record_code_change",
        description: "Record a code change made during task execution",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "Task ID",
            },
            files: {
              type: "array",
              items: { type: "string" },
              description: "List of files changed",
            },
            description: {
              type: "string",
              description: "Description of the change",
            },
            diff: {
              type: "string",
              description: "Git diff (optional)",
            },
            commitHash: {
              type: "string",
              description: "Git commit hash (optional)",
            },
          },
          required: ["taskId", "files", "description"],
        },
      },
      {
        name: "record_guardian_intervention",
        description: "Record a guardian intervention during task execution",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "Task ID",
            },
            guardianType: {
              type: "string",
              enum: ["database", "architecture", "api", "production-ready", "test-maintainer"],
              description: "Type of guardian",
            },
            issue: {
              type: "string",
              description: "Issue identified",
            },
            action: {
              type: "string",
              description: "Action taken",
            },
          },
          required: ["taskId", "guardianType", "issue", "action"],
        },
      },
      {
        name: "record_status_transition",
        description: "Record a status transition for a task",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "Task ID",
            },
            fromStatus: {
              type: "string",
              description: "Previous status",
            },
            toStatus: {
              type: "string",
              description: "New status",
            },
            reason: {
              type: "string",
              description: "Reason for transition (optional)",
            },
          },
          required: ["taskId", "fromStatus", "toStatus"],
        },
      },
      {
        name: "get_iteration_count",
        description: "Get the number of iterations (updates) for a task",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "Task ID",
            },
          },
          required: ["taskId"],
        },
      },
      {
        name: "get_task_snapshot",
        description: "Get a snapshot of a task at a specific point in time",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "Task ID",
            },
            timestamp: {
              type: "string",
              description: "ISO 8601 timestamp",
            },
          },
          required: ["taskId", "timestamp"],
        },
      },
      {
        name: "rollback_task",
        description: "Rollback a task to a previous state at a specific timestamp",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "Task ID",
            },
            targetTimestamp: {
              type: "string",
              description: "ISO 8601 timestamp to rollback to",
            },
          },
          required: ["taskId", "targetTimestamp"],
        },
      },
      {
        name: "get_task_stats",
        description: "Get aggregated statistics for a task including event counts and timeline",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "Task ID",
            },
          },
          required: ["taskId"],
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

  if (name === "delete_task") {
    const result = await deleteTask((args as any).id);
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

  if (name === "get_execution_order") {
    const result = await getExecutionOrder(args as any);
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
    const result = await decomposeStory((args as any).userStory, (args as any).autoAnalyze);
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

  if (name === "safe_delete_tasks_by_status") {
    const result = await safeDeleteTasksByStatus(args as any);
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

  if (name === "get_user_story_health") {
    try {
      const health = await getUserStoryHealth();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(health, null, 2),
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

  if (name === "delete_user_story") {
    const result = await deleteUserStory(args as any);
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

  if (name === "get_project_configuration") {
    try {
      const config = await getProjectConfiguration(args as any);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(config, null, 2),
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

  if (name === "initialize_project_configuration") {
    try {
      const result = await initializeProjectConfiguration(args as any);
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

  if (name === "add_tech_stack") {
    try {
      const result = await addTechStack(args as any);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
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

  if (name === "update_tech_stack") {
    try {
      const result = await updateTechStack(args as any);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
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

  if (name === "remove_tech_stack") {
    try {
      const result = await removeTechStack(args as any);
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

  if (name === "add_sub_agent") {
    try {
      const result = await addSubAgent(args as any);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
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

  if (name === "update_sub_agent") {
    try {
      const result = await updateSubAgent(args as any);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
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

  if (name === "add_mcp_tool") {
    try {
      const result = await addMCPTool(args as any);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
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

  if (name === "update_mcp_tool") {
    try {
      const result = await updateMCPTool(args as any);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
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

  if (name === "add_guideline") {
    try {
      const result = await addGuideline(args as any);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
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

  if (name === "add_code_pattern") {
    try {
      const result = await addCodePattern(args as any);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
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

  if (name === "read_claude_code_agents") {
    try {
      const result = await readClaudeCodeAgents(args as any);
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

  if (name === "sync_claude_code_agents") {
    try {
      const result = await syncClaudeCodeAgents(args as any);
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

  if (name === "suggest_agents_for_task") {
    try {
      const result = await suggestAgentsForTask(args as any);
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

  if (name === "suggest_tools_for_task") {
    try {
      const result = await suggestToolsForTask(args as any);
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

  if (name === "update_agent_prompt_templates") {
    try {
      const result = await updateAgentPromptTemplates(args as any);
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

  if (name === "get_task_history") {
    try {
      const history = await getTaskHistory((args as any).taskId);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(history, null, 2),
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

  if (name === "get_status_history") {
    try {
      const history = await getStatusHistory((args as any).taskId);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(history, null, 2),
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

  if (name === "get_decisions") {
    try {
      const decisions = await getDecisions((args as any).taskId);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(decisions, null, 2),
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

  if (name === "get_guardian_interventions") {
    try {
      const interventions = await getGuardianInterventions((args as any).taskId);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(interventions, null, 2),
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

  if (name === "get_code_changes") {
    try {
      const changes = await getCodeChanges((args as any).taskId);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(changes, null, 2),
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

  if (name === "record_decision") {
    try {
      await recordDecision({
        taskId: (args as any).taskId,
        decision: (args as any).decision,
        rationale: (args as any).rationale,
        actor: (args as any).actor,
        context: (args as any).context,
        timestamp: new Date(),
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, message: "Decision recorded" }, null, 2),
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

  if (name === "record_code_change") {
    try {
      await recordCodeChange({
        taskId: (args as any).taskId,
        files: (args as any).files,
        description: (args as any).description,
        diff: (args as any).diff,
        commitHash: (args as any).commitHash,
        timestamp: new Date(),
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, message: "Code change recorded" }, null, 2),
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

  if (name === "record_guardian_intervention") {
    try {
      await recordGuardianIntervention({
        taskId: (args as any).taskId,
        guardianType: (args as any).guardianType,
        issue: (args as any).issue,
        action: (args as any).action,
        timestamp: new Date(),
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, message: "Guardian intervention recorded" }, null, 2),
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

  if (name === "record_status_transition") {
    try {
      await recordStatusTransition(
        (args as any).taskId,
        (args as any).fromStatus,
        (args as any).toStatus,
        (args as any).reason
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, message: "Status transition recorded" }, null, 2),
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

  if (name === "get_iteration_count") {
    try {
      const count = await getIterationCount((args as any).taskId);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ count }, null, 2),
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

  if (name === "get_task_snapshot") {
    try {
      const snapshot = await getTaskSnapshot(
        (args as any).taskId,
        new Date((args as any).timestamp)
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(snapshot, null, 2),
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

  if (name === "rollback_task") {
    try {
      const result = await rollbackTask(
        (args as any).taskId,
        new Date((args as any).targetTimestamp)
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, snapshot: result }, null, 2),
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

  if (name === "get_task_stats") {
    try {
      const stats = await getTaskStats((args as any).taskId);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(stats, null, 2),
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

  throw new Error(`Unknown tool: ${name}`);
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🎭 Orchestro MCP server running on stdio (v2.1.0)");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
