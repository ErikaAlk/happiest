import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

async function loadWorkflow(name) {
  return readFile(join(repoRoot, '.github', 'workflows', name), 'utf8');
}

test('publish-server-runtime workflow exists and does not manage deploy branches', async () => {
  const raw = await loadWorkflow('publish-server-runtime.yml');

  assert.match(raw, /name:\s*PUBLISH\s+—\s+Server Runtime/i);
  assert.match(raw, /workflow_dispatch:/);
  assert.match(raw, /workflow_call:/);

  assert.doesNotMatch(raw, /deploy\//, 'server runtime publish must not push deploy/* branches');
  assert.doesNotMatch(raw, /Promote source ref to deploy branch/i);
});

test('publish-server-runtime workflow publishes the rolling tag with the workflow token', async () => {
  const raw = await loadWorkflow('publish-server-runtime.yml');
  const workflow = YAML.parse(raw);

  assert.doesNotMatch(raw, /create-github-app-token|RELEASE_BOT_/);
  for (const jobName of ['finalize_publish', 'promote_existing', 'promote_existing_fresh_runner_retry']) {
    const job = workflow.jobs[jobName];
    assert.deepEqual(job.permissions, { contents: 'write' }, `${jobName} declares its write scope`);
    const writers = job.steps.filter((step) => step.env?.GH_TOKEN);
    assert.equal(writers.length, 1, `${jobName} has one writer step`);
    assert.equal(writers[0].env.GH_TOKEN, '${{ github.token }}');
    assert.match(writers[0].run, /node scripts\/pipeline\/release\/publish-server-runtime\.mjs/);
  }
});

test('publish-server-runtime supports dev and resolves auto source_ref from the selected channel', async () => {
  const raw = await loadWorkflow('publish-server-runtime.yml');

  assert.match(raw, /options:[\s\S]*?- preview[\s\S]*?- dev[\s\S]*?- stable/);
  assert.match(raw, /node scripts\/pipeline\/release\/resolve-public-release-channel-meta\.mjs/);
  assert.match(raw, /id:\s*channel_meta/);
  assert.match(raw, /ref:\s*\$\{\{\s*needs\.release_actor_guard\.outputs\.authorized_sha\s*\}\}/);
  assert.doesNotMatch(
    raw,
    /if \[ "\$src" = "auto" \]; then[\s\S]*?src="dev"[\s\S]*?src="preview"[\s\S]*?src="main"/,
  );
});

test('publish-server-runtime embeds build feature policy defaults by channel', async () => {
  const raw = await loadWorkflow('publish-server-runtime.yml');

  assert.match(
    raw,
    /HAPPIER_EMBEDDED_POLICY_ENV:\s*\$\{\{\s*needs\.release_actor_guard\.outputs\.embedded_policy_env\s*\}\}/,
    'server runtime publishing should set HAPPIER_EMBEDDED_POLICY_ENV to production for stable artifacts',
  );
  assert.doesNotMatch(raw, /inputs\.channel\s*==\s*'publicdev'/);
});

test('publish-server-runtime installs cross-target optional native packages for the candidate build', async () => {
  const workflow = YAML.parse(await loadWorkflow('publish-server-runtime.yml'));
  const install = workflow.jobs.build_candidate.steps.find(
    (step) => step.uses === './.github/actions/install-yarn-dependencies',
  );

  assert.match(install.with.args, /(?:^|\s)--ignore-platform(?:\s|$)/);
});

test('publish-server-runtime isolates unprivileged candidate bytes from trusted signing and publishing', async () => {
  const raw = await loadWorkflow('publish-server-runtime.yml');
  const workflow = YAML.parse(raw);
  const candidate = JSON.stringify(workflow.jobs.build_candidate);
  const finalize = JSON.stringify(workflow.jobs.finalize_publish);

  assert.equal(workflow.jobs.build_candidate.permissions.contents, 'read');
  assert.match(candidate, /"persist-credentials":false/);
  assert.match(candidate, /job\.workflow_repository/);
  assert.match(candidate, /--phase\s+build-candidate/);
  assert.match(candidate, /actions\/upload-artifact@/);
  assert.doesNotMatch(candidate, /MINISIGN_SECRET_KEY|github\.token|GH_TOKEN|environment:/);
  assert.equal(workflow.jobs.finalize_darwin, undefined);

  assert.match(finalize, /job\.workflow_repository/);
  assert.match(finalize, /job\.workflow_sha/);
  assert.match(finalize, /--phase\s+finalize-candidate/);
  assert.match(finalize, /--authorized-sha/);
  assert.match(finalize, /MINISIGN_SECRET_KEY/);
  assert.doesNotMatch(finalize, /setup-bun|tar\s+-x|unzip/);

  const finalizerSteps = workflow.jobs.finalize_publish.steps;
  const installIndex = finalizerSteps.findIndex((step) => step.uses === './.github/actions/install-yarn-dependencies');
  const publishIndex = finalizerSteps.findIndex((step) => step.run?.includes('publish-server-runtime.mjs'));
  assert.ok(installIndex >= 0, 'trusted finalizer dependencies must be installed for artifact verification');
  assert.ok(publishIndex > installIndex, 'trusted dependencies must install before the publishing step receives the workflow token');
  assert.equal(finalizerSteps[publishIndex].env.GH_TOKEN, '${{ github.token }}');
  assert.match(finalizerSteps[installIndex].with.args, /--frozen-lockfile/);
});

test('workflow guards trusted control identity before every secret or environment job', async () => {
  const raw = await loadWorkflow('publish-server-runtime.yml');
  const workflow = YAML.parse(raw);
  assert.ok(workflow.jobs.trusted_ref_guard);
  assert.equal(Object.keys(workflow.jobs)[0], 'trusted_ref_guard');
  assert.doesNotMatch(JSON.stringify(workflow.jobs.trusted_ref_guard), /secrets\.|environment|uses/);
  assert.deepEqual(workflow.jobs.release_actor_guard.needs, ['trusted_ref_guard']);
  assert.ok(workflow.jobs.finalize_publish.needs.includes('trusted_ref_guard'));
  assert.match(raw, /github\.repository.*job\.workflow_repository|CALLER_REPOSITORY.*WORKFLOW_REPOSITORY/s);
  assert.match(raw, /refs\/heads\/(?:dev|preview|main)/);

  const reachesGuard = (jobName, seen = new Set()) => {
    if (jobName === 'trusted_ref_guard') return true;
    if (seen.has(jobName)) return false;
    seen.add(jobName);
    const needs = workflow.jobs[jobName]?.needs ?? [];
    return needs.some((dependency) => reachesGuard(dependency, seen));
  };
  for (const [jobName, job] of Object.entries(workflow.jobs)) {
    if (jobName === 'trusted_ref_guard') continue;
    const serialized = JSON.stringify(job);
    if (job.environment || serialized.includes('secrets.')) {
      assert.equal(reachesGuard(jobName), true, `${jobName} can reach secrets/environment without trusted_ref_guard`);
    }
  }
});

test('workflow never interpolates raw inputs into shell and validates adversarial strings as data', async () => {
  const workflow = YAML.parse(await loadWorkflow('publish-server-runtime.yml'));
  for (const [jobName, job] of Object.entries(workflow.jobs)) {
    for (const step of job.steps ?? []) {
      if (typeof step.run === 'string') {
        assert.doesNotMatch(step.run, /\$\{\{\s*inputs\./, `${jobName}/${step.name ?? 'run'} interpolates input in shell`);
      }
    }
  }
  assert.equal(workflow.on.workflow_call.inputs.authorized_sha.default, '');
  assert.match(JSON.stringify(workflow.jobs.release_actor_guard), /AUTHORIZED_SHA/);
});

test('workflow serializes each called-repository channel and grants write only to the publishing jobs', async () => {
  const workflow = YAML.parse(await loadWorkflow('publish-server-runtime.yml'));
  assert.doesNotMatch(workflow.concurrency.group, /github\.ref/);
  assert.match(workflow.concurrency.group, /github\.repository/);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.equal(workflow.jobs.build_candidate.permissions.contents, 'read');
  const writers = Object.entries(workflow.jobs)
    .filter(([, job]) => job.permissions?.contents === 'write')
    .map(([name]) => name);
  assert.deepEqual(writers, ['finalize_publish', 'promote_existing', 'promote_existing_fresh_runner_retry']);
});

test('first secret-free guard rejects every noncanonical workflow channel alias before serialization', async () => {
  const workflow = YAML.parse(await loadWorkflow('publish-server-runtime.yml'));
  const guard = workflow.jobs.trusted_ref_guard;
  const step = guard.steps[0];
  assert.equal(step.env.CHANNEL, '${{ inputs.channel }}');

  const baseEnv = {
    CALLER_REPOSITORY: 'happier-dev/happier',
    WORKFLOW_REPOSITORY: 'happier-dev/happier',
    WORKFLOW_REF: 'happier-dev/happier/.github/workflows/publish-server-runtime.yml@refs/heads/main',
    RETRY_VERSION: '',
    RESUME_VERSION: '',
  };
  for (const channel of ['stable', 'preview', 'dev']) {
    const result = spawnSync('bash', ['-euo', 'pipefail', '-c', step.run], { env: { ...process.env, ...baseEnv, CHANNEL: channel } });
    assert.equal(result.status, 0, `canonical channel ${channel} should pass: ${result.stderr}`);
  }
  for (const channel of ['publicdev', 'public-dev', 'public_dev', 'production', 'prod']) {
    const result = spawnSync('bash', ['-euo', 'pipefail', '-c', step.run], { env: { ...process.env, ...baseEnv, CHANNEL: channel } });
    assert.notEqual(result.status, 0, `alias channel ${channel} bypassed the first guard`);
  }

  const conflictingModes = spawnSync('bash', ['-euo', 'pipefail', '-c', step.run], {
    env: {
      ...process.env,
      ...baseEnv,
      CHANNEL: 'dev',
      RETRY_VERSION: '0.1.0-dev.1',
      RESUME_VERSION: '0.1.0-dev.1',
    },
  });
  assert.notEqual(conflictingModes.status, 0, 'retry and resume modes must remain mutually exclusive');
});

test('all repository callers supply canonical workflow channel labels', async () => {
  for (const name of ['release.yml', 'promote-server.yml', 'nightly-dev.yml']) {
    const raw = await loadWorkflow(name);
    const calls = raw.split(/\n(?=\s{2}[a-zA-Z0-9_]+:)/).filter((block) => /uses:\s*\.\/\.github\/workflows\/publish-server-runtime\.yml/.test(block));
    assert.ok(calls.length > 0, `${name} has no server-runtime publisher caller`);
    for (const call of calls) {
      assert.doesNotMatch(call, /channel:\s*(?:publicdev|public-dev|public_dev|production|prod)\b/);
      assert.match(call, /channel:\s*(?:dev|\$\{\{[^\n]*(?:'stable'|'preview')[^\n]*\}\})/);
    }
  }
});

test('workflow derives version as data from the exact authorized source checkout', async () => {
  const raw = await loadWorkflow('publish-server-runtime.yml');
  assert.match(raw, /path:\s*authorized-source/);
  assert.match(raw, /authorized-server-version\.mjs/);
  assert.match(raw, /--base-version/);
});
