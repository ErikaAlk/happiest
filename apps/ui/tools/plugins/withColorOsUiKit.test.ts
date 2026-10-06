import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const plugin = require('../../plugins/withColorOsUiKit.js');

type PropertiesItem = { type: 'comment'; value: string } | { type: 'empty' } | { type: 'property'; key: string; value: string };

const createdDirs: string[] = [];

function makeTempDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coloros-ui-kit-plugin-'));
    createdDirs.push(dir);
    return dir;
}

function writeKit(root: string, { agp, kotlin }: { agp: string; kotlin: string }): string {
    const kitAndroidDir = path.join(root, 'coloros-ui-kit', 'android');
    fs.mkdirSync(path.join(kitAndroidDir, 'gradle'), { recursive: true });
    fs.writeFileSync(
        path.join(kitAndroidDir, 'gradle', 'libs.versions.toml'),
        ['[versions]', `agp = "${agp}"`, `kotlin = "${kotlin}"`, 'composeBom = "2026.09.00"', '', '[libraries]', 'junit = { module = "junit:junit", version = "4.13.2" }', ''].join('\n'),
    );
    return kitAndroidDir;
}

afterEach(() => {
    for (const dir of createdDirs.splice(0)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

const SETTINGS_GRADLE = [
    'pluginManagement {',
    '  includeBuild(reactNativeGradlePlugin)',
    '}',
    "rootProject.name = 'Happier'",
    '',
    'expoAutolinking.useExpoVersionCatalog()',
    '',
    "include ':app'",
    'includeBuild(expoAutolinking.reactNativeGradlePlugin)',
    '',
].join('\n');

const ROOT_BUILD_GRADLE = [
    'buildscript {',
    '  dependencies {',
    "    classpath 'com.google.gms:google-services:4.4.4'",
    "    classpath('com.android.tools.build:gradle')",
    "    classpath('com.facebook.react:react-native-gradle-plugin')",
    '  }',
    '}',
    '',
].join('\n');

describe('withColorOsUiKit', () => {
    it('finds coloros-ui-kit/android in the nearest ancestor of the project', () => {
        const root = makeTempDir();
        const kitAndroidDir = writeKit(root, { agp: '9.4.1', kotlin: '2.4.20' });
        const projectRoot = path.join(root, 'Happiest', '.dev', 'worktree', 'x', 'apps', 'ui');
        fs.mkdirSync(projectRoot, { recursive: true });

        expect(plugin.findColorOsUiKitAndroidDir(projectRoot)).toBe(kitAndroidDir);
    });

    it('fails with the searched start directory when no ancestor contains the kit', () => {
        const root = makeTempDir();
        const projectRoot = path.join(root, 'apps', 'ui');
        fs.mkdirSync(projectRoot, { recursive: true });

        expect(() => plugin.findColorOsUiKitAndroidDir(projectRoot)).toThrow(/coloros-ui-kit/);
    });

    it('reads the Android Gradle plugin and Kotlin versions from the kit version catalog', () => {
        const kitAndroidDir = writeKit(makeTempDir(), { agp: '9.4.1', kotlin: '2.4.20' });

        expect(plugin.readColorOsUiKitToolchain(kitAndroidDir)).toEqual({
            androidGradlePluginVersion: '9.4.1',
            kotlinVersion: '2.4.20',
        });
    });

    it('includes the kit build once in settings.gradle, with a forward-slash path', () => {
        const kitAndroidDir = 'C:\\Users\\me\\Workspace\\code\\coloros-ui-kit\\android';

        const once = plugin.applyColorOsUiKitIncludeBuild(SETTINGS_GRADLE, kitAndroidDir);
        const twice = plugin.applyColorOsUiKitIncludeBuild(once, kitAndroidDir);

        expect(once).toContain("includeBuild('C:/Users/me/Workspace/code/coloros-ui-kit/android')");
        expect(twice).toBe(once);
        expect(once.indexOf("includeBuild('C:/Users")).toBeGreaterThan(once.indexOf('includeBuild(expoAutolinking.reactNativeGradlePlugin)'));
    });

    it('pins the root Android Gradle plugin classpath to the kit version, also when already pinned', () => {
        const pinned = plugin.applyAndroidGradlePluginVersion(ROOT_BUILD_GRADLE, '9.4.1');
        const repinned = plugin.applyAndroidGradlePluginVersion(pinned, '9.5.0');

        expect(pinned).toContain("classpath('com.android.tools.build:gradle:9.4.1')");
        expect(repinned).toContain("classpath('com.android.tools.build:gradle:9.5.0')");
        expect(repinned).not.toContain('9.4.1');
    });

    it('fails when the root build script has no Android Gradle plugin classpath to pin', () => {
        expect(() => plugin.applyAndroidGradlePluginVersion('buildscript {}\n', '9.4.1')).toThrow(/com\.android\.tools\.build:gradle/);
    });

    it('writes the kit Kotlin version and SDK levels into gradle.properties', () => {
        const props: PropertiesItem[] = [
            { type: 'property', key: 'android.kotlinVersion', value: '2.2.0' },
            { type: 'property', key: 'newArchEnabled', value: 'true' },
        ];

        plugin.applyColorOsUiKitGradleProperties(props, { kotlinVersion: '2.4.20' });

        expect(props).toEqual([
            { type: 'property', key: 'android.kotlinVersion', value: '2.4.20' },
            { type: 'property', key: 'newArchEnabled', value: 'true' },
            { type: 'property', key: 'android.compileSdkVersion', value: '37' },
            { type: 'property', key: 'android.minSdkVersion', value: '26' },
        ]);
    });

    it('points the Gradle wrapper at the given distribution and keeps the other wrapper settings', () => {
        const wrapper = [
            'distributionBase=GRADLE_USER_HOME',
            'distributionUrl=https\\://services.gradle.org/distributions/gradle-9.4.1-bin.zip',
            'networkTimeout=10000',
            '',
        ].join('\n');

        const next = plugin.applyGradleWrapperDistribution(wrapper, 'https\\://services.gradle.org/distributions/gradle-9.6.1-bin.zip');

        expect(next).toContain('distributionUrl=https\\://services.gradle.org/distributions/gradle-9.6.1-bin.zip');
        expect(next).toContain('networkTimeout=10000');
        expect(next).not.toContain('gradle-9.4.1-bin.zip');
    });
});
