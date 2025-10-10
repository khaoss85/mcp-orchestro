# Orchestro Plugin Marketplace - Testing Guide

## ✅ Structure Created

```
mcp-coder-expert/
├── .claude-plugin/
│   └── marketplace.json          ✅ Valid JSON
└── plugins/
    └── orchestro-suite/
        ├── .claude-plugin/
        │   └── plugin.json       ✅ Valid JSON
        ├── .mcp.json            ✅ Valid JSON
        ├── agents/              ✅ 5 guardian agents
        │   ├── database-guardian.md
        │   ├── api-guardian.md
        │   ├── architecture-guardian.md
        │   ├── test-maintainer.md
        │   └── production-ready-code-reviewer.md
        └── README.md            ✅ Complete documentation
```

## 🧪 Local Testing

### Option 1: Test in Current Directory

```bash
# From parent directory of mcp-orchestro
/plugin marketplace add ./mcp-orchestro

# Install the plugin
/plugin install orchestro-suite@orchestro-marketplace
```

### Option 2: Test with Absolute Path

```bash
# Add marketplace with absolute path
/plugin marketplace add /Users/pelleri/Documents/mcp-orchestro

# Install the plugin
/plugin install orchestro-suite@orchestro-marketplace
```

### Option 3: Test via GitHub (after push)

```bash
# After pushing to GitHub
/plugin marketplace add khaoss85/mcp-orchestro

# Install the plugin
/plugin install orchestro-suite@orchestro-marketplace
```

## 🔍 Verification Steps

After installation, verify:

### 1. Check Marketplace Added
```bash
/plugin marketplace list
# Should show: orchestro-marketplace
```

### 2. Check Plugin Installed
```bash
/plugin
# Navigate to "Manage Plugins"
# Should show: orchestro-suite (enabled)
```

### 3. Verify Guardian Agents
```bash
/agents
# Should list 5 new agents:
# - database-guardian
# - api-guardian
# - architecture-guardian
# - test-maintainer
# - production-ready-code-reviewer
```

### 4. Test MCP Tools
```bash
# Check Orchestro tools are available
mcp__orchestro__get_project_info

# List all tasks
mcp__orchestro__list_tasks

# Test decomposition
mcp__orchestro__decompose_story {
  "userStory": "User can export data to PDF"
}
```

## 🐛 Troubleshooting

### Plugin Not Found
**Problem**: `/plugin install` says plugin not found
**Solution**:
- Verify marketplace path with `/plugin marketplace list`
- Check marketplace.json syntax
- Ensure "source" path in marketplace.json is correct

### Agents Not Appearing
**Problem**: `/agents` doesn't show guardian agents
**Solution**:
- Restart Claude Code
- Check agents/*.md files exist in plugin directory
- Verify plugin is enabled: `/plugin`

### MCP Tools Not Available
**Problem**: `mcp__orchestro__*` commands not working
**Solution**:
- Set environment variables:
  ```bash
  export SUPABASE_URL="https://your-project.supabase.co"
  export SUPABASE_SERVICE_KEY="your-service-key"
  export ANTHROPIC_API_KEY="your-anthropic-key"
  ```
- Restart Claude Code after setting variables
- Check npx is installed: `which npx`
- Test Orchestro manually: `npx orchestro@latest`

## 📤 Publishing to GitHub

### Before Publishing

1. **Update Repository URL** in:
   - `plugins/orchestro-suite/.claude-plugin/plugin.json`
   - `.claude-plugin/marketplace.json`
   - `plugins/orchestro-suite/README.md`

2. **Add to .gitignore** (if needed):
   ```
   .env
   .claude/settings.local.json
   ```

3. **Test Locally First** using steps above

### Publishing Steps

```bash
# Add all files
git add .claude-plugin/ plugins/

# Commit
git commit -m "Add Orchestro plugin marketplace"

# Push to GitHub
git push origin main

# Tag release (optional)
git tag v2.1.0
git push origin v2.1.0
```

### After Publishing

Users can install with:
```bash
/plugin marketplace add khaoss85/mcp-orchestro
/plugin install orchestro-suite@orchestro-marketplace
```

## 🎯 Next Steps

1. **Test locally** following Option 1 or 2 above
2. **Fix any issues** found during testing
3. **Update documentation** if needed
4. **Push to GitHub**
5. **Share with community**

## 📝 Notes

- Plugin uses `npx orchestro@latest` so users don't need to install globally
- Environment variables must be set before Claude Code starts
- Guardian agents activate automatically based on context
- Supabase setup is required for full functionality

---

**Ready to test!** Start with Option 1 (local testing) and verify all steps above.
