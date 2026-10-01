import { productIdentity } from '@happier-dev/release-runtime/productIdentity';

/** Server a fresh install connects to; the built-in `cloud` profile points here and it serves the web app too. */
export const DEFAULT_SERVER_URL = productIdentity.defaultServerUrl;

/** Display name of the built-in `cloud` profile. */
export const DEFAULT_SERVER_NAME = `${productIdentity.productName} Server`;

// Upstream Happier Cloud serves its API and its web app from different hosts.
const UPSTREAM_CLOUD_API_URL = 'https://api.happier.dev';
const UPSTREAM_CLOUD_WEBAPP_URL = 'https://cloud.happier.dev';

/**
 * Web app address for a server added without one: the server's own origin, except for the
 * upstream cloud API. Throws on an invalid URL; each caller decides its own fallback.
 */
export function deriveDefaultWebappUrl(serverUrl: string): string {
  const url = new URL(serverUrl);
  if (url.toString().replace(/\/+$/, '') === UPSTREAM_CLOUD_API_URL) {
    return UPSTREAM_CLOUD_WEBAPP_URL;
  }
  return url.origin;
}
