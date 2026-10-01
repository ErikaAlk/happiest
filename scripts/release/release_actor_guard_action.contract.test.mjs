import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

test('release-actor-guard action supports trusted actors and URL-encodes actor paths', async () => {
  const actionPath = resolve(repoRoot, '.github', 'actions', 'release-actor-guard', 'action.yml');
  const raw = fs.readFileSync(actionPath, 'utf8');

  assert.match(raw, /\n\s*trusted_actors:\n/, 'action.yml must define a trusted_actors input');
  assert.match(raw, /INPUT_TRUSTED_ACTORS/, 'action should pass trusted_actors into the verify step env');
  assert.match(raw, /\|@uri/, 'action should URL-encode actor when building GitHub API URLs');
});

test('release-actor-guard retries transient GitHub API failures at its shared HTTP boundary', () => {
  const actionPath = resolve(repoRoot, '.github', 'actions', 'release-actor-guard', 'action.yml');
  const raw = fs.readFileSync(actionPath, 'utf8');

  assert.match(raw, /github_api_status\(\)/, 'the action should own GitHub API retry policy in one helper');
  assert.match(raw, /--retry 3/);
  assert.match(raw, /--retry-delay 1/);
  assert.match(raw, /--retry-max-time 90/);
  assert.match(raw, /--retry-all-errors/);
  assert.equal((raw.match(/\bcurl /g) ?? []).length, 1, 'all guard API reads should use the shared retrying helper');
});

test('release-actor-guard authorizes the actor by repository admin permission with the workflow token only', () => {
  const actionPath = resolve(repoRoot, '.github', 'actions', 'release-actor-guard', 'action.yml');
  const raw = fs.readFileSync(actionPath, 'utf8');
  const action = YAML.parse(raw);

  assert.deepEqual(Object.keys(action.inputs), ['trusted_actors'], 'the guard has no team or GitHub App inputs');
  assert.doesNotMatch(raw, /create-github-app-token|RELEASE_BOT|team_slug|app_id|private_key|\/orgs\//);
  assert.match(raw, /REPO_TOKEN: \$\{\{ github\.token \}\}/);
  assert.match(raw, /repos\/\$\{REPO\}\/collaborators\/\$\{actor_enc\}\/permission/);
  assert.match(raw, /\.permission \/\/ ""/);
  assert.match(raw, /"admin"/);
  assert.doesNotMatch(raw, /graphql/i, 'a failed permission read fails the guard instead of consulting a second source');
});

test('every release-actor-guard call site passes at most the trusted_actors input', () => {
  const workflowsDir = resolve(repoRoot, '.github', 'workflows');
  let callSites = 0;
  for (const file of fs.readdirSync(workflowsDir).filter((name) => name.endsWith('.yml'))) {
    const workflow = YAML.parse(fs.readFileSync(resolve(workflowsDir, file), 'utf8'));
    for (const [jobName, job] of Object.entries(workflow.jobs ?? {})) {
      for (const step of job.steps ?? []) {
        if (step.uses !== './.github/actions/release-actor-guard') continue;
        callSites += 1;
        assert.deepEqual(
          Object.keys(step.with ?? {}).filter((key) => key !== 'trusted_actors'),
          [],
          `${file}:${jobName} must not pass team or GitHub App inputs to the guard`,
        );
      }
    }
  }
  assert.ok(callSites > 0, 'expected at least one guard call site');
});

test('deploy workflows trust the release bot actor for push-triggered deployments', async () => {
  const deployOnPath = resolve(repoRoot, '.github', 'workflows', 'deploy-on-deploy-branch.yml');
  const deployPath = resolve(repoRoot, '.github', 'workflows', 'deploy.yml');

  const deployOnRaw = fs.readFileSync(deployOnPath, 'utf8');
  const deployRaw = fs.readFileSync(deployPath, 'utf8');

  assert.match(
    deployOnRaw,
    /trusted_actors:\s*happier-release-bot\[bot\]/,
    'deploy-on-deploy-branch should trust the release bot actor so deploy-branch pushes can deploy',
  );
  assert.match(
    deployRaw,
    /trusted_actors:\s*happier-release-bot\[bot\]/,
    'deploy workflow should trust the release bot actor so workflow_call can deploy',
  );
});
