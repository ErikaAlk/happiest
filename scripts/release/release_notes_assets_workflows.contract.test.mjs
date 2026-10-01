import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

async function loadWorkflow(name) {
  return readFile(join(repoRoot, '.github', 'workflows', name), 'utf8');
}

test('no release workflow publishes release-note assets to the upstream assets repository', async () => {
  for (const workflow of ['promote-ui.yml', 'build-ui-mobile-local.yml', 'publish-ui-web.yml', 'publish-ui-mobile-dev.yml']) {
    const raw = await loadWorkflow(workflow);
    assert.doesNotMatch(raw, /publish-release-notes-assets\.mjs/, workflow);
    assert.doesNotMatch(raw, /release_notes_assets_token/, workflow);
    assert.doesNotMatch(raw, /happier-assets/, workflow);
  }

  for (const workflow of ['build-ui-mobile-local.yml', 'publish-ui-web.yml', 'publish-ui-mobile-dev.yml']) {
    const raw = await loadWorkflow(workflow);
    assert.match(raw, /(?:sources\/scripts\/parseReleaseNotes\.ts|project-release-notes\.mjs)/);
  }
});
