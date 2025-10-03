# 🚀 Orchestro Installation Options

Orchestro offers multiple installation paths to suit different user preferences and scenarios.

---

## 📦 Option 1: NPX One-Command Install ⚡ (Recommended)

**Perfect for**: First-time users, quick setup

```bash
npx @orchestro/init
```

### What It Does
✅ Checks prerequisites (Node.js 18+, Git, Claude Code)
✅ Prompts for configuration (Database URL, project name)
✅ Clones repository and installs dependencies
✅ Builds TypeScript automatically
✅ Creates `.env` file
✅ Configures Claude Code automatically
✅ Runs database migrations
✅ Ready in 1-2 minutes!

### Interactive Flow
```
🎭 Orchestro Installation
   Your AI Development Conductor

🔍 Checking prerequisites...
✓ Node.js: v20.11.0
✓ Git: Installed
✓ Claude Code: Installed

📝 Configuration
? Where to install Orchestro? (./orchestro)
? Supabase Database URL: postgresql://...
? Project name: (My Project)

📦 Installing Orchestro...
✓ Repository cloned
✓ Dependencies installed
✓ Build completed

⚙️  Creating .env file...
✓ .env file created

🔧 Configuring Claude Code...
✓ Claude Code configured

🗄️  Running database migrations...
✓ Migrations completed

🎉 Orchestro installed successfully!
```

**Next Steps**:
1. Restart Claude Code
2. Open your project
3. Start using Orchestro tools!

---

## 🔧 Option 2: Interactive Setup Script

**Perfect for**: Manual installation, existing clone

```bash
git clone https://github.com/yourusername/orchestro.git
cd orchestro
npm install
npm run setup
```

### What It Does
✅ Interactive wizard asks for configuration
✅ Creates `.env` file
✅ Configures Claude Code automatically
✅ Runs database migrations
✅ Verifies setup

### When to Use
- You already cloned the repository
- You want more control over the process
- You're developing/contributing to Orchestro
- You need to reconfigure an existing installation

---

## ⚙️ Option 3: Auto-Configure Existing Installation

**Perfect for**: Updating configuration, adding to Claude Code

```bash
cd orchestro
npm run configure-claude
```

### What It Does
✅ Reads `.env` file for DATABASE_URL
✅ Updates Claude Code config
✅ Preserves existing MCP servers
✅ Uses absolute paths

### When to Use
- Claude Code config was manually removed
- You moved the Orchestro directory
- You want to update environment variables
- You're switching between multiple projects

---

## 🔬 Option 4: Step-by-Step Manual Setup

**Perfect for**: Troubleshooting, custom configuration

### 1. Clone & Install
```bash
git clone https://github.com/yourusername/orchestro.git
cd orchestro
npm install
```

### 2. Build TypeScript
```bash
npm run build
```

### 3. Create `.env` File
```bash
cat > .env << EOF
DATABASE_URL=postgresql://user:pass@host:port/db
PROJECT_NAME=My Project
EOF
```

### 4. Configure Claude Code Manually

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

Add to config:
```json
{
  "mcpServers": {
    "orchestro": {
      "command": "node",
      "args": ["/absolute/path/to/orchestro/dist/server.js"],
      "env": {
        "DATABASE_URL": "postgresql://..."
      }
    }
  }
}
```

### 5. Run Migrations
```bash
npm run migrate
```

### 6. Verify
```bash
npm test
```

### 7. Restart Claude Code

---

## 🧪 Option 5: Dry-Run Test (No Changes)

**Perfect for**: Validation, pre-flight checks

```bash
npm test
# or
npm run test:setup
```

### What It Does
✅ Checks Node.js version
✅ Validates Claude Code config exists
✅ Verifies build artifacts
✅ Checks environment variables
✅ Lists available scripts
✅ Counts migration files
❌ **Does not make any changes**

### Output Example
```
🔍 Checking prerequisites...
✓ Node.js: v20.11.0
✓ Platform: darwin
✓ Claude Code config: Found
✓ MCP Servers: 2 (mcp-coder-expert, orchestro)
✓ Orchestro build: Exists (35.81 KB)
✓ Environment: .env configured
✓ Scripts: All available (setup, configure-claude, migrate, test)
✓ Migrations: 9 files found

🎉 Ready to run setup!
```

---

## 📊 Comparison Table

