import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const workflowsDir = resolve(repoRoot, '.github', 'workflows');

function read(name) {
  return readFileSync(resolve(workflowsDir, name), 'utf8');
}

function load(name) {
  return YAML.parse(read(name));
}

const releasePathWorkflows = [
  'release.yml',
  'release-preview-and-production.yml',
  'publish-cli-binaries.yml',
  'publish-hstack-binaries.yml',
  'publish-server-runtime.yml',
  'publish-ui-web.yml',
  'promote-branch.yml',
  'release-verify.yml',
  'resolve-release-resume.yml',
  'publish-github-release.yml',
];

const writerJobs = [
  ['publish-cli-binaries.yml', 'finalize_publish'],
  ['publish-cli-binaries.yml', 'promote_existing'],
  ['publish-hstack-binaries.yml', 'finalize_publish'],
  ['publish-hstack-binaries.yml', 'promote_existing'],
  ['publish-server-runtime.yml', 'finalize_publish'],
  ['publish-server-runtime.yml', 'promote_existing'],
  ['publish-server-runtime.yml', 'promote_existing_fresh_runner_retry'],
  ['publish-ui-web.yml', 'publish'],
  ['publish-ui-web.yml', 'promote_existing'],
  ['promote-branch.yml', 'promote'],
  ['publish-github-release.yml', 'publish'],
];

test('the fork publishes no npm package and no Homebrew formula', () => {
  assert.equal(existsSync(resolve(workflowsDir, 'release-npm.yml')), false);
  assert.deepEqual(readdirSync(resolve(repoRoot, 'scripts', 'pipeline', 'npm')), ['resolvePackedTarball.mjs']);
  assert.equal(existsSync(resolve(repoRoot, 'scripts', 'pipeline', 'release', 'render-homebrew-packages.mjs')), false);

  for (const name of releasePathWorkflows) {
    assert.doesNotMatch(
      read(name),
      /release-npm|publish_npm|npm_requested|npm_complete|npm_publish_|NPM_TOKEN|id-token|homebrew/i,
      `${name} must not publish to npm or Homebrew`,
    );
  }
  const release = load('release.yml');
  assert.equal(release.jobs.publish_npm, undefined);
  assert.equal(release.jobs.publish_homebrew_tap, undefined);
});

test('the fork release path builds no macOS target and uses no Apple signing', () => {
  for (const name of releasePathWorkflows) {
    assert.doesNotMatch(
      read(name),
      /macos|darwin|launchd|APPLE_|setup-apple-codesigning|notarize|xcode/i,
      `${name} must not build, sign, or validate macOS artifacts`,
    );
  }
  for (const name of ['publish-cli-binaries.yml', 'publish-hstack-binaries.yml', 'publish-server-runtime.yml']) {
    assert.equal(load(name).jobs.finalize_darwin, undefined, `${name} has no macOS finalizer`);
  }

  const tests = load('tests.yml');
  for (const [jobName, job] of Object.entries(tests.jobs)) {
    assert.doesNotMatch(jobName, /macos|launchd|mobile-e2e-ios/i, `tests.yml job ${jobName} targets macOS`);
    assert.doesNotMatch(
      JSON.stringify({ runsOn: job['runs-on'], strategy: job.strategy }),
      /macos/i,
      `tests.yml job ${jobName} must not run on a macOS runner`,
    );
  }
  assert.deepEqual(tests.jobs['self-host-daemon-e2e']['runs-on'], 'ubuntu-latest');

  const publishNeeds = new Map([
    ['publish-cli-binaries.yml', ['prepare', 'build_candidate']],
    ['publish-hstack-binaries.yml', ['prepare', 'build_candidate']],
    ['publish-server-runtime.yml', ['trusted_ref_guard', 'release_actor_guard', 'build_candidate']],
  ]);
  for (const [name, expectedNeeds] of publishNeeds) {
    const finalize = load(name).jobs.finalize_publish;
    assert.deepEqual(finalize.needs, expectedNeeds, `${name} finalizes straight from the Linux build candidate`);
    assert.ok(
      finalize.steps.every((step) => !/download-artifact/.test(step.uses ?? '') || !/signed/.test(step.with?.pattern ?? '')),
      `${name} downloads no separately signed leaves`,
    );
  }
  const cliInstall = load('publish-cli-binaries.yml').jobs.build_candidate.steps.find(
    (step) => step.uses === './.github/actions/install-yarn-dependencies',
  );
  assert.match(
    String(cliInstall?.with?.args ?? ''),
    /(?:^|\s)--ignore-platform(?:\s|$)/,
    'the CLI candidate build installs the complete cross-target optional native package set',
  );

  assert.match(
    load('publish-cli-binaries.yml').jobs.build_candidate.steps.find((step) => step.name === 'Build unsigned CLI archives').run,
    /\| wc -l \| tr -d ' '\)" = "9"/,
    'the CLI publishes the base archive plus two optional components for linux-x64, linux-arm64 and windows-x64',
  );
  assert.match(
    load('publish-hstack-binaries.yml').jobs.build_candidate.steps.find((step) => step.name === 'Build unsigned HStack archives').run,
    /\| wc -l \| tr -d ' '\)" = "3"/,
    'hstack publishes one archive for each of the three targets',
  );
});

test('the release plan needs only the main and dev branches of the fork', () => {
  const plan = load('release.yml').jobs.plan;
  const versionedPlan = plan.steps.find((step) => step.id === 'versioned_plan');
  assert.match(versionedPlan.run, /git fetch origin main dev --prune --tags/);
  assert.doesNotMatch(versionedPlan.run, /git fetch origin [^\n]*\bpreview\b/);
});

test('release writes use the workflow token with explicit write permissions', () => {
  for (const name of releasePathWorkflows) {
    assert.doesNotMatch(read(name), /create-github-app-token|RELEASE_BOT_/, `${name} must not use a GitHub App`);
  }

  for (const [name, jobName] of writerJobs) {
    const job = load(name).jobs[jobName];
    assert.ok(job, `${name} must define ${jobName}`);
    assert.deepEqual(job.permissions, { contents: 'write' }, `${name}/${jobName} declares exactly its write scope`);
    const tokens = (job.steps ?? []).map((step) => step.env?.GH_TOKEN).filter(Boolean);
    assert.deepEqual(tokens, ['${{ github.token }}'], `${name}/${jobName} writes with the workflow token`);
  }

  const release = load('release.yml');
  assert.equal(release.permissions.contents, 'write');
  for (const [jobName, job] of Object.entries(release.jobs)) {
    if (!/^\.\/\.github\/workflows\/(publish-(cli|hstack|server|ui)|promote-branch)/.test(job.uses ?? '')) continue;
    assert.equal(
      job.permissions?.contents ?? release.permissions.contents,
      'write',
      `release.yml/${jobName} must grant the contents write scope its called writer jobs use`,
    );
  }

  const combined = load('release-preview-and-production.yml');
  assert.equal(combined.permissions['id-token'], undefined);
  for (const jobName of ['release_preview', 'release_production']) {
    assert.equal(combined.jobs[jobName].permissions.contents, 'write');
    assert.equal(combined.jobs[jobName].permissions['id-token'], undefined);
  }
});
