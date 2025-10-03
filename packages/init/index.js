#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function getClaudeConfigPath() {
  const platform = os.platform();
  const home = os.homedir();

  switch (platform) {
    case 'darwin':
      return path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    case 'win32':
      return path.join(process.env.APPDATA || '', 'Claude', 'claude_desktop_config.json');
    case 'linux':
      return path.join(home, '.config', 'Claude', 'claude_desktop_config.json');
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

async function checkPrerequisites() {
  log('\n🔍 Checking prerequisites...', 'cyan');

  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  if (majorVersion < 18) {
    log(`✗ Node.js 18+ required (current: ${nodeVersion})`, 'red');
    process.exit(1);
  }
  log(`✓ Node.js: ${nodeVersion}`, 'green');

  // Check git
  try {
    execSync('git --version', { stdio: 'ignore' });
    log('✓ Git: Installed', 'green');
  } catch (error) {
    log('✗ Git is not installed', 'red');
    process.exit(1);
  }

  // Check Claude Code config
  const configPath = getClaudeConfigPath();
  if (!fs.existsSync(configPath)) {
    log(`✗ Claude Code config not found at: ${configPath}`, 'red');
    log('  Please install Claude Code first: https://claude.ai/download', 'yellow');
    process.exit(1);
  }
  log('✓ Claude Code: Installed', 'green');

  return configPath;
}

async function collectUserInput() {
  log('\n📝 Configuration', 'cyan');

  const installDir = await question(
    `${colors.bright}? Where to install Orchestro? ${colors.dim}(./orchestro)${colors.reset} `
  );

  const databaseUrl = await question(
    `${colors.bright}? Supabase Database URL (pooler connection):${colors.reset} `
  );

  const projectName = await question(
    `${colors.bright}? Project name: ${colors.dim}(My Project)${colors.reset} `
  );

  return {
    installDir: installDir.trim() || './orchestro',
    databaseUrl: databaseUrl.trim(),
    projectName: projectName.trim() || 'My Project',
  };
}

async function downloadOrchestro(installDir) {
  log('\n📦 Installing Orchestro...', 'cyan');

  if (fs.existsSync(installDir)) {
    log(`✗ Directory ${installDir} already exists`, 'red');
    const overwrite = await question('? Overwrite? (y/N) ');
    if (overwrite.toLowerCase() !== 'y') {
      log('Installation cancelled', 'yellow');
      process.exit(0);
    }
    fs.rmSync(installDir, { recursive: true, force: true });
  }

  log('Cloning repository...', 'dim');
  try {
    execSync(
      `git clone --depth 1 https://github.com/yourusername/orchestro.git "${installDir}"`,
      { stdio: 'ignore' }
    );
    log('✓ Repository cloned', 'green');
  } catch (error) {
    log('✗ Failed to clone repository', 'red');
    throw error;
  }

  // Remove .git directory
  const gitDir = path.join(installDir, '.git');
  if (fs.existsSync(gitDir)) {
    fs.rmSync(gitDir, { recursive: true, force: true });
  }

  log('Installing dependencies...', 'dim');
  try {
    execSync('npm install', {
      cwd: installDir,
      stdio: 'inherit',
    });
    log('✓ Dependencies installed', 'green');
  } catch (error) {
    log('✗ Failed to install dependencies', 'red');
    throw error;
  }

  log('Building TypeScript...', 'dim');
  try {
    execSync('npm run build', {
      cwd: installDir,
      stdio: 'inherit',
    });
    log('✓ Build completed', 'green');
  } catch (error) {
    log('✗ Build failed', 'red');
    throw error;
  }

  return path.resolve(installDir);
}

async function createEnvFile(installDir, config) {
  log('\n⚙️  Creating .env file...', 'cyan');

  const envContent = `# Orchestro Configuration
DATABASE_URL=${config.databaseUrl}
PROJECT_NAME=${config.projectName}
`;

  const envPath = path.join(installDir, '.env');
  fs.writeFileSync(envPath, envContent);
  log('✓ .env file created', 'green');
}

async function configureClaudeCode(installDir, config, configPath) {
  log('\n🔧 Configuring Claude Code...', 'cyan');

  const orchestroPath = path.join(installDir, 'dist', 'server.js');

  let claudeConfig = {};
  if (fs.existsSync(configPath)) {
    try {
      claudeConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (error) {
      log('⚠️  Could not parse existing Claude config, creating new one', 'yellow');
    }
  }

  if (!claudeConfig.mcpServers) {
    claudeConfig.mcpServers = {};
  }

  claudeConfig.mcpServers.orchestro = {
    command: 'node',
    args: [orchestroPath],
    env: {
      DATABASE_URL: config.databaseUrl,
    },
  };

  fs.writeFileSync(configPath, JSON.stringify(claudeConfig, null, 2));
  log('✓ Claude Code configured', 'green');
}

async function runMigrations(installDir) {
  log('\n🗄️  Running database migrations...', 'cyan');

  try {
    execSync('npm run migrate', {
      cwd: installDir,
      stdio: 'inherit',
    });
    log('✓ Migrations completed', 'green');
  } catch (error) {
    log('⚠️  Migration failed (you can run manually later with: npm run migrate)', 'yellow');
  }
}

async function printSuccess(installDir) {
  const absolutePath = path.resolve(installDir);

  log('\n' + '='.repeat(60), 'green');
  log('🎉 Orchestro installed successfully!', 'green');
  log('='.repeat(60), 'green');

  log('\n📍 Installation location:', 'cyan');
  log(`   ${absolutePath}`, 'bright');

  log('\n🚀 Next steps:', 'cyan');
  log('   1. Restart Claude Code', 'bright');
  log('   2. Open your project in Claude Code', 'bright');
  log('   3. Start using Orchestro tools!', 'bright');

  log('\n📊 Optional: Start the dashboard', 'cyan');
  log(`   cd ${installDir}`, 'dim');
  log('   npm run dashboard', 'dim');

  log('\n📚 Documentation:', 'cyan');
  log('   • README.md - Getting started', 'dim');
  log('   • INTEGRATION_GUIDE.md - Project integration', 'dim');
  log('   • https://github.com/yourusername/orchestro', 'dim');

  log('\n💡 Quick commands:', 'cyan');
  log('   • Create task: Use create_task tool in Claude Code', 'dim');
  log('   • List tasks: Use list_tasks tool', 'dim');
  log('   • Decompose story: Use decompose_story tool', 'dim');

  log('\n🎭 Happy orchestrating!', 'magenta');
  log('');
}

async function main() {
  try {
    log('\n🎭 Orchestro Installation', 'magenta');
    log('   Your AI Development Conductor\n', 'dim');

    const configPath = await checkPrerequisites();
    const config = await collectUserInput();
    const installDir = await downloadOrchestro(config.installDir);
    await createEnvFile(installDir, config);
    await configureClaudeCode(installDir, config, configPath);
    await runMigrations(installDir);
    await printSuccess(config.installDir);

    rl.close();
    process.exit(0);
  } catch (error) {
    log('\n✗ Installation failed:', 'red');
    log(error.message, 'red');
    if (error.stack) {
      log('\nStack trace:', 'dim');
      log(error.stack, 'dim');
    }
    rl.close();
    process.exit(1);
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  log('\n\nInstallation cancelled by user', 'yellow');
  rl.close();
  process.exit(0);
});

main();