| Feature | NPX Install | Interactive Setup | Auto-Configure | Manual Setup | Dry-Run |
|---------|------------|-------------------|----------------|--------------|---------|
| **Time Required** | 1-2 min | 3-5 min | 1 min | 5-10 min | 30 sec |
| **Prerequisites Check** | ✅ Auto | ✅ Auto | ❌ | ❌ Manual | ✅ Auto |
| **Clone Repository** | ✅ Auto | ❌ Manual | ❌ | ❌ Manual | ❌ |
| **Install Dependencies** | ✅ Auto | ❌ Manual | ❌ | ❌ Manual | ❌ |
| **Build TypeScript** | ✅ Auto | ❌ Manual | ❌ | ❌ Manual | ❌ |
| **Create .env** | ✅ Auto | ✅ Auto | ❌ | ❌ Manual | ❌ |
| **Configure Claude** | ✅ Auto | ✅ Auto | ✅ Auto | ❌ Manual | ❌ |
| **Run Migrations** | ✅ Auto | ✅ Auto | ❌ | ❌ Manual | ❌ |
| **Validation** | ✅ Yes | ✅ Yes | ✅ Yes | ❌ | ✅ Yes |
| **Rollback** | ✅ Yes | ❌ | ❌ | ❌ | N/A |
| **Best For** | New users | Developers | Updates | Custom | Testing |

---

## 🎯 Decision Guide

### Choose NPX Install if:
- ✅ You're installing for the first time
- ✅ You want the fastest setup
- ✅ You prefer automation over control
- ✅ You trust automated configuration

### Choose Interactive Setup if:
- ✅ You already cloned the repository
- ✅ You're contributing to Orchestro
- ✅ You need to reconfigure settings
- ✅ You want a guided process

### Choose Auto-Configure if:
- ✅ Claude Code config was removed
- ✅ You moved the installation directory
- ✅ You're switching projects
- ✅ You only need to update config

### Choose Manual Setup if:
- ✅ You're troubleshooting issues
- ✅ You need custom configuration
- ✅ You're learning how it works
- ✅ Automated tools aren't working

### Choose Dry-Run Test if:
- ✅ You want to verify before setup
- ✅ You're checking prerequisites
- ✅ You need to validate configuration
- ✅ You're diagnosing problems

---

## 🔄 Migration Between Options

### From NPX to Manual Control
```bash
# NPX installed at ~/orchestro
cd ~/orchestro

# Now you can use any npm script
npm run configure-claude
npm run migrate
npm run dashboard
```

### From Manual to Auto-Configure
```bash
# After manual setup, use auto-configure for updates
npm run configure-claude
```

### Update Existing Installation
```bash
cd orchestro
git pull origin main
npm install
npm run build
npm run configure-claude  # Update config with new paths
npm run migrate           # Run new migrations
```

---

## 🛠️ Troubleshooting

### NPX Install Failed
```bash
# Try manual installation instead
git clone https://github.com/yourusername/orchestro.git
cd orchestro
npm install
npm run setup
```

### Claude Config Not Updated
```bash
# Run auto-configure
npm run configure-claude
```

### Migrations Failed
```bash
# Run manually
npm run migrate
```

### Validation Errors
```bash
# Check prerequisites
npm test
```

### Clean Reinstall
```bash
# Remove and reinstall
rm -rf orchestro
npx @orchestro/init
```

---

## 📋 Prerequisites (All Options)

**Required**:
- ✅ Node.js 18+ ([download](https://nodejs.org/))
- ✅ Git ([download](https://git-scm.com/))
- ✅ Claude Code ([download](https://claude.ai/download))
- ✅ Supabase account ([free tier](https://supabase.com/))

**Platform Support**:
- ✅ macOS (darwin)
- ✅ Windows (win32)
- ✅ Linux

---

## 🎉 Success Indicators

After installation (any option), you should see:

### 1. Build Artifacts
```bash
ls -la dist/
# Should contain: server.js (35KB+)
```

### 2. Environment Configuration
```bash
cat .env
# Should contain: DATABASE_URL, PROJECT_NAME
```

### 3. Claude Code Config
```bash
# macOS
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json
# Should contain "orchestro" server
```

### 4. Database Tables
```bash
npm run migrate
# Should show: ✓ All migrations completed
```

### 5. MCP Server Running
After restarting Claude Code, check server logs showing:
```
🎭 Orchestro MCP server running on stdio (v2.1.0)
```

---

## 📚 Additional Resources

- [Main README](README.md) - Project overview
- [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md) - Detailed integration
- [TEST_RESULTS.md](TEST_RESULTS.md) - Validation tests
- [NPX_PACKAGE.md](NPX_PACKAGE.md) - NPX implementation details
- [packages/init/PUBLISHING.md](packages/init/PUBLISHING.md) - Publishing guide

---

<div align="center">

**🎭 Choose Your Installation Path**

All roads lead to the same destination: **A fully configured Orchestro installation**

The fastest? `npx @orchestro/init` ⚡

</div>
