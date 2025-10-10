# Orchestro Configuration System - Complete Guide

## Overview

The Orchestro Configuration System is a comprehensive solution for managing project configurations, including tech stack, sub-agents, MCP tools, guidelines, code patterns, and guardian agents. The system provides both programmatic (MCP tools) and UI-based configuration management.

---

## Architecture

### Database Layer

**Migration:** `src/db/migrations/012_project_configuration_system.sql`

**Tables Created:**
- `project_configuration` - Main configuration settings
- `tech_stack` - Technology stack entries
- `sub_agents` - Claude Code sub-agents configuration
- `mcp_tools` - MCP tools registry
- `project_guidelines` - Project-specific guidelines
- `code_patterns_library` - Reusable code patterns
- `guardian_agents` - Guardian agents for code quality
- `guardian_validations` - Audit log of validations
- `configuration_versions` - Configuration version history

**Key Functions:**
- `get_active_project_config(project_id)` - Get complete configuration
- `recommend_tools_for_task(description, project_id)` - AI-powered tool recommendations
- `run_guardians_on_task(task_id, context)` - Execute guardian validations
- `get_guardian_report(task_id)` - Get validation report
- `create_configuration_snapshot()` - Auto-versioning trigger

---

## TypeScript Types

### Core Types

**`src/types/configuration.ts`**
- `TechStack`, `TechStackInput` - Tech stack configuration
- `SubAgent`, `SubAgentInput` - Sub-agent configuration
- `MCPTool`, `MCPToolInput` - MCP tool configuration
- `ProjectGuideline`, `CodePattern` - Guidelines and patterns
- `CompleteProjectConfig` - Full configuration structure

**`src/types/guardians.ts`**
- `GuardianAgent` - Guardian agent definition
- `GuardianValidationResult` - Validation results
- `GuardianRunContext` - Execution context
- `IGuardian` - Guardian interface

**`src/types/mcp-tools.ts`**
- `ToolOrchestrationContext` - Tool recommendation context
- `ToolRecommendation` - Recommendation result
- `DEFAULT_MCP_TOOLS` - Pre-configured tools
- `DEFAULT_SUB_AGENTS` - Pre-configured agents

---

## MCP Tools (11 Tools)

### Configuration Management

1. **get_project_configuration**
   ```typescript
   { projectId: string }
   → CompleteProjectConfig
   ```

2. **initialize_project_configuration**
   ```typescript
   { projectId: string }
   → { success: boolean, message: string }
   ```

### Tech Stack

3. **add_tech_stack**
   ```typescript
   { projectId: string, techStack: TechStackInput }
   → TechStack
   ```

4. **update_tech_stack**
   ```typescript
   { id: string, updates: Partial<TechStackInput> }
   → TechStack
   ```

5. **remove_tech_stack**
   ```typescript
   { id: string }
   → { success: boolean }
   ```

### Sub-Agents

6. **add_sub_agent**
   ```typescript
   { projectId: string, subAgent: SubAgentInput }
   → SubAgent
   ```

7. **update_sub_agent**
   ```typescript
   { id: string, updates: Partial<SubAgentInput> }
   → SubAgent
   ```

### MCP Tools

8. **add_mcp_tool**
   ```typescript
   { projectId: string, tool: MCPToolInput }
   → MCPTool
   ```

9. **update_mcp_tool**
   ```typescript
   { id: string, updates: Partial<MCPToolInput> }
   → MCPTool
   ```

### Guidelines & Patterns

10. **add_guideline**
    ```typescript
    { projectId: string, guideline: ProjectGuidelineInput }
    → ProjectGuideline
    ```

11. **add_code_pattern**
    ```typescript
    { projectId: string, pattern: CodePatternInput }
    → CodePattern
    ```

---

## Tool Orchestration System

### MCPToolOrchestrator

**Location:** `src/lib/toolOrchestration.ts`

**Key Methods:**
- `analyzeTaskForTools(context)` - Analyze task and recommend tools
- `getTool(name, projectId)` - Get tool by name
- `recordToolUsage(toolName, success, metadata)` - Track usage
- `getToolStats(toolName)` - Get usage statistics

**Features:**
- AI-powered tool recommendations based on task description
- Confidence scoring (0.0 to 1.0)
- Historical success rate tracking
- Priority-based ordering

### ToolRegistry

**Location:** `src/lib/toolRegistry.ts`

**Default Tools:**
- Memory (native-claude-memory)
- Sequential Thinking (sequential-thinking-mcp)
- GitHub (github-mcp)
- Supabase (@supabase/mcp)
- Claude Context (context-mcp)
- Orchestro (orchestro)

