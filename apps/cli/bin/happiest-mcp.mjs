#!/usr/bin/env node

import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

import { importPreparedRuntimeEntrypoint } from './_importRuntimeEntrypoint.mjs';

// 避免运行时警告影响 MCP 通信。
const hasNoWarnings = process.execArgv.includes('--no-warnings');
const hasNoDeprecation = process.execArgv.includes('--no-deprecation');

if (!hasNoWarnings || !hasNoDeprecation) {
  try {
    execFileSync(process.execPath, [
      '--no-warnings',
      '--no-deprecation',
      fileURLToPath(import.meta.url),
      ...process.argv.slice(2)
    ], {
      stdio: 'inherit',
      env: process.env
    });
  } catch (error) {
    process.exit(error.status || 1);
  }
} else {
  // Already have desired flags; import module directly
  const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
  await importPreparedRuntimeEntrypoint(projectRoot, join('backends', 'codex', 'happyMcpStdioBridge.mjs'));
}
