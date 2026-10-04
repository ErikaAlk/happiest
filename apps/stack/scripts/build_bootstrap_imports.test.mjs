import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

// The scripts that build the workspace packages before a desktop or web build. They run on a
// fresh checkout, so nothing they load may live in a package's build output.
const BOOTSTRAP_ENTRIES = [
  'apps/ui/scripts/prepareTauriSidecar.mjs',
  'apps/ui/scripts/ensureWorkspacePackagesBuilt.mjs',
];

const STATIC_IMPORT = /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

test('the workspace build bootstrap loads before any workspace package is built', () => {
  const seen = new Set();
  const builtImports = [];
  const visit = (file) => {
    if (seen.has(file) || !existsSync(file)) return;
    seen.add(file);
    for (const match of readFileSync(file, 'utf8').matchAll(STATIC_IMPORT)) {
      const specifier = match[1] ?? match[2];
      if (specifier.startsWith('.')) {
        visit(resolve(dirname(file), specifier));
      } else if (specifier.startsWith('@happier-dev/')) {
        // Resolved the way Node's ESM loader resolves it from the importing module.
        const target = fileURLToPath(import.meta.resolve(specifier, pathToFileURL(file).href));
        if (target.split(sep).includes('dist')) builtImports.push(`${relative(repoRoot, file)} -> ${specifier}`);
      }
    }
  };
  for (const entry of BOOTSTRAP_ENTRIES) visit(resolve(repoRoot, entry));

  assert.ok(seen.size > BOOTSTRAP_ENTRIES.length, 'expected to walk the bootstrap import graph');
  assert.deepEqual(builtImports, []);
});
