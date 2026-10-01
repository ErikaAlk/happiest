import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getBinaryPublishProductSpec } from '../pipeline/release/publishing/product-specs.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

async function loadWorkflow(name) {
  return readFile(join(repoRoot, '.github', 'workflows', name), 'utf8');
}

async function loadFile(rel) {
  return readFile(join(repoRoot, rel), 'utf8');
}

test('GitHub release titles of the web bundle and binaries are prefixed with Happiest', async () => {
  const publishUiWeb = await loadFile('scripts/pipeline/release/publish-ui-web.mjs');
  assert.match(publishUiWeb, /`Happiest UI Web Bundle \$\{resolveRollingReleaseLabel\(channel\)\}`/);
  assert.match(publishUiWeb, /`Happiest UI Web Bundle v\$\{uiVersion\}`/);

  assert.equal(getBinaryPublishProductSpec('server').releaseTitleBase, 'Happiest Server');

  assert.equal(getBinaryPublishProductSpec('cli').releaseTitleBase, 'Happiest CLI');
  assert.equal(getBinaryPublishProductSpec('hstack').releaseTitleBase, 'Happiest Stack');
});

test('desktop release titles keep the desktop app name', async () => {
  const buildTauri = await loadWorkflow('build-tauri.yml');
  assert.match(buildTauri, /title: Happier UI Desktop Dev/);
  assert.match(buildTauri, /title: Happier UI Desktop Preview/);
  assert.match(buildTauri, /title: Happier UI Desktop v/);
  assert.match(buildTauri, /--title "Happier UI Desktop Stable"/);
});
