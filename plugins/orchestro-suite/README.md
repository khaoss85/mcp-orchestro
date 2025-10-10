# Orchestro Suite Plugin

> Your AI Development Conductor - Intelligent task orchestration with 50+ MCP tools and 5 specialized guardian agents

## Overview

**Orchestro Suite** is a comprehensive Claude Code plugin that transforms your development workflow with AI-powered task management, intelligent decomposition, and proactive code guardians.

### What's Included

#### 🤖 5 Guardian Agents
Specialized sub-agents that automatically monitor and protect your code:

- **database-guardian** - Ensures database schema alignment and prevents orphaned fields
- **api-guardian** - Maintains frontend-backend consistency across API changes
- **architecture-guardian** - Prevents code duplication and enforces architectural patterns
- **test-maintainer** - Keeps test suites updated and organized
- **production-ready-code-reviewer** - Eliminates placeholders and ensures production-quality code

#### 🛠️ 50+ MCP Tools
Complete task orchestration system via `mcp__orchestro__*` tools:

- **Task Management**: Create, update, list, and delete tasks with dependencies
- **User Story Decomposition**: Automatically break down stories into technical tasks
- **Pattern Learning**: Capture and reuse successful development patterns
- **Execution Workflow**: Guided task analysis and context-aware prompts
- **Conflict Detection**: Identify resource conflicts between tasks
- **Knowledge Base**: Templates, patterns, and learnings from past work

## Installation

### Prerequisites

1. **Supabase Account** (free tier works)
   - Create a project at [supabase.com](https://supabase.com)
   - Get your project URL and service key

2. **Environment Variables**
   Set these in your shell profile (`~/.zshrc`, `~/.bashrc`, etc.):
   ```bash
   export SUPABASE_URL="https://your-project.supabase.co"
   export SUPABASE_SERVICE_KEY="your-service-key"
   export ANTHROPIC_API_KEY="your-anthropic-key"
   ```

### Quick Install

```bash
# Add the Orchestro marketplace
/plugin marketplace add pelleri/mcp-coder-expert

# Install the plugin
/plugin install orchestro-suite@orchestro-marketplace

# Restart Claude Code
```

## Usage

### Task Management Workflow

```bash
# Decompose a user story into tasks
/decompose "User should be able to export data to CSV"

# List all tasks
mcp__orchestro__list_tasks

# Prepare a task for execution
mcp__orchestro__prepare_task_for_execution { "taskId": "task-id-here" }

# Save your analysis
mcp__orchestro__save_task_analysis { "taskId": "...", "analysis": {...} }

# Get enriched execution prompt
mcp__orchestro__get_execution_prompt { "taskId": "..." }
```

### Guardian Agents in Action

Guardian agents activate automatically:

- **Before database changes**: database-guardian checks schema alignment
- **After API modifications**: api-guardian ensures frontend compatibility
- **Before commits**: production-ready-code-reviewer scans for placeholders
- **When creating components**: architecture-guardian checks for duplicates
- **After implementation**: test-maintainer updates test suites

### Common Commands

```bash
# View all available guardian agents
/agents

# Get task execution order
mcp__orchestro__get_execution_order {}

# Check for pattern risks
mcp__orchestro__check_pattern_risk { "pattern": "pattern-name" }

# Get top patterns
mcp__orchestro__get_top_patterns { "limit": 10 }

# Add feedback after completing a task
mcp__orchestro__add_feedback {
  "taskId": "...",
  "feedback": "What I learned",
  "type": "success",
  "pattern": "react-component"
}
```

## Configuration

### Supabase Setup

The plugin requires a Supabase database. On first run, Orchestro will create the necessary tables automatically. The schema includes:

- `tasks` - Task tracking with dependencies
- `user_stories` - High-level user stories
- `projects` - Project configuration
- `learnings` - Pattern and knowledge capture
- `sub_agents` - Guardian agent configurations
- `mcp_tools` - Tool metadata

### Customizing Guardian Agents

Guardian agents are defined in the `agents/` directory. You can:

1. Modify agent prompts to match your workflow
2. Add custom rules and triggers
3. Adjust agent priorities

## Examples

### Example 1: Feature Development

```bash
# Decompose feature into tasks
/decompose "Add dark mode toggle to settings"

# System creates 5 tasks with dependencies
# Analyze first task
mcp__orchestro__prepare_task_for_execution { "taskId": "..." }

# Implement with context
mcp__orchestro__get_execution_prompt { "taskId": "..." }

# Guardian agents activate automatically during implementation
```

### Example 2: Database Changes

```bash
# When you modify a database model:
# 1. database-guardian activates automatically
# 2. Checks for orphaned fields and missing migrations
# 3. Validates schema alignment
# 4. Suggests cascading rules
```

## Troubleshooting

### Plugin Not Loading

1. Verify environment variables are set: `echo $SUPABASE_URL`
2. Check Supabase connection: Test credentials in Supabase dashboard
3. Restart Claude Code after setting environment variables

### MCP Tools Not Available

1. Ensure Orchestro server is running: `npx orchestro@latest`
2. Check for errors in Claude Code output
3. Verify `npx` is available: `which npx`

### Guardian Agents Not Activating

1. Check agents are installed: `/agents`
2. Verify agent files in `agents/` directory
3. Review agent trigger conditions in agent files

## Support

- **GitHub**: [pelleri/mcp-coder-expert](https://github.com/pelleri/mcp-coder-expert)
- **Issues**: [Report a bug](https://github.com/pelleri/mcp-coder-expert/issues)
- **Documentation**: See main README for full docs

## License

MIT - See [LICENSE](../../LICENSE) file

---

Made with ❤️ by the Orchestro Team
