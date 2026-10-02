import { productIdentity } from '@happier-dev/release-runtime/productIdentity';

const DEFAULT_APP_SCHEME = 'happier';
const { androidPackage } = productIdentity;

const APP_SCHEME_BY_APP_ID = new Map<string, string>([
  [`${androidPackage}.internaldev`, 'happier-internaldev'],
  [`${androidPackage}.internaldev.devclient`, 'happier-internaldev-devclient'],
  ['dev.happier.app.dev.internal.devclient', 'happier-internaldev'],
  [`${androidPackage}.publicdev`, 'happier-dev'],
  [`${androidPackage}.publicdev.devclient`, 'happier-dev-devclient'],
]);

export function resolveMobileAppScheme(
  env: NodeJS.ProcessEnv,
  options?: Readonly<{ appId?: string | null }>,
): string {
  const configured = String(
    env.HAPPIER_E2E_MOBILE_APP_SCHEME ??
    env.EXPO_APP_SCHEME ??
    '',
  ).trim();

  if (configured) return configured;

  const appId = String(options?.appId ?? '').trim();
  const appIdScheme = APP_SCHEME_BY_APP_ID.get(appId);
  return appIdScheme || DEFAULT_APP_SCHEME;
}
