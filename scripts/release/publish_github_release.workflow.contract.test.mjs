import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

async function loadWorkflow(name) {
  const raw = await readFile(join(repoRoot, '.github', 'workflows', name), 'utf8');
  return { raw, parsed: parse(raw) };
}

test('publish-github-release updates rolling tags with the workflow token and an explicit contents write grant', async () => {
  const { raw, parsed } = await loadWorkflow('publish-github-release.yml');
  const publishJob = parsed?.jobs?.publish;
  assert.ok(publishJob, 'publish job should exist');
  assert.doesNotMatch(raw, /create-github-app-token|RELEASE_BOT_/, 'publish-github-release has no GitHub App');
  assert.deepEqual(publishJob.permissions, { contents: 'write' });

  const remoteAuth = publishJob.steps.find((step) => step.name === 'Configure git remote auth');
  assert.equal(remoteAuth?.env?.TOKEN, '${{ github.token }}', 'tag pushes authenticate with the workflow token');
  const publish = publishJob.steps.find((step) => step.name === 'Publish GitHub release (pipeline)');
  assert.equal(publish?.env?.GH_TOKEN, '${{ github.token }}');
  assert.match(raw, /node scripts\/pipeline\/run\.mjs github-publish-release/, 'publish-github-release must delegate to pipeline script');
  assert.match(
    raw,
    /persist-credentials:\s*false/,
    'publish-github-release must not persist checkout git credentials next to the explicit remote auth',
  );
});

test('publish-github-release passes release note inputs through to the pipeline script', async () => {
  const { raw } = await loadWorkflow('publish-github-release.yml');

  assert.match(raw, /release_message:/, 'publish-github-release should accept a release_message input');
  assert.match(raw, /release_message:\s*\$\{\{\s*inputs\.release_message\s*\}\}/, 'workflow should pass release_message input');
});
