import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createReleaseCliDryRunEnv, RELEASE_CLI_DRY_RUN_TIMEOUT_MS } from './releaseCliDryRunTestkit.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

test('pipeline CLI release dry-run reports hosted release inputs without predicting release jobs', async () => {
  const stub = createReleaseCliDryRunEnv();
  try {
    const out = execFileSync(
      process.execPath,
      [
        resolve(repoRoot, 'scripts', 'pipeline', 'run.mjs'),
        'release',
        '--confirm',
        'release dev to preview',
        '--deploy-environment',
        'preview',
        '--deploy-targets',
        'server_runner',
        '--force-deploy',
        'true',
        '--repository',
        'happier-dev/happier',
        '--release-notes-id',
        'test-release',
        '--waive-ci',
        'true',
        '--waive-validation-suites',
        'docker-release-assets',
        '--override-reason',
        'Maintainer accepted the bounded release risk.',
        '--dry-run',
      ],
      {
        cwd: repoRoot,
        env: {
          ...stub.env,
          GH_TOKEN: '',
          GH_REPO: '',
          GITHUB_REPOSITORY: '',
        },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: RELEASE_CLI_DRY_RUN_TIMEOUT_MS,
      },
    );

    assert.match(out, /\[pipeline\] release: environment=preview confirm=release dev to preview/);
    assert.match(out, /release profile=integrated/);
    assert.doesNotMatch(out, /hosted checks profile|checks_profile/, 'the hosted workflow resolves checks from the public profile');
    assert.match(out, /\[pipeline\] dry-run: hosted dispatch inputs/);
    assert.match(out, /- deploy_targets: server_runner/);
    assert.match(out, /- force_deploy: true/);
    assert.match(out, /- desktop_mode: none/);
    assert.match(out, /- waive_ci: true/);
    assert.match(out, /- waive_validation_suites: docker-release-assets/);
    assert.match(out, /- override_reason: Maintainer accepted the bounded release risk\./);
    assert.doesNotMatch(out, /deploy facts|ui_expo_action/, 'the fork release has no deploy branches and no Expo publication');
    assert.doesNotMatch(out, /runDeployServer|runPublish/);
  } finally {
    stub.cleanup();
  }
});

test('pipeline CLI release dry-run defaults production to the stable release profile', async () => {
  const stub = createReleaseCliDryRunEnv();
  try {
    const out = execFileSync(
      process.execPath,
      [
        resolve(repoRoot, 'scripts', 'pipeline', 'run.mjs'),
        'release',
        '--confirm',
        'release preview to main',
        '--deploy-environment',
        'production',
        '--deploy-targets',
        'server_runner',
        '--repository',
        'happier-dev/happier',
        '--release-notes-id',
        'test-release',
        '--dry-run',
      ],
      {
        cwd: repoRoot,
        env: {
          ...stub.env,
          GH_TOKEN: '',
          GH_REPO: '',
          GITHUB_REPOSITORY: '',
        },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: RELEASE_CLI_DRY_RUN_TIMEOUT_MS,
      },
    );

    assert.match(out, /\[pipeline\] release: environment=production confirm=release preview to main/);
    assert.match(out, /release profile=stable/);
    assert.doesNotMatch(out, /hosted checks profile|checks_profile/, 'the local dispatcher must not become a second checks-profile owner');
  } finally {
    stub.cleanup();
  }
});

test('pipeline CLI rejects the manual deep profile before release work begins', () => {
  const result = spawnSync(
    process.execPath,
    [
      resolve(repoRoot, 'scripts', 'pipeline', 'run.mjs'),
      'release',
      '--confirm',
      'release dev to preview',
      '--deploy-environment',
      'preview',
      '--deploy-targets',
      'server_runner',
      '--repository',
      'happier-dev/happier',
      '--release-notes-id',
      'test-release',
      '--release-profile',
      'deep',
      '--dry-run',
    ],
    {
      cwd: repoRoot,
      env: process.env,
      encoding: 'utf8',
    },
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /manual comprehensive certification/i);
});

test('pipeline CLI does not expose a release-time version bump option', () => {
  const stub = createReleaseCliDryRunEnv();
  try {
    const result = spawnSync(
      process.execPath,
      [
        resolve(repoRoot, 'scripts', 'pipeline', 'run.mjs'),
        'release',
        '--confirm',
        'release dev to preview',
        '--deploy-environment',
        'preview',
        '--deploy-targets',
        'server_runner',
        '--repository',
        'happier-dev/happier',
        '--release-notes-id',
        'test-release',
        '--bump',
        'patch',
        '--dry-run',
      ],
      {
        cwd: repoRoot,
        env: { ...stub.env },
        encoding: 'utf8',
      },
    );

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Unknown option '--bump'/);
  } finally {
    stub.cleanup();
  }
});

test('pipeline CLI only dispatches the targets and options the fork release publishes', () => {
  const stub = createReleaseCliDryRunEnv();
  try {
    const run = (...extra) => spawnSync(
      process.execPath,
      [
        resolve(repoRoot, 'scripts', 'pipeline', 'run.mjs'),
        'release',
        '--confirm',
        'release dev to preview',
        '--deploy-environment',
        'preview',
        '--repository',
        'happier-dev/happier',
        '--release-notes-id',
        'test-release',
        '--dry-run',
        ...extra,
      ],
      { cwd: repoRoot, env: { ...stub.env }, encoding: 'utf8' },
    );

    for (const target of ['server', 'website', 'docs', 'stack']) {
      const result = run('--deploy-targets', `ui,${target}`);
      assert.equal(result.status, 1, target);
      assert.match(result.stderr, new RegExp(`--deploy-targets contains unsupported target '${target}' \\(supported: ui,cli,server_runner\\)`), target);
    }

    const expo = run('--ui-expo-action', 'none');
    assert.equal(expo.status, 1);
    assert.match(expo.stderr, /Unknown option '--ui-expo-action'/);
  } finally {
    stub.cleanup();
  }
});