**Default Sub-Agents:**
- Architecture Guardian
- Database Guardian
- Test Maintainer
- API Guardian
- Production Ready Code Reviewer
- General Purpose

**Key Methods:**
- `initializeDefaultToolsForProject(projectId)` - Setup default tools
- `initializeDefaultSubAgentsForProject(projectId)` - Setup default agents
- `getActiveSubAgents(projectId)` - Get enabled agents
- `getActiveMCPTools(projectId)` - Get enabled tools
- `matchSubAgentsToTask(description, agents)` - Match agents to task
- `buildToolingInstructions(agents, tools)` - Build context for Claude

---

## Guardian Agents System

### Base Guardian

**Location:** `src/lib/guardians/BaseGuardian.ts`

**Abstract Class:** `BaseGuardian implements IGuardian`

**Methods:**
- `validate(context)` - Main validation method
- `autoFix(issue, context)` - Auto-fix method (optional)
- `isEnabled()` - Check if enabled

**Helper Methods:**
- `warning(message, details)` - Create warning
- `error(message, details, canBlock)` - Create error
- `info(message, details)` - Create info
- `fixed(message, details)` - Create fixed notification

### Implemented Guardians

#### DatabaseGuardian

**Location:** `src/lib/guardians/DatabaseGuardian.ts`

**Configuration:**
```typescript
{
  checkSchemaConsistency: boolean,
  preventDuplicateTables: boolean,
  validateMigrations: boolean,
  ensureIndexesOnFK: boolean,
  checkCascadeRules: boolean
}
```

**Validations:**
- Duplicate table detection
- Migration syntax validation
- Foreign key index verification
- Cascade rule checking

#### ArchitectureGuardian

**Location:** `src/lib/guardians/ArchitectureGuardian.ts`

**Configuration:**
```typescript
{
  detectCircularDependencies: boolean,
  enforceLayerBoundaries: boolean,
  checkNamingConventions: boolean,
  validateModuleStructure: boolean,
  layerRules?: {
    allowedDependencies: Record<string, string[]>
  }
}
```

**Validations:**
- Circular dependency detection
- Layer boundary enforcement (UI → Service → Data)
- Naming convention checks (PascalCase for components, camelCase for libs)
- Module structure validation

### GuardianRegistry

**Location:** `src/lib/guardians/GuardianRegistry.ts`

**Key Methods:**
- `createGuardian(type, config)` - Factory method
- `loadGuardiansForProject(projectId)` - Load from database
- `runAllGuardians(context)` - Execute all enabled guardians
- `getGuardianReport(taskId)` - Get validation report
- `initializeDefaultGuardians(projectId)` - Setup defaults

**Usage:**
```typescript
import { guardianRegistry, runGuardiansOnTask } from './lib/guardians/GuardianRegistry.js';

const results = await runGuardiansOnTask(taskId, {
  taskDescription: 'Create new API endpoint',
  filesToModify: ['src/api/users.ts'],
  filesToCreate: ['src/api/auth.ts'],
  dependencies: [...],
});
```

---

## Web Dashboard UI

### Configuration Page

**Location:** `web-dashboard/app/config/page.tsx`

**Sections:**

1. **Tech Stack Configuration**
   - Category selection (frontend, backend, database, testing, deployment, other)
   - Framework and version inputs
   - Primary technology toggle
   - CRUD operations

2. **Sub-Agent Configuration**
   - Agent type selection (6 predefined types)
   - Trigger rules editor
   - Custom prompts
   - Priority slider (1-10)
   - Enable/disable toggles

3. **MCP Tools Configuration**
   - Tool type selection (6 predefined tools + custom)
   - Command and URL configuration
   - "When to use" scenarios
   - Fallback configuration
   - Usage statistics

4. **Guidelines Editor**
   - Always Do list
   - Never Do list
   - Code Patterns library

5. **Guardian Agents Configuration**
   - Guardian list
   - Enable/disable toggles
   - Auto-fix capability
   - Priority settings

### UI Components

**Created Components:**

1. **TechStackCard.tsx** - Tech stack entry card
2. **SubAgentCard.tsx** - Sub-agent configuration card
3. **MCPToolCard.tsx** - MCP tool configuration card
4. **GuidelineEditor.tsx** - Guidelines editor with tabs
5. **ConfigSection.tsx** - Collapsible section wrapper
6. **JSONImportExport.tsx** - Import/export dialog

**Features:**
- Responsive grid layout
- Tailwind CSS styling
- Loading states
- Error handling
- Success notifications
- Import/Export JSON
- Real-time validation

---

