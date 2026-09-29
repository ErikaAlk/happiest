import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const psListMock = vi.fn();
// Stdout of the Win32_Process CIM query, one value per query.
const win32ProcessQueryStdoutMock = vi.fn();

vi.mock('ps-list', () => ({
    default: psListMock,
}));

vi.mock('node:child_process', () => ({
    execFileSync: vi.fn(),
    execFile: (
        _command: string,
        _args: readonly string[],
        _options: unknown,
        callback: (error: Error | null, stdout: string, stderr: string) => void,
    ) => callback(null, win32ProcessQueryStdoutMock() ?? '', ''),
}));

describe('doctor win32 process discovery', () => {
    const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform');

    beforeEach(() => {
        vi.resetModules();
        psListMock.mockReset();
        win32ProcessQueryStdoutMock.mockReset();
        if (originalPlatformDescriptor) {
            Object.defineProperty(process, 'platform', { ...originalPlatformDescriptor, value: 'win32' });
        }
    });

    afterEach(() => {
        if (originalPlatformDescriptor) {
            Object.defineProperty(process, 'platform', originalPlatformDescriptor);
        }
    });

    it('enriches generic MainThread candidates with Win32_Process command lines during startup discovery', async () => {
        psListMock.mockResolvedValue([
            { pid: 17692, ppid: 1, name: 'happier.exe' },
            { pid: 26316, ppid: 17692, name: 'MainThread' },
            { pid: 99999, ppid: 1, name: 'notepad.exe' },
        ]);
        win32ProcessQueryStdoutMock.mockReturnValue(
            JSON.stringify([
                {
                    ProcessId: 17692,
                    Name: 'happier.exe',
                    CommandLine: '"C:\\hq\\windetachedfix-015\\happier-v0.2.4-windows-x64\\happier.exe" daemon start-sync',
                },
                {
                    ProcessId: 26316,
                    Name: 'MainThread',
                    CommandLine:
                        '"C:\\hq\\windetachedfix-007\\happier-v0.2.4-windows-x64\\happier.exe" "C:\\hq\\windetachedfix-007\\happier-v0.2.4-windows-x64\\package-dist\\index.mjs" opencode --happy-starting-mode remote --started-by daemon',
                },
            ]),
        );

        const { findAllHappyProcesses } = await import('./doctor');

        await expect(findAllHappyProcesses()).resolves.toEqual([
            {
                pid: 17692,
                command: '"C:\\hq\\windetachedfix-015\\happier-v0.2.4-windows-x64\\happier.exe" daemon start-sync',
                type: 'daemon',
            },
            {
                pid: 26316,
                command:
                    '"C:\\hq\\windetachedfix-007\\happier-v0.2.4-windows-x64\\happier.exe" "C:\\hq\\windetachedfix-007\\happier-v0.2.4-windows-x64\\package-dist\\index.mjs" opencode --happy-starting-mode remote --started-by daemon',
                type: 'daemon-spawned-session',
            },
        ]);
    });

    it('falls back to a broader Win32_Process snapshot when startup discovery still classifies zero Happy processes', async () => {
        psListMock.mockResolvedValue([
            { pid: 26316, ppid: 17692, name: 'MainThread' },
        ]);
        win32ProcessQueryStdoutMock
            .mockReturnValueOnce('')
            .mockReturnValueOnce(
                JSON.stringify([
                    {
                        ProcessId: 17692,
                        Name: 'happier.exe',
                        CommandLine: '"C:\\hq\\windetachedfix-017\\happier-v0.2.4-windows-x64\\happier.exe" daemon start-sync',
                    },
                    {
                        ProcessId: 26316,
                        Name: 'happier.exe',
                        CommandLine:
                            '"C:\\hq\\windetachedfix-007\\happier-v0.2.4-windows-x64\\happier.exe" "C:\\hq\\windetachedfix-007\\happier-v0.2.4-windows-x64\\package-dist\\index.mjs" opencode --happy-starting-mode remote --started-by daemon',
                    },
                ]),
            );

        const { findAllHappyProcesses } = await import('./doctor');

        await expect(findAllHappyProcesses()).resolves.toEqual([
            {
                pid: 17692,
                command: '"C:\\hq\\windetachedfix-017\\happier-v0.2.4-windows-x64\\happier.exe" daemon start-sync',
                type: 'daemon',
            },
            {
                pid: 26316,
                command:
                    '"C:\\hq\\windetachedfix-007\\happier-v0.2.4-windows-x64\\happier.exe" "C:\\hq\\windetachedfix-007\\happier-v0.2.4-windows-x64\\package-dist\\index.mjs" opencode --happy-starting-mode remote --started-by daemon',
                type: 'daemon-spawned-session',
            },
        ]);
    });

    it('enriches single-pid inspection with Win32_Process command lines for PID safety', async () => {
        win32ProcessQueryStdoutMock.mockReturnValue(
            JSON.stringify({
                ProcessId: 26316,
                Name: 'MainThread',
                CommandLine:
                    '"C:\\hq\\windetachedfix-007\\happier-v0.2.4-windows-x64\\happier.exe" "C:\\hq\\windetachedfix-007\\happier-v0.2.4-windows-x64\\package-dist\\index.mjs" opencode --happy-starting-mode remote --started-by daemon --existing-session session-123',
            }),
        );

        const { findHappyProcessByPid } = await import('./doctor');

        await expect(findHappyProcessByPid(26316)).resolves.toEqual({
            pid: 26316,
            command:
                '"C:\\hq\\windetachedfix-007\\happier-v0.2.4-windows-x64\\happier.exe" "C:\\hq\\windetachedfix-007\\happier-v0.2.4-windows-x64\\package-dist\\index.mjs" opencode --happy-starting-mode remote --started-by daemon --existing-session session-123',
            type: 'daemon-spawned-session',
        });
    });
});
