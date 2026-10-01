import test from 'node:test';
import assert from 'node:assert/strict';

import { CLI_STACK_TARGETS, SERVER_TARGETS, resolveTargets } from '../pipeline/release/lib/binary-release.mjs';

test('resolveTargets returns all targets when filter is empty', () => {
  const targets = resolveTargets({ availableTargets: CLI_STACK_TARGETS, requested: '' });
  assert.equal(targets.length, CLI_STACK_TARGETS.length);
});

test('resolveTargets supports comma separated os-arch filters', () => {
  const targets = resolveTargets({ availableTargets: CLI_STACK_TARGETS, requested: 'linux-x64,windows-x64' });
  assert.deepEqual(
    targets.map((target) => `${target.os}-${target.arch}`),
    ['linux-x64', 'windows-x64']
  );
});

test('resolveTargets rejects macOS targets because no macOS build is published', () => {
  assert.throws(() => {
    resolveTargets({ availableTargets: CLI_STACK_TARGETS, requested: 'darwin-arm64' });
  }, /unknown target/);
});

test('resolveTargets throws for unknown requested targets', () => {
  assert.throws(() => {
    resolveTargets({ availableTargets: CLI_STACK_TARGETS, requested: 'linux-ppc64' });
  }, /unknown target/);
});

test('SERVER_TARGETS covers the linux and windows defaults only', () => {
  const targets = resolveTargets({ availableTargets: SERVER_TARGETS, requested: '' });
  assert.deepEqual(
    targets.map((t) => `${t.os}-${t.arch}`),
    ['linux-x64', 'linux-arm64', 'windows-x64'],
  );
});

test('linux-x64 binaries use baseline bun target (avoid SIGILL on older CPUs)', () => {
  const cliLinuxX64 = CLI_STACK_TARGETS.find((t) => t.os === 'linux' && t.arch === 'x64');
  assert.ok(cliLinuxX64, 'expected linux-x64 CLI target');
  assert.equal(cliLinuxX64.bunTarget, 'bun-linux-x64-baseline');

  const serverLinuxX64 = SERVER_TARGETS.find((t) => t.os === 'linux' && t.arch === 'x64');
  assert.ok(serverLinuxX64, 'expected linux-x64 server target');
  assert.equal(serverLinuxX64.bunTarget, 'bun-linux-x64-baseline');
});
