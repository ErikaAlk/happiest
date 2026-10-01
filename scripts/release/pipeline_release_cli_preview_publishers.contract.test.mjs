import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createReleaseCliDryRunEnv, RELEASE_CLI_DRY_RUN_TIMEOUT_MS } from './releaseCliDryRunTestkit.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

test('pipeline CLI release dry-run reports preview target and force inputs without predicting publisher jobs', async () => {
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
        'ui,cli,server_runner',
        '--force-deploy',
        'true',
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

    assert.match(out, /\[pipeline\] release: environment=preview confirm=release dev to preview/);
    assert.match(out, /\[pipeline\] dry-run: hosted dispatch inputs/);
    assert.match(out, /- deploy_targets: ui,cli,server_runner/);
    assert.match(out, /- force_deploy: true/);
    assert.doesNotMatch(out, /runPublishDocker|runPublishUiWeb|runPublishServerRuntime/);
  } finally {
    stub.cleanup();
  }
});
