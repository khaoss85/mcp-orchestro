# 🔌 Orchestro Integration Guide

> **Complete guide to integrate Orchestro MCP server into your existing Claude Code projects**

This guide shows you how to add Orchestro's AI orchestration capabilities to any existing development project, enabling intelligent task management, dependency tracking, and pattern learning.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Project Setup](#project-setup)
5. [Connecting to Existing Projects](#connecting-to-existing-projects)
6. [First Steps](#first-steps)
7. [Workflow Integration](#workflow-integration)
8. [Troubleshooting](#troubleshooting)

---

## ✅ Prerequisites

Before integrating Orchestro, ensure you have:

- ✅ **Node.js 18+** installed
- ✅ **Claude Code** installed and working
- ✅ **Supabase account** (free tier works perfectly)
- ✅ **Existing project** you want to orchestrate

```bash
# Check Node.js version
node --version  # Should be 18.0.0 or higher

# Verify Claude Code is installed
# It should be in /Applications/Claude.app (macOS)
```

---

## 📥 Installation

### Step 1: Clone Orchestro

```bash
# Navigate to your development folder
cd ~/Documents

# Clone Orchestro
git clone https://github.com/yourusername/orchestro.git
cd orchestro

# Install dependencies
npm install

# Build TypeScript
npm run build
```

**Expected output:**
```
✓ TypeScript compilation successful
✓ MCP server built to dist/server.js
```

### Step 2: Setup Supabase Database

#### Option A: Use Our Schema (Recommended)

```bash
# 1. Create Supabase project at https://supabase.com
# 2. Copy connection string from Project Settings > Database

# 3. Run migrations
export DATABASE_URL="your-supabase-connection-string"
npm run migrate
```

#### Option B: Manual Setup

```sql
-- Run these SQL scripts in Supabase SQL Editor
-- In order:
1. src/db/migrations/001_initial_schema.sql
2. src/db/migrations/002_add_dependency_completion_check.sql
3. src/db/migrations/003_add_tasks_metadata.sql
4. src/db/migrations/004_event_queue.sql
5. src/db/migrations/005_code_entities.sql
6. src/db/migrations/006_fix_status_transition_trigger.sql
7. src/db/migrations/007_add_user_story_grouping.sql
8. src/db/migrations/008_add_task_metadata_fields.sql
9. src/db/migrations/009_add_pattern_frequency_tracking.sql
```

### Step 3: Configure Environment

```bash
# Create .env file in orchestro root
cat > .env << EOF
# Supabase Configuration
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
SUPABASE_URL=https://[PROJECT-REF].supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# Optional: Project Settings
PROJECT_NAME=My Project
PROJECT_ID=auto-generated-uuid
EOF
```

**🔐 Security Note**: Never commit `.env` file to git!

---

## ⚙️ Configuration

### Step 1: Configure Claude Code

#### macOS

```bash
# Open Claude Code config
open ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

#### Windows

```powershell
# Open in notepad
notepad %APPDATA%\Claude\claude_desktop_config.json
```

#### Linux

```bash
# Open in editor
nano ~/.config/Claude/claude_desktop_config.json
```

### Step 2: Add Orchestro MCP Server

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "orchestro": {
      "command": "node",
      "args": ["/absolute/path/to/orchestro/dist/server.js"],
      "env": {
        "DATABASE_URL": "your-supabase-connection-string"
      }
    }
  }
}
```

**⚠️ Important**:
- Use **absolute paths** (not `~` or `./`)
- Replace `/absolute/path/to/orchestro` with your actual path
- Example: `/Users/john/Documents/orchestro/dist/server.js`

### Step 3: Verify Configuration

```json
// ✅ Good example
{
  "mcpServers": {
    "orchestro": {
      "command": "node",
      "args": ["/Users/john/Documents/orchestro/dist/server.js"],
      "env": {
        "DATABASE_URL": "postgresql://postgres.abc123:pass@aws-0-eu-central-1.pooler.supabase.com:6543/postgres"
      }
    }
  }
}

// ❌ Bad example (relative paths don't work!)
{
  "mcpServers": {
    "orchestro": {
      "command": "node",
      "args": ["./orchestro/dist/server.js"],  // ❌ Don't use relative paths
      "env": {
        "DATABASE_URL": "..."
      }
    }
  }
}
```

### Step 4: Restart Claude Code

```bash
# macOS: Quit and reopen
# Or use Activity Monitor to force quit

# Windows: Close and reopen
# Or use Task Manager to end process

# Linux:
killall claude-code
claude-code &
```

---

## 🎯 Project Setup

### Create Project in Orchestro

#### Option 1: Via Dashboard

```bash
# Start dashboard
cd orchestro/web-dashboard
npm install
npm run dev

# Open http://localhost:3000
# Click "Create Project"
# Fill in:
#   - Name: Your Project Name
#   - Status: active
#   - Description: What you're building
```

#### Option 2: Via Claude Code

In Claude Code, ask:

```
Please create a new Orchestro project with:
- Name: "My E-commerce Platform"
- Status: active
- Description: "Building an e-commerce platform with Next.js and Stripe"
```

Claude will use the `get_project_info` tool to create your project.

### Link to Existing Codebase

Orchestro needs to know about your existing project structure:

```bash
# In Claude Code, run:
"Analyze my current codebase at /path/to/your/project and
create initial resource nodes in Orchestro"
```

This will:
1. Scan your project structure
2. Create resource nodes (files, components, APIs)
3. Build initial dependency graph

---

## 🔗 Connecting to Existing Projects

### Scenario 1: Existing Next.js Project

**Your project structure:**
```
my-nextjs-app/
├── app/
├── components/
├── lib/
└── package.json
```

**Integration steps:**

1. **Open Claude Code in your project directory**
   ```bash
   cd /path/to/my-nextjs-app
   code .  # Or open with Claude Code
   ```

2. **Verify Orchestro connection**
   ```
   In Claude Code: "Show me all orchestro tools"

   Expected: List of 27 MCP tools
   ```

3. **Create first user story**
   ```
   "Create a user story in Orchestro:
   'User should be able to filter products by category'"
   ```

4. **Decompose with AI**
   ```
   "Decompose this story into technical tasks using orchestro"
   ```

5. **Start implementation**
   ```
   "Prepare the first task for execution and analyze
   which files in my Next.js app need to be modified"
   ```

### Scenario 2: Backend API Project

**Your project structure:**
```
my-api/
├── src/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   └── services/
└── package.json
```

**Integration steps:**

1. **Initialize Orchestro project**
   ```
   "Create an Orchestro project for my Express API
   located at /Users/john/projects/my-api"
   ```

2. **Import existing tasks from TODO.md** (if you have one)
   ```
   "Read my TODO.md file and create Orchestro tasks from it"
   ```

3. **Build dependency graph**
   ```
   "Analyze my API codebase and build a resource dependency
   graph in Orchestro, focusing on:
   - Controllers and their routes
   - Models and database tables
   - Service layer dependencies"
   ```

4. **Start orchestrated development**
   ```
   "List all Orchestro tasks for this project and
   prepare the first one for execution"
   ```

### Scenario 3: Monorepo with Multiple Apps

**Your project structure:**
```
monorepo/
├── apps/
│   ├── web/          # Next.js frontend
│   ├── mobile/       # React Native
│   └── api/          # Express backend
├── packages/
│   └── shared/       # Shared utilities
└── package.json
```

**Integration approach:**

1. **Create separate Orchestro projects** (or use tags)
   ```
   "Create 3 Orchestro projects:
   1. 'Monorepo - Web App'
   2. 'Monorepo - Mobile App'
   3. 'Monorepo - API'

   Tag all with: ['monorepo', 'my-company']"
   ```

2. **Track cross-project dependencies**
   ```
   "When I create tasks that modify the 'shared' package,
   automatically flag potential conflicts across all 3 projects"
   ```

3. **Unified dashboard view**
   ```
   Open http://localhost:3000
   Filter tasks by tag: 'monorepo'
   See all projects together
   ```

---

## 🚀 First Steps

### 1. Verify Installation

```bash
# In Claude Code, ask:
"Test Orchestro integration by:
1. Getting project info
2. Creating a test task
3. Listing all tasks"
```

**Expected output:**
```
✅ Project info retrieved
✅ Test task created with ID: abc-123
✅ 1 task listed successfully
```

### 2. Create Your First User Story

```
"Create an Orchestro user story:
Title: 'User authentication with email/password'
Description: 'Users should be able to sign up, login,
and reset password using email and password'"
```

### 3. Decompose into Tasks

```
"Decompose this user story using Orchestro AI decomposition"
```

**Result:** 7-10 technical tasks with dependencies automatically created!

### 4. Implement First Task

```
"Prepare the first task for execution and show me:
- Which files to modify
- What dependencies exist
- Any potential risks"
```

### 5. Track Progress on Dashboard

```bash
# Open dashboard
open http://localhost:3000

# You'll see:
- Kanban board with your tasks
- Dependency graph visualization
- Real-time progress updates
```

---

## 🔄 Workflow Integration

### Daily Development Workflow

#### Morning: Plan

```bash
# 1. Open dashboard
open http://localhost:3000

# 2. In Claude Code:
"Show me today's Orchestro tasks assigned to me,
ordered by priority"

# 3. Review dependencies
"Show dependency graph for task [task-id]"
```

#### During: Implement

```bash
# 1. Prepare task
"Prepare task [task-id] for execution"

# 2. Analyze codebase (Claude uses Read/Grep/Glob)
# Orchestro provides structured prompt

# 3. Save analysis
"Save my analysis results to Orchestro"

# 4. Get enriched context
"Get execution prompt for task [task-id]"
# Includes: past patterns, risks, guidelines

# 5. Implement with confidence
# Claude has full context now!

# 6. Record learning
"Add feedback to Orchestro:
- Pattern: 'JWT authentication implementation'
- Type: success
- Feedback: 'Used bcrypt for hashing, works perfectly'"
```

#### Evening: Review

```bash
# 1. Update task statuses
"Update all my in-progress tasks to done in Orchestro"

# 2. Check for conflicts
"Check if any of my tasks conflict with other ongoing work"

# 3. Review pattern learnings
"Show me today's pattern learnings in Orchestro"

# 4. Export report (for PM/stakeholders)
"Export today's progress from Orchestro as markdown"
```

### Team Workflow

#### Product Manager Flow

```bash
# 1. Write user stories in dashboard
http://localhost:3000 > Click "New Story"

# 2. AI decomposition
Click "Decompose with AI" on story

# 3. Review technical tasks
Tasks appear automatically with:
- Time estimates
- Dependencies
- Complexity levels

# 4. Assign to developers
Drag tasks to "To Do" column
Set assignee via dropdown

# 5. Monitor progress
Real-time Kanban updates
Risk indicators show up automatically
```

#### Developer Flow

```bash
# 1. Pick task from Kanban
http://localhost:3000 > Drag task to "In Progress"

# 2. In Claude Code:
"Prepare my current in-progress Orchestro task"

# 3. Implement with AI assistance
Full context provided automatically

# 4. Record decisions
"Record this decision in Orchestro:
Why: Chose Redis over Memcached
Alternatives: Memcached, in-memory cache
Trade-offs: Redis has persistence, slightly slower"

# 5. Complete task
"Mark task as done and add success feedback"
```

---

## 🐛 Troubleshooting

### Issue 1: MCP Server Not Connecting

**Symptoms:**
```
"I don't see orchestro tools in Claude Code"
```

**Solutions:**

1. **Check config path is absolute**
   ```bash
   # ❌ Wrong
   "args": ["./orchestro/dist/server.js"]

   # ✅ Correct
   "args": ["/Users/john/Documents/orchestro/dist/server.js"]
   ```

2. **Verify build completed**
   ```bash
   cd /path/to/orchestro
   npm run build
   # Check dist/server.js exists
   ls -la dist/server.js
   ```

3. **Test server manually**
   ```bash
   cd /path/to/orchestro
   DATABASE_URL="your-url" node dist/server.js
   # Should output: "MCP server running on stdio"
   ```

4. **Check Claude Code logs**
   ```bash
   # macOS
   tail -f ~/Library/Logs/Claude/mcp*.log

   # Look for Orchestro connection errors
   ```

### Issue 2: Database Connection Fails

**Symptoms:**
```
Error: connect ECONNREFUSED
or
Error: password authentication failed
```

**Solutions:**

1. **Verify connection string**
   ```bash
   # Test with psql
   psql "$DATABASE_URL" -c "SELECT 1"
   # Should return: 1
   ```

2. **Check Supabase pooler URL** (not direct connection)
   ```bash
   # ✅ Correct (pooler)
   postgresql://postgres.abc:pass@aws-0-region.pooler.supabase.com:6543/postgres

   # ❌ Wrong (direct)
   postgresql://postgres.abc:pass@db.abc.supabase.co:5432/postgres
   ```

3. **Verify firewall allows connection**
   ```bash
   # Test connection
   nc -zv aws-0-region.pooler.supabase.com 6543
   # Should output: Connection succeeded
   ```

### Issue 3: Dashboard Not Showing Tasks

**Symptoms:**
```
Dashboard shows empty Kanban board
```

**Solutions:**

1. **Check WebSocket connection**
   ```bash
   # Open browser console on http://localhost:3000
   # Look for: "Socket connected" message
   ```

2. **Verify tasks exist in database**
   ```sql
   -- Run in Supabase SQL Editor
   SELECT * FROM tasks;
   ```

3. **Check API routes**
   ```bash
   # Test API directly
   curl http://localhost:3000/api/tasks
   # Should return JSON array
   ```

4. **Restart dashboard**
   ```bash
   cd orchestro/web-dashboard
   rm -rf .next
   npm run dev
   ```

### Issue 4: AI Decomposition Fails

**Symptoms:**
```
"Error decomposing user story"
```

**Solutions:**

1. **Check API key configuration** (if using external AI)
   ```bash
   # In .env
   OPENAI_API_KEY=sk-...
   ```

2. **Verify user story format**
   ```bash
   # ✅ Good format
   "User should be able to login with email/password"

   # ❌ Too vague
   "Login feature"
   ```

3. **Check logs**
   ```bash
   # In orchestro root
   tail -f logs/decompose.log
   ```

### Issue 5: Pattern Learning Not Working

**Symptoms:**
```
detect_failure_patterns returns empty array
```

**Solutions:**

1. **Ensure minimum data exists**
   ```sql
   -- Check learnings table
   SELECT pattern, type, COUNT(*)
   FROM learnings
   WHERE pattern IS NOT NULL
   GROUP BY pattern, type;

   -- Need at least 3 occurrences per pattern
   ```

2. **Verify trigger is active**
   ```sql
   -- Check trigger exists
   SELECT * FROM information_schema.triggers
   WHERE trigger_name = 'track_pattern_frequency';
   ```

3. **Manually test pattern tracking**
   ```
   In Claude Code:
   "Add this feedback to Orchestro:
   - Pattern: 'test pattern'
   - Type: failure
   - Feedback: 'test'

   Then check pattern_frequency table"
   ```

---

## 🎓 Best Practices

### 1. Project Organization

✅ **Do:**
- Create one Orchestro project per codebase
- Use tags to group related tasks
- Set clear assignees and priorities
- Write detailed user stories

❌ **Don't:**
- Mix unrelated projects in one Orchestro instance
- Leave tasks without descriptions
- Skip dependency mapping

### 2. Task Management

✅ **Do:**
- Decompose user stories with AI
- Review auto-generated dependencies
- Record decisions with rationale
- Add feedback after completing tasks

❌ **Don't:**
- Create tasks manually when AI can help
- Ignore risk warnings
- Skip pattern learning (add_feedback)

### 3. Team Collaboration

✅ **Do:**
- Keep dashboard visible to team
- Export reports for stakeholders
- Review conflicts before merging
- Share successful patterns

❌ **Don't:**
- Work on same files without coordination
- Hide risks from product team
- Ignore dependency warnings

---

## 🔗 Next Steps

Now that Orchestro is integrated:

1. **📖 Read**: [PM_GUIDE.md](PM_GUIDE.md) - For product managers
2. **💻 Read**: [DEV_GUIDE.md](DEV_GUIDE.md) - For developers
3. **🎯 Try**: [EXAMPLES.md](EXAMPLES.md) - Real-world examples
4. **🏗️ Understand**: [ARCHITECTURE.md](ARCHITECTURE.md) - How it works

---

## 💬 Get Help

- 📧 **Issues**: [GitHub Issues](https://github.com/yourusername/orchestro/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/yourusername/orchestro/discussions)
- 🌐 **Dashboard**: http://localhost:3000
- 📖 **Docs**: [Full documentation](README.md)

---

<div align="center">

**🎭 Happy Orchestrating!**

Your development workflow is about to get a whole lot smarter.

[← Back to README](README.md)

</div>