## Usage Examples

### 1. Initialize Project Configuration

```typescript
// Via MCP tool
const result = await useMcpTool('orchestro', 'initialize_project_configuration', {
  projectId: 'abc-123'
});

// This creates:
// - Default MCP tools (Memory, Sequential Thinking, etc.)
// - Default sub-agents (Architecture Guardian, Database Guardian, etc.)
// - Default guardian agents
```

### 2. Add Tech Stack

```typescript
const techStack = await useMcpTool('orchestro', 'add_tech_stack', {
  projectId: 'abc-123',
  techStack: {
    category: 'frontend',
    framework: 'React',
    version: '18.2.0',
    isPrimary: true,
    configuration: {
      typescript: true,
      stateManagement: 'Redux'
    }
  }
});
```

### 3. Configure Sub-Agent

```typescript
const agent = await useMcpTool('orchestro', 'add_sub_agent', {
  projectId: 'abc-123',
  subAgent: {
    name: 'Custom Security Agent',
    agentType: 'custom',
    enabled: true,
    triggers: ['security audit', 'vulnerability scan', 'auth changes'],
    customPrompt: 'Review code for security vulnerabilities and best practices',
    rules: [],
    priority: 1,
    configuration: {
      checkOWASPTop10: true,
      auditDependencies: true
    }
  }
});
```

### 4. Add MCP Tool

```typescript
const tool = await useMcpTool('orchestro', 'add_mcp_tool', {
  projectId: 'abc-123',
  tool: {
    name: 'Custom Linter',
    toolType: 'custom',
    command: 'npx custom-lint',
    enabled: true,
    whenToUse: ['code quality', 'linting', 'style checking'],
    priority: 3,
    fallbackTool: 'eslint',
    configuration: {
      rules: 'strict'
    }
  }
});
```

### 5. Get Recommended Tools for Task

```typescript
const recommendations = await supabase.rpc('recommend_tools_for_task', {
  p_task_description: 'Implement authentication with JWT tokens',
  p_project_id: 'abc-123',
  p_limit: 5
});

// Returns:
// [
//   { tool_name: 'supabase', confidence: 0.85, reason: 'database operations, auth' },
//   { tool_name: 'sequential-thinking', confidence: 0.72, reason: 'complex logic' },
//   { tool_name: 'memory', confidence: 0.68, reason: 'similar patterns' }
// ]
```

### 6. Run Guardians on Task

```typescript
import { runGuardiansOnTask } from './lib/guardians/GuardianRegistry.js';

const validations = await runGuardiansOnTask('task-123', {
  taskDescription: 'Create user authentication API',
  filesToCreate: ['src/api/auth.ts', 'src/middleware/jwt.ts'],
  filesToModify: ['src/db/schema.sql'],
  dependencies: [
    { type: 'api', name: '/api/users', action: 'uses' },
    { type: 'model', name: 'User', action: 'modifies' }
  ]
});

// Validations from all enabled guardians
validations.forEach(v => {
  console.log(`[${v.validationType}] ${v.guardianName}: ${v.message}`);
});
```

### 7. Enrich Task Context with Tools

```typescript
import { enrichTaskContextWithTools } from './lib/toolOrchestration.js';

const { recommendedTools, toolInstructions } = await enrichTaskContextWithTools(
  'task-123',
  'Build GraphQL API for user management'
);

// toolInstructions contains formatted markdown with:
// - Recommended tools
// - When to use each tool
// - Priority order
// - Confidence scores
```

---

## Integration Workflow

### Task Execution with Configuration

```typescript
// 1. Prepare task
const preparation = await useMcpTool('orchestro', 'prepare_task_for_execution', {
  taskId: 'task-123'
});

// 2. Analyze codebase (Claude Code does this)
// ... use Read, Grep, Glob tools ...

// 3. Save analysis
const analysis = await useMcpTool('orchestro', 'save_task_analysis', {
  taskId: 'task-123',
  analysis: {
    filesToModify: ['src/api/users.ts'],
    filesToCreate: ['src/api/auth.ts'],
    dependencies: [...],
    risks: [...],
    recommendations: [...]
  }
});

// 4. Get enriched execution prompt (with tools and agents)
const execution = await useMcpTool('orchestro', 'get_execution_prompt', {
  taskId: 'task-123'
});

// execution.prompt includes:
// - Task context
// - Recommended MCP tools
// - Recommended sub-agents
// - Project guidelines
// - Code patterns
// - Guardian instructions

// 5. Run guardians before completion
const guardianResults = await runGuardiansOnTask('task-123', {
  taskDescription: execution.task.description,
  filesToModify: execution.analysis.filesToModify,
  filesToCreate: execution.analysis.filesToCreate
});

// 6. Check for blocking errors
const blockingErrors = guardianResults.filter(r => r.canBlock && r.validationType === 'error');
if (blockingErrors.length > 0) {
  // Handle blocking issues
}
```

