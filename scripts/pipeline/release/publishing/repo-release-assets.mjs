// @ts-check

import { copyFile, lstat, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

/**
 * Copies the repository files a product publishes byte-for-byte next to its archives (the CLI's
 * installer scripts and signing public key) into the artifacts directory and returns them as release
 * artifacts. The caller adds the result to the product's signed checksum envelope: the immutable
 * release inspector and the rolling projection only carry assets that envelope covers.
 *
 * @param {{
 *   repoRoot?: string;
 *   artifactsDir: string;
 *   productSpec: Pick<import('./product-specs.mjs').BinaryPublishProductSpec, 'id' | 'repoAssetPaths'>;
 * }} params
 * @returns {Promise<Array<{ name: string; path: string; os: string; arch: string }>>}
 */
export async function stageRepoReleaseAssets({ repoRoot, artifactsDir, productSpec }) {
  if (productSpec.repoAssetPaths.length === 0) return [];
  if (!repoRoot) {
    throw new Error(`repoRoot is required to stage the repository release assets of ${productSpec.id}`);
  }
  await mkdir(artifactsDir, { recursive: true });
  const staged = [];
  for (const relativePath of productSpec.repoAssetPaths) {
    const sourcePath = path.resolve(repoRoot, relativePath);
    const metadata = await lstat(sourcePath);
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      throw new Error(`repository release asset must be a regular file: ${relativePath}`);
    }
    const name = path.basename(relativePath);
    const destinationPath = path.join(artifactsDir, name);
    // A candidate-supplied file or link of the same name never survives: the repository bytes win.
    await rm(destinationPath, { recursive: true, force: true });
    await copyFile(sourcePath, destinationPath);
    staged.push({ name, path: destinationPath, os: 'asset', arch: 'any' });
  }
  return staged;
}
