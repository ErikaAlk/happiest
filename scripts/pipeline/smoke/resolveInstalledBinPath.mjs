import fs from 'node:fs';
import path from 'node:path';
import { productIdentity } from '@happier-dev/release-runtime/productIdentity';

/**
 * @param {string} prefixDir
 * @param {{ platform?: NodeJS.Platform }} [options]
 * @returns {string}
 */
export function resolveInstalledBinPath(prefixDir, options = {}) {
  const platform = options.platform ?? process.platform;
  const exe = platform === 'win32' ? `${productIdentity.commandName}.cmd` : productIdentity.commandName;

  const candidates = [
    path.join(prefixDir, 'bin', exe),
    path.join(prefixDir, exe),
    path.join(prefixDir, 'node_modules', '.bin', exe),
    path.join(prefixDir, 'lib', 'node_modules', '.bin', exe),
    path.join(prefixDir, 'lib', 'node_modules', '@happier-dev', 'cli', 'bin', `${productIdentity.commandName}.mjs`),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return '';
}