---

## Configuration Versioning

### Auto-Snapshot on Changes

Every time the configuration is updated, a snapshot is automatically created:

```sql
-- Trigger on project_configuration UPDATE
CREATE TRIGGER snapshot_on_config_update
  AFTER UPDATE ON project_configuration
  FOR EACH ROW
  WHEN (OLD.configuration IS DISTINCT FROM NEW.configuration)
  EXECUTE FUNCTION create_configuration_snapshot();
```

### Rollback to Previous Version

```typescript
// Get version history
const { data: versions } = await supabase
  .from('configuration_versions')
  .select('*')
  .eq('project_id', projectId)
  .order('version', { ascending: false });

// Restore specific version
const versionToRestore = versions[2]; // Version 3
const snapshot = versionToRestore.configuration_snapshot;

// Apply snapshot (restore tech stack, tools, agents, etc.)
// This would require custom restoration logic
```

---

## Best Practices

### 1. Tool Recommendation

- Keep "whenToUse" scenarios descriptive and keyword-rich
- Update success/failure counts after tool usage
- Use priority to influence recommendation order

### 2. Guardian Configuration

- Enable guardians appropriate for your project type
- Configure auto-fix only for non-destructive fixes
- Review guardian validations regularly

### 3. Sub-Agent Setup

- Match triggers to common task descriptions
- Write clear custom prompts
- Set priorities based on importance (1 = highest)

### 4. Guidelines Management

- Keep guidelines concise and actionable
- Include examples in code patterns
- Tag guidelines for easy filtering

### 5. Configuration Import/Export

- Export configurations regularly as backup
- Use JSON export for sharing between projects
- Version control your configuration files

---

## Troubleshooting

### Issue: Tools not recommended

**Solution:**
- Check "whenToUse" scenarios contain relevant keywords
- Verify tool is enabled: `enabled = true`
- Check tool priority (lower number = higher priority)

### Issue: Guardian not running

**Solution:**
- Verify guardian is enabled in configuration
- Check guardian priority
- Ensure guardian is loaded: `guardianRegistry.loadGuardiansForProject(projectId)`

### Issue: Configuration not persisting

**Solution:**
- Check database connection
- Verify migration 012 is applied
- Check for constraint violations in data

### Issue: Import/Export failing

**Solution:**
- Validate JSON structure matches schema
- Check for missing required fields
- Ensure projectId exists in database

---

## API Routes Reference

### GET /api/config
Get project configuration

### POST /api/config/apply
Apply configuration changes

### POST /api/config/test
Test configuration validity

### POST /api/config/import
Import configuration from JSON

### POST /api/config/tech-stack
Add tech stack entry

### PATCH /api/config/tech-stack/[id]
Update tech stack entry

### DELETE /api/config/tech-stack/[id]
Remove tech stack entry

### POST /api/config/sub-agents
Add sub-agent

### PATCH /api/config/sub-agents/[id]
Update sub-agent

### POST /api/config/mcp-tools
Add MCP tool

### PATCH /api/config/mcp-tools/[id]
Update MCP tool

### PATCH /api/config/guidelines
Update guidelines

### PATCH /api/config/guardians/[id]
Update guardian configuration

---

## Next Steps

1. **Apply Migration**
   ```bash
   psql -h <host> -U <user> -d <database> \
     -f src/db/migrations/012_project_configuration_system.sql
   ```

2. **Build Project**
   ```bash
   npm run build
   ```

3. **Start MCP Server**
   ```bash
   npm start
   ```

4. **Access Dashboard**
   ```bash
   cd web-dashboard
   npm run dev
   # Visit http://localhost:3000/config
   ```

5. **Initialize Project**
   ```typescript
   await useMcpTool('orchestro', 'initialize_project_configuration', {
     projectId: '<your-project-id>'
   });
   ```

---

## Summary

The Orchestro Configuration System provides:

✅ **Database schema** for configuration persistence
✅ **11 MCP tools** for programmatic configuration
✅ **Tool orchestration** with AI-powered recommendations
✅ **Guardian agents** for code quality protection
✅ **Web UI** for visual configuration management
✅ **Import/Export** for backup and sharing
✅ **Version control** with automatic snapshots
✅ **TypeScript types** for type safety

The system is production-ready and fully integrated with the Orchestro MCP server.
