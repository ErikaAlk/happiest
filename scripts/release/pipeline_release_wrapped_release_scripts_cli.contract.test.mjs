import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

const cases = [
  ['release-sync-installers', 'scripts/pipeline/release/sync-installers.mjs'],
  ['release-bump-version', 'scripts/pipeline/release/bump-version.mjs'],
  ['release-build-cli-binaries', 'scripts/pipeline/release/build-cli-binaries.mjs'],
  ['release-build-hstack-binaries', 'scripts/pipeline/release/build-hstack-binaries.mjs'],
  ['release-build-server-binaries', 'scripts/pipeline/release/build-server-binaries.mjs'],
  ['release-prepare-binary-assets', 'scripts/pipeline/release/prepare-binary-assets.mjs'],
  ['release-publish-manifests', 'scripts/pipeline/release/publish-manifests.mjs'],
  ['release-verify-artifacts', 'scripts/pipeline/release/verify-artifacts.mjs'],
  ['release-compute-changed-components', 'scripts/pipeline/release/compute-changed-components.mjs'],
  ['release-compute-versioned-component-changes', 'scripts/pipeline/release/compute-versioned-component-changes.mjs'],
  ['release-resolve-bump-plan', 'scripts/pipeline/release/resolve-bump-plan.mjs'],
  ['release-build-ui-web-bundle', 'scripts/pipeline/release/build-ui-web-bundle.mjs'],
  ['release-validate', 'scripts/pipeline/release-validation/validate-release.mjs'],
];

for (const [subcommand, expectedRelPath] of cases) {
  test(`pipeline CLI supports ${subcommand} dry-run wrapper`, async () => {
    const out = execFileSync(
      process.execPath,
      [resolve(repoRoot, 'scripts', 'pipeline', 'run.mjs'), subcommand, '--dry-run'],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          GH_TOKEN: '',
          GH_REPO: '',
          GITHUB_REPOSITORY: '',
        },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 30_000,
      },
    );

    assert.match(out, /\[pipeline\] exec: node /);
    assert.match(out, new RegExp(expectedRelPath.replaceAll('/', '\\/')));
  });
}

test('the deploy-branch plan and Docker publication subcommands no longer exist', () => {
  for (const subcommand of ['release-compute-deploy-plan', 'docker-publish']) {
    const result = spawnSync(
      process.execPath,
      [resolve(repoRoot, 'scripts', 'pipeline', 'run.mjs'), subcommand, '--dry-run'],
      { cwd: repoRoot, encoding: 'utf8', timeout: 30_000 },
    );
    assert.equal(result.status, 1, subcommand);
    assert.match(result.stderr, new RegExp(`Unsupported subcommand: ${subcommand}`), subcommand);
  }
});

test('release-sync-installers check is hermetic and never reads release secrets', () => {
  const out = execFileSync(
    process.execPath,
    [
      resolve(repoRoot, 'scripts', 'pipeline', 'run.mjs'),
      'release-sync-installers',
      '--secrets-source',
      'keychain',
      '--keychain-service',
      'happier-test-missing-keychain-bundle',
      '--check',
    ],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30_000,
    },
  );

  assert.match(out, /"ok": true/);
  assert.match(out, /"checkOnly": true/);
});

test('release component planning is hermetic and never reads release secrets', () => {
  const out = execFileSync(
    process.execPath,
    [
      resolve(repoRoot, 'scripts', 'pipeline', 'run.mjs'),
      'release-compute-versioned-component-changes',
      '--secrets-source',
      'keychain',
      '--keychain-service',
      'happier-test-missing-keychain-bundle',
      '--environment',
      'production',
      '--head',
      'HEAD',
    ],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30_000,
    },
  );

  const result = JSON.parse(out);
  assert.match(result.changed_app, /^(?:true|false)$/);
  assert.match(result.changed_cli, /^(?:true|false)$/);
  assert.match(result.changed_stack, /^(?:true|false)$/);
  assert.match(result.changed_server, /^(?:true|false)$/);
});
