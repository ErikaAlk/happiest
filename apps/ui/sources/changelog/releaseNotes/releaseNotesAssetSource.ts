import { productIdentity } from '@happier-dev/release-runtime/productIdentity';

/**
 * The GitHub release that holds remote release-notes files: the manifest, the asset index and remote
 * media. It lives in this product's own repository; release workflows do not upload to it, so a
 * release note that needs remote files requires uploading them there.
 */
export const RELEASE_NOTES_ASSETS_REPO = productIdentity.githubRepo;
export const RELEASE_NOTES_ASSETS_TAG = 'release-notes';

export function buildReleaseNotesAssetsBaseUrl(repo: string, tag: string): string {
    return `https://github.com/${repo}/releases/download/${tag}/`;
}

export const RELEASE_NOTES_ASSETS_BASE_URL = buildReleaseNotesAssetsBaseUrl(RELEASE_NOTES_ASSETS_REPO, RELEASE_NOTES_ASSETS_TAG);
