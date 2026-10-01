import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { BUNDLE_CANDIDATE_PLATFORMS, materializeBundleCandidate, packBundleCandidate } from './bundle-candidate.mjs';

const bundleCandidateScript = fileURLToPath(new URL('./bundle-candidate.mjs', import.meta.url));

test('bundle candidate is source/version bound and materializes only fixed inputs', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tauri-candidate-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const candidateUi = path.join(root, 'candidate-ui');
  const trustedUi = path.join(root, 'trusted-ui');
  const outDir = path.join(root, 'candidate');
  fs.mkdirSync(path.join(candidateUi, 'src-tauri', 'target', 'release'), { recursive: true });
  fs.mkdirSync(path.join(candidateUi, 'src-tauri', 'binaries'), { recursive: true });
  fs.writeFileSync(path.join(candidateUi, 'src-tauri', 'target', 'release', 'app'), 'candidate-app');
  fs.writeFileSync(path.join(candidateUi, 'src-tauri', 'binaries', 'hsetup-x86_64-unknown-linux-gnu'), 'candidate-sidecar');
  fs.writeFileSync(path.join(candidateUi, 'src-tauri', 'binaries', 'hsetup-x86_64-unknown-linux-gnu.gz'), 'candidate-sidecar-gzip');

  const identity = { platformKey: 'linux-x86_64', sourceSha: 'a'.repeat(40), environment: 'preview', uiVersion: '1.2.3', buildVersion: '1.2.3-preview.7' };
  const manifest = packBundleCandidate({ ...identity, uiDir: candidateUi, outDir });
  assert.deepEqual(Object.keys(manifest).sort(), ['buildVersion', 'environment', 'files', 'platformKey', 'schema', 'sourceSha', 'uiVersion']);
  materializeBundleCandidate({ ...identity, uiDir: trustedUi, candidateDir: outDir });
  assert.equal(fs.readFileSync(path.join(trustedUi, 'src-tauri', 'target', 'release', 'app'), 'utf8'), 'candidate-app');
  assert.equal(fs.readFileSync(path.join(trustedUi, 'src-tauri', 'binaries', 'hsetup-x86_64-unknown-linux-gnu.gz'), 'utf8'), 'candidate-sidecar-gzip');
  assert.throws(() => materializeBundleCandidate({ ...identity, sourceSha: 'b'.repeat(40), uiDir: trustedUi, candidateDir: outDir }), /sourceSha does not match/);
  for (const [field, value] of [['environment', 'dev'], ['uiVersion', '1.2.4'], ['buildVersion', '1.2.3-preview.8']]) {
    assert.throws(() => materializeBundleCandidate({ ...identity, [field]: value, uiDir: trustedUi, candidateDir: outDir }), new RegExp(`${field} does not match`));
  }
  fs.writeFileSync(path.join(outDir, 'files', 'app'), 'tampered-app');
  assert.throws(() => materializeBundleCandidate({ ...identity, uiDir: trustedUi, candidateDir: outDir }), /integrity mismatch/);
  fs.writeFileSync(path.join(outDir, 'files', 'unexpected'), 'no');
  assert.throws(() => materializeBundleCandidate({ ...identity, uiDir: trustedUi, candidateDir: outDir }), /unexpected entries/);
});

test('only the Linux and Windows x64 desktop platforms have a candidate layout', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tauri-candidate-platforms-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.deepEqual([...BUNDLE_CANDIDATE_PLATFORMS], ['linux-x86_64', 'windows-x86_64']);
  const identity = { sourceSha: 'a'.repeat(40), environment: 'preview', uiVersion: '1.2.3', buildVersion: '1.2.3-preview.7' };
  for (const platformKey of ['darwin-aarch64', 'darwin-x86_64']) {
    assert.throws(() => packBundleCandidate({ ...identity, platformKey, uiDir: root, outDir: path.join(root, 'out') }), /unsupported platform key/);
  }
});

test('the Tauri target is not a candidate option', () => {
  const result = spawnSync(process.execPath, [bundleCandidateScript, '--mode', 'pack', '--platform-key', 'linux-x86_64',
    '--tauri-target', 'x86_64-unknown-linux-gnu'], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown option '--tauri-target'/);
});

test('candidate plan builds only missing platforms and retains all finalizers when every candidate is reused', () => {
  const allPlatforms = ['linux-x86_64', 'windows-x86_64'];
  const artifacts = Object.fromEntries(allPlatforms.map((platform, index) => [platform, { id: index + 1, digest: `sha256:${'b'.repeat(64)}` }]));
  const plan = (reused) => {
    const result = spawnSync(process.execPath, [bundleCandidateScript,
      '--mode', 'plan', '--resume-artifacts-json', JSON.stringify(reused)], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  const fresh = plan({});
  assert.deepEqual(fresh.buildMatrix.include.map((entry) => entry.platform_key), allPlatforms);
  assert.deepEqual(Object.keys(fresh.buildMatrix.include[0]).sort(), ['artifact_digest', 'artifact_id', 'os', 'platform_key']);
  const partial = plan({ 'windows-x86_64': artifacts['windows-x86_64'] });
  assert.deepEqual(partial.buildMatrix.include.map((entry) => entry.platform_key), ['linux-x86_64']);
  const reused = plan(artifacts);
  assert.equal(reused.buildNeeded, false);
  assert.deepEqual(reused.buildMatrix.include, []);
  assert.deepEqual(reused.finalizeMatrix.include.map((entry) => [entry.platform_key, entry.artifact_id, entry.artifact_digest]),
    allPlatforms.map((key) => [key, artifacts[key].id, artifacts[key].digest]));
});
