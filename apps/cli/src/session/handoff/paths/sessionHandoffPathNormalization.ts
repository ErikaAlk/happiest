import { join } from 'node:path';

import { productIdentity } from '@happier-dev/release-runtime/productIdentity';

const PRODUCT_HOME_SUFFIX = `/${productIdentity.homeDirName}`;
const PRODUCT_HOME_MARKER = `${PRODUCT_HOME_SUFFIX}/`;

function trimTrailingSeparators(path: string): string {
    return path.trim().replace(/[\\/]+$/, '');
}

function normalizeRelativePath(relativePath: string): string {
    return relativePath.replace(/[\\/]+/g, '/');
}

function getPathRemainderWithinBase(path: string, basePath: string): string | null {
    const normalizedBasePath = trimTrailingSeparators(basePath);
    const trimmedPath = path.trim();

    if (trimmedPath === normalizedBasePath || trimTrailingSeparators(trimmedPath) === normalizedBasePath) {
        return '';
    }
    if (!trimmedPath.startsWith(normalizedBasePath)) {
        return null;
    }

    const remainder = trimmedPath.slice(normalizedBasePath.length);
    if (!/^[\\/]+/.test(remainder)) {
        return null;
    }

    return remainder.replace(/^[\\/]+/, '');
}

export function resolveSessionHandoffLocalHomeDir(params: Readonly<{
    activeServerDir: string;
    fallbackHomeDir: string;
}>): string {
    const activeServerDir = trimTrailingSeparators(params.activeServerDir);
    const fallbackHomeDir = trimTrailingSeparators(params.fallbackHomeDir);
    const normalizedActiveServerDir = activeServerDir.replace(/\\/g, '/');

    const markerIndex = normalizedActiveServerDir.indexOf(PRODUCT_HOME_MARKER);
    if (markerIndex > 0) {
        return activeServerDir.slice(0, markerIndex);
    }
    if (markerIndex === 0) {
        return fallbackHomeDir;
    }

    if (normalizedActiveServerDir.endsWith(PRODUCT_HOME_SUFFIX)) {
        const prefix = activeServerDir.slice(0, -PRODUCT_HOME_SUFFIX.length);
        return prefix || fallbackHomeDir;
    }

    return fallbackHomeDir;
}

export function toHomeRelativePath(params: Readonly<{
    absolutePath: string;
    homeDir: string;
}>): string {
    const absolutePath = params.absolutePath.trim();
    const remainder = getPathRemainderWithinBase(absolutePath, params.homeDir);

    if (remainder !== null) {
        return remainder.length > 0 ? `~/${normalizeRelativePath(remainder)}` : '~';
    }
    return absolutePath;
}

export function expandHomeRelativePath(params: Readonly<{
    path: string;
    homeDir: string;
}>): string {
    const path = params.path.trim();
    const homeDir = trimTrailingSeparators(params.homeDir);

    if (path === '~') {
        return homeDir;
    }
    if (path.startsWith('~/') || path.startsWith('~\\')) {
        return join(homeDir, normalizeRelativePath(path.slice(2)));
    }
    return path;
}

export function normalizeSessionHandoffTargetPathForLocalMachine(params: Readonly<{
    requestedTargetPath: string;
    homeDir: string;
}>): string {
    const expanded = expandHomeRelativePath({ path: params.requestedTargetPath, homeDir: params.homeDir });
    const homeDir = trimTrailingSeparators(params.homeDir);
    const normalizedExpanded = expanded.replace(/\\/g, '/');

    if (getPathRemainderWithinBase(expanded, homeDir) !== null) {
        return expanded;
    }

    // Handoff commonly uses app-owned roots under the product home (`~/.happiest/**`). When the request
    // carries an absolute path from another machine (macOS `/Users/...` vs Linux `/home/...`), rebase
    // that product-home suffix onto the local home dir so the target machine always uses a
    // machine-local writable root.
    const markerIndex = normalizedExpanded.indexOf(PRODUCT_HOME_MARKER);
    if (markerIndex >= 0) {
        const remainder = normalizedExpanded.slice(markerIndex + PRODUCT_HOME_MARKER.length);
        return join(homeDir, productIdentity.homeDirName, remainder);
    }
    if (normalizedExpanded.endsWith(PRODUCT_HOME_SUFFIX)) {
        return join(homeDir, productIdentity.homeDirName);
    }

    // General cross-machine normalization: when a caller passes a macOS/Linux home-rooted path
    // (`/Users/<user>/...` or `/home/<user>/...`), rebase the suffix onto the local machine home.
    // This avoids treating a source machine absolute path as portable across machines/OSes.
    const macHomeMatch = expanded.match(/^\/Users\/[^/]+(?:\/(.*))?$/);
    if (macHomeMatch) {
        const remainder = macHomeMatch[1] ?? '';
        return remainder ? join(homeDir, remainder) : homeDir;
    }
    const linuxHomeMatch = expanded.match(/^\/home\/[^/]+(?:\/(.*))?$/);
    if (linuxHomeMatch) {
        const remainder = linuxHomeMatch[1] ?? '';
        return remainder ? join(homeDir, remainder) : homeDir;
    }

    return expanded;
}
