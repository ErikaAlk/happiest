import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { productIdentity } from '@happier-dev/release-runtime/productIdentity';

function readJson(filePath: string) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

describe('Tauri updater endpoints', () => {
    it('uses ui-desktop-* release tags of the product repository for desktop update feeds', () => {
        const stableConfig = readJson(path.resolve(__dirname, '../../../src-tauri/tauri.conf.json'));
        const previewConfig = readJson(path.resolve(__dirname, '../../../src-tauri/tauri.preview.conf.json'));
        const publicdevConfig = readJson(path.resolve(__dirname, '../../../src-tauri/tauri.publicdev.conf.json'));
        const feed = (tag: string) => `https://github.com/${productIdentity.githubRepo}/releases/download/${tag}/latest.json`;

        expect(stableConfig.plugins.updater.endpoints).toEqual([feed('ui-desktop-stable')]);
        expect(previewConfig.plugins.updater.endpoints).toEqual([feed('ui-desktop-preview')]);
        expect(publicdevConfig.plugins.updater.endpoints).toEqual([feed('ui-desktop-dev')]);
    });
});
