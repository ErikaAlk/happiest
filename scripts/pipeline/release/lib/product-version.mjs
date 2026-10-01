// @ts-check

import fs from 'node:fs';
import path from 'node:path';

/**
 * Happiest ships one product version: the CLI, server runtime (and its runner package), hstack,
 * the web UI and the desktop app are all released under the same number. These package
 * directories hold it, together with every Tauri config under apps/ui/src-tauri that declares a
 * top-level version.
 */
export const PRODUCT_VERSION_PACKAGE_DIRS = Object.freeze([
  'apps/ui',
  'apps/cli',
  'apps/server',
  'packages/relay-server',
  'apps/stack',
]);

const TAURI_CONFIG_DIR = 'apps/ui/src-tauri';

/**
 * @param {string} filePath
 */
function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * @param {string} filePath
 * @param {unknown} value
 */
function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

/**
 * @param {string} repoRoot
 * @returns {string[]} repository-relative paths of every file that carries the product version
 */
export function listProductVersionFiles(repoRoot) {
  const files = PRODUCT_VERSION_PACKAGE_DIRS.map((dir) => `${dir}/package.json`);
  const tauriDir = path.join(repoRoot, TAURI_CONFIG_DIR);
  if (fs.existsSync(tauriDir)) {
    for (const name of fs.readdirSync(tauriDir).filter((entry) => entry.endsWith('.json')).sort()) {
      const relativePath = `${TAURI_CONFIG_DIR}/${name}`;
      if (typeof readJson(path.join(repoRoot, relativePath))?.version === 'string') {
        files.push(relativePath);
      }
    }
  }
  return files;
}

/**
 * @param {string} repoRoot
 * @returns {string} the single product version
 */
export function readProductVersion(repoRoot) {
  const entries = listProductVersionFiles(repoRoot).map((relativePath) => [
    relativePath,
    String(readJson(path.join(repoRoot, relativePath)).version ?? '').trim(),
  ]);
  const distinct = new Set(entries.map(([, version]) => version));
  const [version] = distinct;
  if (distinct.size !== 1 || !version) {
    throw new Error(
      `[release] product versions differ: ${entries.map(([file, value]) => `${file}=${value || '<missing>'}`).join(', ')}`,
    );
  }
  return version;
}

/**
 * @param {string} repoRoot
 * @param {string} version
 */
export function writeProductVersion(repoRoot, version) {
  for (const relativePath of listProductVersionFiles(repoRoot)) {
    const filePath = path.join(repoRoot, relativePath);
    const json = readJson(filePath);
    json.version = version;
    writeJson(filePath, json);
  }
}
