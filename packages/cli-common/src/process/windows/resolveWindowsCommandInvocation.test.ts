import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

// Pass-through spy on the filesystem boundary: every probe still hits the real filesystem, the
// count proves how much per-candidate probing a PATH lookup does.
vi.mock('node:fs', async (importOriginal) => {
    const actual = await importOriginal<typeof import('node:fs')>();
    return { ...actual, existsSync: vi.fn(actual.existsSync) };
});

const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform');

describe('resolveWindowsCommandInvocation', () => {
    const tempDirs = new Set<string>();

    afterEach(() => {
        if (originalPlatformDescriptor) {
            Object.defineProperty(process, 'platform', originalPlatformDescriptor);
        }
        for (const dir of tempDirs) {
            rmSync(dir, { recursive: true, force: true });
        }
        tempDirs.clear();
    });

    it('prefers PATHEXT-resolved commands over extensionless files when both exist on PATH', async () => {
        if (!originalPlatformDescriptor) {
            throw new Error('Expected process.platform to be configurable for this test');
        }
        Object.defineProperty(process, 'platform', { ...originalPlatformDescriptor, value: 'win32' });

        const root = mkdtempSync(join(tmpdir(), 'happier-cli-common-win32-path-'));
        tempDirs.add(root);
        const binDir = join(root, 'bin');
        mkdirSync(binDir, { recursive: true });

        const extensionlessPath = join(binDir, 'codex');
        const cmdShimPath = join(binDir, 'codex.cmd');
        writeFileSync(extensionlessPath, '', 'utf8');
        writeFileSync(cmdShimPath, '@echo off\r\necho ok\r\n', 'utf8');

        const { resolveWindowsCommandOnPath } = await import('./resolveWindowsCommandInvocation.js');

        expect(resolveWindowsCommandOnPath('codex', {
            PATH: binDir,
            PATHEXT: '.CMD;.EXE',
        })?.toLowerCase()).toBe(cmdShimPath.toLowerCase());
    });

    it('probes candidate spellings only in PATH directories that contain the command', async () => {
        if (!originalPlatformDescriptor) {
            throw new Error('Expected process.platform to be configurable for this test');
        }
        Object.defineProperty(process, 'platform', { ...originalPlatformDescriptor, value: 'win32' });

        const root = mkdtempSync(join(tmpdir(), 'happier-cli-common-win32-path-scan-'));
        tempDirs.add(root);
        const pathDirs = Array.from({ length: 30 }, (_, index) => {
            const dir = join(root, `bin-${index}`);
            mkdirSync(dir, { recursive: true });
            writeFileSync(join(dir, `unrelated-${index}.exe`), '', 'utf8');
            return dir;
        });
        const matchingDir = pathDirs[24]!;
        writeFileSync(join(matchingDir, 'tool.cmd'), '@echo off\r\n', 'utf8');
        const env = {
            PATH: [...pathDirs, join(root, 'missing-dir')].join(delimiter),
            PATHEXT: '.COM;.EXE;.BAT;.CMD',
        };

        const { resolveWindowsCommandOnPath } = await import('./resolveWindowsCommandInvocation.js');
        vi.mocked(existsSync).mockClear();

        expect(resolveWindowsCommandOnPath('tool', env)?.toLowerCase()).toBe(join(matchingDir, 'tool.cmd').toLowerCase());
        expect(resolveWindowsCommandOnPath('absent-tool', env)).toBeNull();

        // Each probe is a blocking filesystem call on the daemon's event loop, and the daemon looks
        // up every provider CLI this way whenever the new-session screen asks for capabilities.
        const probedDirs = new Set(vi.mocked(existsSync).mock.calls.map(([probed]) => String(probed).slice(0, matchingDir.length)));
        expect([...probedDirs]).toEqual([matchingDir]);
    });

    it('finds a command installed into a PATH directory after an earlier lookup missed it', async () => {
        if (!originalPlatformDescriptor) {
            throw new Error('Expected process.platform to be configurable for this test');
        }
        Object.defineProperty(process, 'platform', { ...originalPlatformDescriptor, value: 'win32' });

        const root = mkdtempSync(join(tmpdir(), 'happier-cli-common-win32-path-install-'));
        tempDirs.add(root);
        const binDir = join(root, 'bin');
        mkdirSync(binDir, { recursive: true });
        const env = { PATH: binDir, PATHEXT: '.EXE;.CMD' };

        const { resolveWindowsCommandOnPath } = await import('./resolveWindowsCommandInvocation.js');

        expect(resolveWindowsCommandOnPath('late-tool', env)).toBeNull();
        writeFileSync(join(binDir, 'late-tool.exe'), '', 'utf8');
        expect(resolveWindowsCommandOnPath('late-tool', env)?.toLowerCase()).toBe(join(binDir, 'late-tool.exe').toLowerCase());
    });

    it('detects PATHEXT commands directly from the supplied Windows PATH', async () => {
        if (!originalPlatformDescriptor) {
            throw new Error('Expected process.platform to be configurable for this test');
        }
        Object.defineProperty(process, 'platform', { ...originalPlatformDescriptor, value: 'win32' });

        const root = mkdtempSync(join(tmpdir(), 'happier-cli-common-win32-command-exists-'));
        tempDirs.add(root);
        const binDir = join(root, 'bin');
        mkdirSync(binDir, { recursive: true });
        const executablePath = join(binDir, 'powershell.exe');
        writeFileSync(executablePath, '', 'utf8');

        const { commandExistsOnPath } = await import('../commandExists.js');

        expect(commandExistsOnPath('powershell', {
            env: {
                PATH: binDir,
                PATHEXT: '.EXE;.CMD',
            },
        })).toBe(true);
    });

    it('normalizes full command paths without an extension to the matching .cmd shim', async () => {
        if (!originalPlatformDescriptor) {
            throw new Error('Expected process.platform to be configurable for this test');
        }
        Object.defineProperty(process, 'platform', { ...originalPlatformDescriptor, value: 'win32' });

        const root = mkdtempSync(join(tmpdir(), 'happier-cli-common-win32-invocation-'));
        tempDirs.add(root);
        const binDir = join(root, 'bin');
        mkdirSync(binDir, { recursive: true });

        const extensionlessPath = join(binDir, 'codex');
        const cmdShimPath = join(binDir, 'codex.cmd');
        writeFileSync(extensionlessPath, '', 'utf8');
        writeFileSync(cmdShimPath, '@echo off\r\necho ok\r\n', 'utf8');

        const { resolveWindowsCommandInvocation } = await import('./resolveWindowsCommandInvocation.js');

        const invocation = resolveWindowsCommandInvocation({
            command: extensionlessPath,
            args: ['app-server'],
            env: {
                PATH: binDir,
                PATHEXT: '.CMD;.EXE',
            },
        });

        expect(invocation.command).toBe('cmd.exe');
        expect(invocation.args.slice(0, 3)).toEqual(['/d', '/s', '/c']);
        expect(invocation.args[3]?.toLowerCase()).toContain(cmdShimPath.toLowerCase());
        expect(invocation.windowsVerbatimArguments).toBe(true);
    });

    it('resolves cmd.exe through COMSPEC when the command is not available on PATH', async () => {
        if (!originalPlatformDescriptor) {
            throw new Error('Expected process.platform to be configurable for this test');
        }
        Object.defineProperty(process, 'platform', { ...originalPlatformDescriptor, value: 'win32' });

        const { resolveWindowsCommandInvocation } = await import('./resolveWindowsCommandInvocation.js');

        const invocation = resolveWindowsCommandInvocation({
            command: 'cmd.exe',
            args: ['/c', 'npm install -g opencode-ai'],
            env: {
                PATH: '',
                PATHEXT: '.EXE;.CMD;.BAT;.COM',
                COMSPEC: 'C:\\WINDOWS\\system32\\cmd.exe',
            },
        });

        expect(invocation).toEqual({
            command: 'C:\\WINDOWS\\system32\\cmd.exe',
            args: ['/c', 'npm install -g opencode-ai'],
        });
    });
});
