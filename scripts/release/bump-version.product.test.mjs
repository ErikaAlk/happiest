import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

async function writeJsonFile(filePath, value) {
  await mkdir(resolve(filePath, '..'), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return filePath;
}

async function readVersion(filePath) {
  return String(JSON.parse(await readFile(filePath, 'utf8')).version);
}

async function writeProductFixture(dir, versions = {}) {
  const version = (key) => versions[key] ?? '0.1.0';
  return {
    ui: await writeJsonFile(join(dir, 'apps', 'ui', 'package.json'), { name: '@happier-dev/app', version: version('ui') }),
    tauri: await writeJsonFile(join(dir, 'apps', 'ui', 'src-tauri', 'tauri.conf.json'), { version: version('tauri') }),
    cli: await writeJsonFile(join(dir, 'apps', 'cli', 'package.json'), { name: '@happier-dev/cli', version: version('cli') }),
    server: await writeJsonFile(join(dir, 'apps', 'server', 'package.json'), { name: '@happier-dev/server', version: version('server') }),
    runner: await writeJsonFile(join(dir, 'packages', 'relay-server', 'package.json'), { name: '@happier-dev/relay-server', version: version('runner') }),
    stack: await writeJsonFile(join(dir, 'apps', 'stack', 'package.json'), { name: '@happier-dev/stack', version: version('stack') }),
    website: await writeJsonFile(join(dir, 'apps', 'website', 'package.json'), { name: 'website', version: '0.2.10' }),
  };
}

const script = resolve(process.cwd(), 'scripts', 'pipeline', 'release', 'bump-version.mjs');

test('bump-version moves every component of the product to one new version', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'happiest-bump-version-product-'));
  const files = await writeProductFixture(dir);

  const res = spawnSync(process.execPath, [script, '--component', 'product', '--bump', 'patch'], {
    cwd: dir,
    encoding: 'utf8',
  });

  assert.equal(res.status, 0, res.stderr || res.stdout);
  assert.equal(String(res.stdout).trim(), '0.1.1');
  for (const key of ['ui', 'tauri', 'cli', 'server', 'runner', 'stack']) {
    assert.equal(await readVersion(files[key]), '0.1.1', `${key} must carry the product version`);
  }
  assert.equal(await readVersion(files.website), '0.2.10', 'the website is not part of the product version');
});

test('bump-version refuses to bump when product components carry different versions', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'happiest-bump-version-product-mismatch-'));
  const files = await writeProductFixture(dir, { runner: '0.2.0' });

  const res = spawnSync(process.execPath, [script, '--component', 'product', '--bump', 'patch'], {
    cwd: dir,
    encoding: 'utf8',
  });

  assert.notEqual(res.status, 0);
  assert.match(String(res.stderr), /product versions differ/i);
  assert.equal(await readVersion(files.cli), '0.1.0', 'nothing is written when versions differ');
});

test('bump-version no longer bumps a single product component on its own', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'happiest-bump-version-component-'));
  await writeProductFixture(dir);

  const res = spawnSync(process.execPath, [script, '--component', 'cli', '--bump', 'patch'], {
    cwd: dir,
    encoding: 'utf8',
  });

  assert.notEqual(res.status, 0);
  assert.match(String(res.stderr), /--component must be one of: product, website/);
});
