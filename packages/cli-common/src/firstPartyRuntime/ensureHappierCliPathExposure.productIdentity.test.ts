import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { resolveForeignHappierCli, resolveTerminalHappierCli } from './index.js';

const executableSuffix = process.platform === 'win32' ? '.exe' : '';
const tempDirs: string[] = [];

async function createHome(): Promise<string> {
    const homeDir = await mkdtemp(join(tmpdir(), 'happiest-cli-path-identity-'));
    tempDirs.push(homeDir);
    return homeDir;
}

async function writeExecutable(path: string): Promise<void> {
    await writeFile(path, '#!/bin/sh\n', 'utf8');
    await chmod(path, 0o755);
}

function pathEnv(homeDir: string, dirs: readonly string[]): NodeJS.ProcessEnv {
    return { HOME: homeDir, USERPROFILE: homeDir, PATH: dirs.join(delimiter), PATHEXT: '.exe;.cmd' };
}

afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(async (dir) => {
        await rm(dir, { recursive: true, force: true });
    }));
});

// An upstream Happier installed on the same machine puts its own `happier` command on PATH. It is
// another product, not a copy of this CLI the user installed, so it never counts as "your own CLI".
describe('the CLI on PATH next to an upstream Happier', () => {
    it('does not take the upstream happier command for this product’s CLI', async () => {
        const homeDir = await createHome();
        const binDir = join(homeDir, '.happiest', 'bin');
        const upstreamBin = join(homeDir, '.happier', 'bin');
        await mkdir(upstreamBin, { recursive: true });
        await writeExecutable(join(upstreamBin, `happier${executableSuffix}`));

        const processEnv = pathEnv(homeDir, [upstreamBin]);
        expect(resolveForeignHappierCli({ binDir, processEnv })).toBeNull();
        expect(resolveTerminalHappierCli({ binDir, processEnv })).toBeNull();
    });

    it('finds a copy of this product’s command the user installed elsewhere', async () => {
        const homeDir = await createHome();
        const binDir = join(homeDir, '.happiest', 'bin');
        const ownBin = join(homeDir, 'tools', 'bin');
        await mkdir(ownBin, { recursive: true });
        const ownCli = join(ownBin, `happiest${executableSuffix}`);
        await writeExecutable(ownCli);

        const processEnv = pathEnv(homeDir, [ownBin]);
        expect(resolveForeignHappierCli({ binDir, processEnv })).toBe(ownCli);
        expect(resolveTerminalHappierCli({ binDir, processEnv })).toEqual({
            command: ownCli,
            managed: false,
            desktopExposed: false,
        });
    });
});
