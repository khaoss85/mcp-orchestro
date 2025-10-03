# ⚡ Orchestro Quick Install

## One-Command Setup (Coming Soon!)

```bash
npx @orchestro/init
```

*This installer is in development. Use Manual Setup below for now.*

---

## Manual Setup (2 Minutes)

### Step 1: Clone & Build

```bash
git clone https://github.com/yourusername/orchestro.git
cd orchestro
npm install
npm run build
```

### Step 2: Interactive Setup

```bash
npm run setup
```

This will:
1. ✅ Prompt for Supabase connection details
2. ✅ Create `.env` file
3. ✅ Run database migrations
4. ✅ Configure Claude Code automatically
5. ✅ Verify installation

**Example session:**
```
🎭 Orchestro Setup Wizard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Node.js 18.0.0 detected
✓ Claude Code found

📋 Let's get started!

? Database URL (pooler connection): postgresql://...
? Project name: My Project

⚙️  Creating .env file...
✓ .env file created

🗄️  Running database migrations...
✓ Database migrations completed

🔧 Configuring Claude Code...
✓ Claude Code configured

🎉 Setup Complete!

Next steps:
1. Restart Claude Code
2. Ask: "Show me orchestro tools"
3. Open dashboard: http://localhost:3000
```

### Step 3: Restart Claude Code & Verify

```
# In Claude Code:
"Show me all orchestro tools"

# Expected: 27 tools listed! 🎭
```

---

## Alternative: Step-by-Step Setup

### Configure Manually

```bash
# 1. Create .env
cat > .env << EOF
DATABASE_URL=your-supabase-connection-string
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
EOF

# 2. Configure Claude Code
npm run configure-claude

# 3. Run migrations
npm run migrate

# 4. Start dashboard (optional)
npm run dashboard
```

---

## Troubleshooting

### "MCP server not connecting"

1. Check build completed:
   ```bash
   ls -la dist/server.js
   # Should exist
   ```

2. Verify config path is absolute:
   ```bash
   # View Claude config
   cat ~/Library/Application\ Support/Claude/claude_desktop_config.json

   # Should show absolute path like:
   # "/Users/john/orchestro/dist/server.js"
   ```

3. Restart Claude Code completely

### "Database connection failed"

1. Use pooler connection string:
   ```
   ✅ postgresql://postgres.xxx:pass@aws-0-region.pooler.supabase.com:6543/postgres
   ❌ postgresql://postgres.xxx:pass@db.xxx.supabase.co:5432/postgres
   ```

2. Test connection:
   ```bash
   npm run migrate
   # Should run without errors
   ```

### "Setup script fails"

Run steps manually:

```bash
# 1. Build
npm run build

# 2. Create .env manually
nano .env

# 3. Configure Claude manually
open ~/Library/Application\ Support/Claude/claude_desktop_config.json
# Add orchestro configuration

# 4. Restart Claude Code
```

---

## Available Scripts

```bash
npm run setup              # Interactive setup wizard
npm run configure-claude   # Auto-configure Claude Code
npm run migrate           # Run database migrations
npm run dashboard         # Start web dashboard
npm run build            # Build TypeScript
npm run start            # Start MCP server
```

---

## Next Steps

1. 📖 **Read**: [Integration Guide](INTEGRATION_GUIDE.md) - Full setup guide
2. 👔 **For PMs**: [PM Guide](PM_GUIDE.md) - Product manager workflow
3. 💻 **For Devs**: [Dev Guide](DEV_GUIDE.md) - Developer deep dive
4. 🎯 **Examples**: [Examples](EXAMPLES.md) - Real-world usage

---

## Get Help

- 📧 **Issues**: [GitHub Issues](https://github.com/yourusername/orchestro/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/yourusername/orchestro/discussions)
- 📖 **Docs**: [Full Documentation](README.md)

---

<div align="center">

**🎭 Happy Orchestrating!**

[← Back to README](README.md)

</div>
