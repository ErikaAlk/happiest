import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

function getUiDir(): string {
    return join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
}

function readJson(fileName: string): any {
    return JSON.parse(readFileSync(join(getUiDir(), fileName), 'utf-8'));
}

// Every Android application id the app is built with: one per app variant, plus the ids that
// EAS build profiles set explicitly (the dev clients).
function listBuiltAndroidPackages(): string[] {
    const { APP_ENVIRONMENT_CONFIGS } = createRequire(import.meta.url)(join(getUiDir(), 'appVariantConfig.cjs'));
    const variantPackages = Object.values(APP_ENVIRONMENT_CONFIGS as Record<string, { androidPackage: string }>)
        .map((config) => config.androidPackage);
    const profilePackages = Object.values(readJson('eas.json').build as Record<string, { env?: Record<string, string> }>)
        .map((profile) => profile.env?.EXPO_ANDROID_PACKAGE)
        .filter((value): value is string => typeof value === 'string');
    return [...new Set([...variantPackages, ...profilePackages])].sort();
}

describe('google-services.json', () => {
    it('has a Firebase Android client for every application id the app is built with', () => {
        // The Google services Gradle plugin fails a build whose application id has no client here.
        const clientPackages = new Set(
            (readJson('google-services.json').client ?? [])
                .filter((client: any) => typeof client?.client_info?.mobilesdk_app_id === 'string')
                .map((client: any) => client?.client_info?.android_client_info?.package_name),
        );

        const builtPackages = listBuiltAndroidPackages();
        expect(builtPackages.length).toBeGreaterThan(0);
        expect(builtPackages.filter((packageName) => !clientPackages.has(packageName))).toEqual([]);
    });
});
