#!/usr/bin/env node

/**
 * Auto-configure Claude Code for Orchestro
 *
 * Automatically adds Orchestro MCP server to Claude Code config
 * Usage: npm run configure-claude
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
};

function print(text, color = 'reset') {
  console.log(`${colors[color]}${text}${colors.reset}`);
}

function getClaudeConfigPath() {
  const platform = os.platform();
  const home = os.homedir();

  switch(platform) {
    case 'darwin': // macOS
      return path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    case 'win32': // Windows
      return path.join(process.env.APPDATA, 'Claude', 'claude_desktop_config.json');
    case 'linux':
      return path.join(home, '.config', 'Claude', 'claude_desktop_config.json');
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

function getEnvVariable(key) {
  // Try to read from .env file
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
    if (match) {
      return match[1].trim();
    }
  }

  // Fallback to process.env
  return process.env[key];
}

function main() {
  print('\n🔧 Configuring Claude Code for Orchestro...', 'blue');

  try {
    // Get paths
    const configPath = getClaudeConfigPath();
    const orchestroPath = path.join(process.cwd(), 'dist', 'server.js');

    // Check if Orchestro is built
    if (!fs.existsSync(orchestroPath)) {
      print('❌ Orchestro not built. Run "npm run build" first.', 'red');
      process.exit(1);
    }

    // Get database URL
    const databaseUrl = getEnvVariable('DATABASE_URL');
    if (!databaseUrl) {
      print('❌ DATABASE_URL not found in .env file', 'red');
      print('   Run "npm run setup" to configure', 'yellow');
      process.exit(1);
    }

    // Read or create Claude config
    let claudeConfig = {};
    const configDir = path.dirname(configPath);

    if (fs.existsSync(configPath)) {
      try {
        claudeConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        print('✓ Found existing Claude Code config', 'green');
      } catch (error) {
        print(`⚠️  Could not parse existing config: ${error.message}`, 'yellow');
        print('   Creating new config...', 'yellow');
      }
    } else {
      print('ℹ️  Creating new Claude Code config', 'blue');
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
    }

    // Add or update Orchestro configuration
    if (!claudeConfig.mcpServers) {
      claudeConfig.mcpServers = {};
    }

    // Check if Orchestro already configured
    if (claudeConfig.mcpServers.orchestro) {
      print('⚠️  Orchestro already configured in Claude Code', 'yellow');
      print('   Updating configuration...', 'blue');
    }

    claudeConfig.mcpServers.orchestro = {
      command: 'node',
      args: [orchestroPath],
      env: {
        DATABASE_URL: databaseUrl
      }
    };

    // Write config
    fs.writeFileSync(configPath, JSON.stringify(claudeConfig, null, 2));

    print('\n✅ Configuration Complete!', 'green');
    print(`\n📝 Config file: ${configPath}`, 'blue');
    print(`📍 Orchestro path: ${orchestroPath}`, 'blue');

    print('\n📋 Next Steps:', 'blue');
    print('\n1. Restart Claude Code');
    print('   • macOS: Cmd+Q and reopen');
    print('   • Windows: Close and reopen');
    print('   • Linux: killall claude-code && claude-code &');

    print('\n2. Verify installation');
    print('   Ask in Claude Code: "Show me all orchestro tools"');
    print('   Expected: 27 tools listed');

    print('\n3. Start using Orchestro!');
    print('   Try: "Create an orchestro task for user authentication"\n');

  } catch (error) {
    print(`\n❌ Configuration failed: ${error.message}`, 'red');
    print('\nFor manual setup, see: INTEGRATION_GUIDE.md', 'yellow');
    process.exit(1);
  }
}

main();
