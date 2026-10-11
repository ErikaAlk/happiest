import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';

import { spawnLoggedProcess } from './tauriMcpQa.mjs';

const execFileAsync = promisify(execFile);

test('tauriMcpQa starts the installed npm launcher on the current platform', async () => {
  const child = spawnLoggedProcess({
    label: 'npm-launcher',
    command: 'npx',
    args: ['--version'],
    cwd: dirname(fileURLToPath(import.meta.url)),
    env: process.env,
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  const [code] = await once(child, 'close');
  assert.equal(code, 0);
  assert.match(output.trim(), /^\d+\.\d+\.\d+$/);
});

test('tauriMcpQa exposes the combined Tauri + MCP launch plan', async () => {
  const scriptsDir = dirname(fileURLToPath(import.meta.url));
  const scriptPath = join(scriptsDir, 'tauriMcpQa.mjs');

  const { stdout } = await execFileAsync(process.execPath, [scriptPath, '--json'], {
    cwd: dirname(scriptsDir),
    env: { ...process.env },
    encoding: 'utf8',
  });

  const payload = JSON.parse(stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.plan.cwd.endsWith('/apps/ui') || payload.plan.cwd.endsWith('\\apps\\ui'), true);
  assert.match(payload.plan.configPath, /src-tauri[\\/]tauri\.conf\.json$/);
  assert.equal(payload.plan.tauriDev.command, process.execPath);
  assert.match(String(payload.plan.tauriDev.args[0] ?? ''), /node_modules[\\/](?:@tauri-apps[\\/].*[\\/]tauri\.js|\.bin[\\/](?:tauri|tauri\.cmd))$/);
  assert.equal(
    String(payload.plan.tauriDev.cwd ?? '').replaceAll('\\', '/').endsWith('/apps/ui/src-tauri'),
    true
  );
  const tauriArgs = Array.isArray(payload.plan.tauriDev.args) ? payload.plan.tauriDev.args : [];
  assert.equal(tauriArgs[1], 'dev');
  assert.equal(tauriArgs.includes('--no-dev-server-wait'), true);
  const runnerIndex = tauriArgs.indexOf('--runner');
  assert.notEqual(runnerIndex, -1);
  assert.match(String(tauriArgs[runnerIndex + 1] ?? ''), /cargo(?:\.exe)?$/);
  const configIndex = tauriArgs.indexOf('--config');
  assert.notEqual(configIndex, -1);
  assert.match(String(tauriArgs[configIndex + 1] ?? ''), /src-tauri[\\/]tauri\.conf\.json$/);
  const overrideIndex = tauriArgs.indexOf('-c');
  assert.notEqual(overrideIndex, -1);
  const overrideJson = JSON.parse(String(tauriArgs[overrideIndex + 1] ?? '{}'));
  assert.equal(overrideJson?.build?.beforeDevCommand, '');
  assert.equal(typeof overrideJson?.build?.devUrl, 'string');
  assert.equal(payload.plan.mcpServer.command, 'npx');
  assert.deepEqual(payload.plan.mcpServer.args, ['-y', '@hypothesi/tauri-mcp-server']);
});
