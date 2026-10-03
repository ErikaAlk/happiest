#!/usr/bin/env node
/**
 * Cross-platform environment wrapper for Happiest CLI
 * Sets HAPPIEST_HOME_DIR and provides visual feedback.
 * A server is configured through the CLI (`happiest setup`) or an inherited HAPPIEST_SERVER_URL.
 *
 * Usage: node scripts/env-wrapper.js <variant> <command> [...args]
 *
 * Variants:
 *   - stable: Production-ready version using ~/.happiest/
 *   - dev: Development version using ~/.happiest-source/
 *
 * Examples:
 *   node scripts/env-wrapper.js stable daemon start
 *   node scripts/env-wrapper.js dev auth login
 */

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { productIdentity } = require('@happier-dev/release-runtime/productIdentity');

const VARIANTS = {
  stable: {
    homeDir: path.join(os.homedir(), productIdentity.homeDirName),
    color: '\x1b[32m', // Green
    label: '✅ STABLE'
  },
  dev: {
    homeDir: path.join(os.homedir(), productIdentity.sourceHomeDirName),
    color: '\x1b[33m', // Yellow
    label: '🔧 DEV'
  }
};

const variant = process.argv[2];
const command = process.argv[3];
const args = process.argv.slice(4);

if (!variant || !VARIANTS[variant]) {
  console.error('Usage: node scripts/env-wrapper.js <stable|dev> <command> [...args]');
  console.error('');
  console.error('Variants:');
  console.error(`  stable - Production-ready version (data: ~/${productIdentity.homeDirName}/)`);
  console.error(`  dev    - Development version (data: ~/${productIdentity.sourceHomeDirName}/)`);
  console.error('');
  console.error('Examples:');
  console.error('  node scripts/env-wrapper.js stable daemon start');
  console.error('  node scripts/env-wrapper.js dev auth login');
  process.exit(1);
}

if (!command) {
  console.error('Usage: node scripts/env-wrapper.js <stable|dev> <command> [...args]');
  console.error('');
  console.error('Examples:');
  console.error('  node scripts/env-wrapper.js stable daemon start');
  console.error('  node scripts/env-wrapper.js dev auth login');
  process.exit(1);
}

const config = VARIANTS[variant];

// Create home directory if it doesn't exist
if (!fs.existsSync(config.homeDir)) {
  fs.mkdirSync(config.homeDir, { recursive: true });
}

// Visual feedback
console.log(`${config.color}${config.label}\x1b[0m Happier CLI (data: ${config.homeDir})`);

// Set environment and execute command
const env = {
  ...process.env,
  HAPPIEST_HOME_DIR: config.homeDir,
  HAPPIER_VARIANT: variant, // For internal validation
};

const binPath = path.join(__dirname, '..', 'bin', `${productIdentity.commandName}.mjs`);
const proc = spawn('node', [binPath, command, ...args], {
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

proc.on('exit', (code) => process.exit(code || 0));
