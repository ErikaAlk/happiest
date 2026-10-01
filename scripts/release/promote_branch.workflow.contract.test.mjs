import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

async function loadWorkflow(name) {
  return readFile(join(repoRoot, '.github', 'workflows', name), 'utf8');
}

test('promote-branch delegates branch updates to pipeline script with the workflow token', async () => {
  const raw = await loadWorkflow('promote-branch.yml');
  const promote = parse(raw).jobs.promote;
  assert.doesNotMatch(raw, /create-github-app-token|RELEASE_BOT_/);
  assert.deepEqual(promote.permissions, { contents: 'write' });
  const mutation = promote.steps.find((step) => step.name === 'Promote branch (pipeline)');
  assert.equal(mutation.env.GH_TOKEN, '${{ github.token }}');
  assert.match(mutation.run, /node scripts\/pipeline\/run\.mjs promote-branch/);
});

test('promote-branch carries an authorized source SHA through the authenticated mutation boundary', async () => {
  const raw = await loadWorkflow('promote-branch.yml');

  assert.match(raw, /source_sha:\s*\n\s*description: Exact source commit SHA authorized for mutation/);
  assert.match(raw, /INPUT_SOURCE_SHA/);
  assert.match(raw, /source_sha is required unless dry_run is true/);
  assert.match(raw, /--source-sha "\$INPUT_SOURCE_SHA"/);
});
