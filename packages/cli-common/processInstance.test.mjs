import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import test from 'node:test';

import {
  processInstanceFingerprintMatches,
  readProcessInstanceFingerprint,
  readProcessInstanceFingerprintSync,
  readWin32ProcessRows,
} from './processInstance.mjs';

function spawnIdleProcess(t) {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore', windowsHide: true });
  t.after(() => child.kill());
  return child.pid;
}

test('readProcessInstanceFingerprint observes the fingerprint the synchronous reader persists', async (t) => {
  const pid = spawnIdleProcess(t);

  const observed = await readProcessInstanceFingerprint(pid);

  assert.ok(observed);
  assert.equal(observed, readProcessInstanceFingerprintSync(pid));
});

test('readWin32ProcessRows reads every requested live process in one query', { skip: process.platform !== 'win32' }, async (t) => {
  const pids = [spawnIdleProcess(t), spawnIdleProcess(t)];

  const rows = await readWin32ProcessRows(pids);

  assert.deepEqual([...rows.keys()].sort(), [...pids].sort());
  for (const pid of pids) {
    const row = rows.get(pid);
    assert.equal(row.name, 'node.exe');
    assert.match(row.commandLine, /setInterval/);
    assert.equal(row.processInstanceFingerprint, readProcessInstanceFingerprintSync(pid));
  }
});

test('readProcessInstanceFingerprintSync reads the Linux proc start-time field', () => {
  const stat = `123 (node worker) S ${Array.from({ length: 18 }, (_, index) => index + 1).join(' ')} 987654 0 0`;
  assert.equal(
    readProcessInstanceFingerprintSync(123, {
      platform: 'linux',
      readFileSyncImpl: () => stat,
      spawnSyncImpl: () => {
        throw new Error('portable fallback must not run');
      },
    }),
    'linux-proc:987654',
  );
});

test('readProcessInstanceFingerprintSync reads a Windows CIM creation timestamp', () => {
  const calls = [];
  const fingerprint = readProcessInstanceFingerprintSync(456, {
    platform: 'win32',
    spawnSyncImpl: (command, args, options) => {
      calls.push({ command, args, options });
      return { status: 0, stdout: '2026-07-23T12:34:56.0000000Z\r\n' };
    },
  });

  assert.equal(fingerprint, 'win32-cim:2026-07-23T12:34:56.0000000Z');
  assert.equal(calls[0].command, 'powershell.exe');
  assert.match(calls[0].args.at(-1), /ProcessId=456/);
  assert.equal(calls[0].options.shell, undefined);
});

test('processInstanceFingerprintMatches fails closed when either observation is unavailable', () => {
  assert.equal(processInstanceFingerprintMatches('linux-proc:1', 'linux-proc:1'), true);
  assert.equal(processInstanceFingerprintMatches('linux-proc:1', null), false);
  assert.equal(processInstanceFingerprintMatches(null, 'linux-proc:1'), false);
});
